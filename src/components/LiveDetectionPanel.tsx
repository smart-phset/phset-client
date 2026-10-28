"use client";

import { useEffect, useState } from "react";
import { useLiveCameraDetection } from "@/features/ai-alerts/aiDetectionApi";
import { AISeverityBadge } from "@/features/ai-alerts/AISeverityBadge";
import { isFreshDetection } from "@/features/ai-alerts/aiAlertTransitions";
import type { Detection } from "@/lib/monitoring";

type Health = { status: string; streaming: boolean; camera?: string; actualCamera?: string };
export function LiveDetectionView({ health, detection, metadataError, streamError, streamVersion, onStreamError, onRetry, cameraId, streamUrl = "/api/ai/live/stream", streamLoaded = false, onStreamLoad, metadataFresh = true }: {
  cameraId?: string; streamUrl?: string; streamLoaded?: boolean; onStreamLoad?: () => void; metadataFresh?: boolean; health: Health; detection: Detection | null; metadataError: boolean;
  streamError: boolean; streamVersion: number; onStreamError: () => void; onRetry: () => void;
}) {
  const connected = health.streaming && streamLoaded && !streamError;
  const message = health.status === "disabled" ? "Shared camera disabled. A secure AI relay must be configured before remote viewing." : health.status === "network_disconnected" ? "Network disconnected. Reconnect and retry." : health.status === "offline" ? "Live AI service is offline."
    : health.status === "source_mismatch" ? health.actualCamera === "webcam-0" ? "Python is serving webcam-0. Select Laptop Webcam — AI Stream." : health.actualCamera === "esp32-cam" ? "Python is serving esp32-cam. Select ESP32-CAM." : "Python is serving a different camera. Select its matching AI source or restart Python with the intended source."
    : health.status === "camera_unavailable" ? "Camera unavailable."
    : health.status === "stalled" ? "Camera frames stopped arriving. Retrying…"
    : health.status === "inference_unavailable" ? "AI inference unavailable."
    : connected ? "Live camera connected" : "Connecting to live camera...";
  return <section className="bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg space-y-4" aria-label="Live Detection">
    <div className="flex flex-wrap justify-between gap-2">
      <h2 className="font-semibold">Live camera · {cameraId ?? detection?.camera_id ?? "Configured camera"}</h2>
      <span className={connected ? "text-primary font-bold" : "text-on-surface-variant"}>{connected ? "LIVE" : (health.status === "starting" || health.streaming && !streamError) ? "CONNECTING" : "OFFLINE"}</span>
    </div>
    <p role="status">{message}{streamError && health.streaming ? " Shared stream unavailable. Reconnecting…" : ""}</p>
    <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center text-white">
      {health.streaming ?
        // MJPEG must use a native image: Next Image optimization buffers responses.
        <img key={streamVersion} src={streamUrl} alt="Live AI annotated camera video" onLoad={onStreamLoad} onError={onStreamError} className="w-full h-full object-contain" />
        : <span>{message}</span>}
    </div>
    {!connected && health.status !== "disabled" && <button type="button" onClick={onRetry} className="rounded-lg bg-primary text-white px-4 py-2">Retry connection</button>}
    <div aria-label="Latest detection metadata">
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">AI Detection · Latest AI result</h3>
        <AISeverityBadge severity={!metadataError && metadataFresh && detection ? detection.severity : "GREY"} /></div>
      {!metadataFresh && detection && <p role="status">Detection is stale. Current severity is unknown; saved result shown below.</p>}
      <p className="text-sm text-on-surface-variant">Latest saved detection · Spring backend · updates every 2 seconds</p>
      {metadataError ? <p role="status">Detection metadata unavailable. Video connection is independent.</p>
        : detection ? <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
          <div><dt>Latest verdict</dt><dd>{detection.verdict === "no_detection" ? "No detection" : detection.message}</dd></div>
          <div><dt>Saved severity</dt><dd>{detection.severity === "AMBER" ? "YELLOW" : detection.severity === "GREY" ? "UNKNOWN" : detection.severity}</dd></div>
          <div><dt>Healthy count</dt><dd>{detection.n_healthy}</dd></div>
          <div><dt>Contaminated count</dt><dd>{detection.n_contaminated}</dd></div>
          <div><dt>Highest confidence</dt><dd>{Math.round(detection.max_conf * 100)}%</dd></div>
          <div><dt>Last detection</dt><dd><time dateTime={detection.captured_at}>{new Date(detection.captured_at).toLocaleString()}</time></dd></div>
        </dl> : <p>No detection</p>}
    </div>
  </section>;
}

export function LiveDetectionPanel({ cameraId }: { cameraId?: string } = {}) {
  const suffix = cameraId ? `?camera=${encodeURIComponent(cameraId)}` : "";
  const [health, setHealth] = useState<Health>({ status: "starting", streaming: false });
  const { data, isError: metadataError } = useLiveCameraDetection(cameraId);
  const detection = health.status !== "source_mismatch" && (!cameraId || health.camera === cameraId) && health.camera && data?.cameraId === health.camera && data.detection.camera_id === health.camera ? data.detection : null;
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [streamError, setStreamError] = useState(false);
  const [streamVersion, setStreamVersion] = useState(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`/api/ai/live/health${suffix}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
        const value = await response.json();
        if (!response.ok && value.status !== "disabled" && value.status !== "source_mismatch") throw new Error();
        if (controller.signal.aborted) return;
        if (!value.streaming) setLoadedVersion(null);
        setHealth(value);
      } catch { if (!controller.signal.aborted) { setLoadedVersion(null); setHealth({ status: navigator.onLine ? "offline" : "network_disconnected", streaming: false }); } }
      if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [retry, suffix]);
  useEffect(() => {
    if (!streamError) return;
    const timer = setTimeout(() => { setStreamVersion(v => v + 1); setStreamError(false); }, 3000);
    return () => clearTimeout(timer);
  }, [streamError]);
  const sourceHealth = cameraId && health.camera && health.camera !== cameraId
    ? { status: "source_mismatch", streaming: false, actualCamera: health.camera } : health;
  return <LiveDetectionView health={sourceHealth} detection={detection} metadataError={metadataError} cameraId={cameraId ?? health.camera} streamUrl={`/api/ai/live/stream${suffix}`}
    metadataFresh={sourceHealth.streaming && loadedVersion === streamVersion && !streamError && !!detection && now > 0 && isFreshDetection(detection, now)}
    streamLoaded={loadedVersion === streamVersion} onStreamLoad={() => setLoadedVersion(streamVersion)}
    streamError={streamError} streamVersion={streamVersion} onStreamError={() => { setLoadedVersion(null); setStreamError(true); }} onRetry={() => {
      setStreamVersion(v => v + 1); setStreamError(false); setRetry(v => v + 1);
    }} />;
}
