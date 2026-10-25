"use client";

import { useEffect, useState } from "react";
import type { Detection } from "@/lib/monitoring";

type Health = { status: string; streaming: boolean };
export function LiveDetectionView({ health, detection, metadataError, streamError, streamVersion, onStreamError, onRetry }: {
  health: Health; detection: Detection | null; metadataError: boolean;
  streamError: boolean; streamVersion: number; onStreamError: () => void; onRetry: () => void;
}) {
  const connected = health.streaming && !streamError;
  const message = health.status === "offline" ? "Live AI service is offline."
    : health.status === "camera_unavailable" ? "Camera unavailable."
    : health.status === "inference_unavailable" ? "AI inference unavailable."
    : connected ? "Live camera connected" : "Connecting to live camera...";
  return <section className="bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg space-y-4" aria-label="Live Detection">
    <div className="flex flex-wrap justify-between gap-2">
      <h2 className="font-semibold">Live camera · webcam-0</h2>
      <span className={connected ? "text-primary font-bold" : "text-on-surface-variant"}>{connected ? "LIVE" : "OFFLINE"}</span>
    </div>
    <p role="status">{message}{streamError && health.streaming ? " Reconnecting…" : ""}</p>
    <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center text-white">
      {health.streaming ?
        // MJPEG must use a native image: Next Image optimization buffers responses.
        <img key={streamVersion} src="/api/ai/live/stream" alt="Live AI annotated webcam video" onError={onStreamError} className="w-full h-full object-contain" />
        : <span>{message}</span>}
    </div>
    {!connected && <button type="button" onClick={onRetry} className="rounded-lg bg-primary text-white px-4 py-2">Retry connection</button>}
    <div aria-label="Latest detection metadata">
      <h3 className="font-semibold">Latest AI result</h3>
      <p className="text-sm text-on-surface-variant">Latest saved detection · Spring backend · updates every 2 seconds</p>
      {metadataError ? <p role="status">Detection metadata unavailable. Video connection is independent.</p>
        : detection ? <dl className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-3">
          <div><dt>Latest verdict</dt><dd>{detection.verdict === "no_detection" ? "No detection" : detection.message}</dd></div>
          <div><dt>Severity</dt><dd>{detection.severity}</dd></div>
          <div><dt>Healthy count</dt><dd>{detection.n_healthy}</dd></div>
          <div><dt>Contaminated count</dt><dd>{detection.n_contaminated}</dd></div>
          <div><dt>Highest confidence</dt><dd>{Math.round(detection.max_conf * 100)}%</dd></div>
          <div><dt>Last detection</dt><dd><time dateTime={detection.captured_at}>{new Date(detection.captured_at).toLocaleString()}</time></dd></div>
        </dl> : <p>No detection</p>}
    </div>
  </section>;
}

export function LiveDetectionPanel() {
  const [health, setHealth] = useState<Health>({ status: "starting", streaming: false });
  const [detection, setDetection] = useState<Detection | null>(null);
  const [metadataError, setMetadataError] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [streamVersion, setStreamVersion] = useState(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      await Promise.all([
        (async () => {
          try {
            const response = await fetch("/api/ai/live/health", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
            if (!response.ok) throw new Error();
            setHealth(await response.json());
          } catch { if (!controller.signal.aborted) setHealth({ status: "offline", streaming: false }); }
        })(),
        (async () => {
          try {
            const response = await fetch("/api/ai/live/detection", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
            if (response.status === 404) { setDetection(null); setMetadataError(false); return; }
            if (!response.ok) throw new Error();
            setDetection((await response.json()).detection); setMetadataError(false);
          } catch { if (!controller.signal.aborted) setMetadataError(true); }
        })(),
      ]);
      if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [retry]);
  useEffect(() => {
    if (!streamError) return;
    const timer = setTimeout(() => { setStreamVersion(v => v + 1); setStreamError(false); }, 3000);
    return () => clearTimeout(timer);
  }, [streamError]);
  return <LiveDetectionView health={health} detection={detection} metadataError={metadataError}
    streamError={streamError} streamVersion={streamVersion} onStreamError={() => setStreamError(true)} onRetry={() => {
      setStreamVersion(v => v + 1); setStreamError(false); setRetry(v => v + 1);
    }} />;
}
