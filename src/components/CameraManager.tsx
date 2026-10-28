"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserCamera, CAMERA_PREFERENCE_KEY, cameraError } from "@/lib/browser-camera";
import { FramePump, type CameraResult } from "@/lib/camera-analysis";

type Shared = { id: string; label: string; availability: string };
export function CameraManager() {
  const [source, setSource] = useState("shared");
  const [shared, setShared] = useState<Shared[]>([]);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [choice, setChoice] = useState("");
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("OFFLINE");
  const [error, setError] = useState("");
  const [registryError, setRegistryError] = useState("");
  const [result, setResult] = useState<CameraResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [streamLoaded, setStreamLoaded] = useState(false);
  const [streamVersion, setStreamVersion] = useState(0);
  const [startingAI, setStartingAI] = useState(false);
  const [fps, setFps] = useState(2);
  const video = useRef<HTMLVideoElement>(null);
  const camera = useRef(new BrowserCamera());
  const pump = useRef(new FramePump());
  const session = useRef<string | null>(null);
  const operation = useRef(0);
  const analysisOperation = useRef(0);

  async function api(path: string, method = "GET", body?: BodyInit, signal?: AbortSignal): Promise<CameraResult> {
    const response = await fetch(`/api/cameras/sessions${path}`, { method, body, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000), headers: body instanceof Blob ? { "Content-Type": "image/jpeg", "X-Camera-Revision": String(analysisOperation.current) } : { "Content-Type": "application/json" }, cache: "no-store" });
    const value = await response.json();
    if (!response.ok) throw new Error(response.status === 429 ? "busy" : response.status === 401 ? "Session expired. Sign in again." : value.error || "Camera service unavailable");
    return value;
  }
  function stop() {
    operation.current++; analysisOperation.current++;
    pump.current.stop(); camera.current.stop();
    const sid = session.current; session.current = null;
    if (sid) void fetch(`/api/cameras/sessions/${sid}`, { method: "DELETE", keepalive: true }).catch(() => {});
    if (video.current) video.current.srcObject = null;
    setStreamLoaded(false); setActive(false); setAnalyzing(false); setStartingAI(false); setResult(null); setStatus("OFFLINE");
  }
  useEffect(() => {
    try { const saved = sessionStorage.getItem(CAMERA_PREFERENCE_KEY); if (saved) setSource(saved === "laptop-ai" ? "shared:webcam-0" : saved); } catch {}
    const owner = camera.current, frames = pump.current;
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("smartphset-camera-logout") : null;
    const cleanup = () => {
      operation.current++; analysisOperation.current++;
      owner.stop(); frames.stop();
      const sid = session.current; session.current = null;
      if (sid) void fetch(`/api/cameras/sessions/${sid}`, { method: "DELETE", keepalive: true }).catch(() => {});
      setActive(false); setAnalyzing(false); setStatus("OFFLINE"); setResult(null);
    };
    const submit = (event: Event) => {
      const form = event.target;
      if (form instanceof HTMLFormElement && new URL(form.action).pathname === "/api/auth/signout") { cleanup(); channel?.postMessage("logout"); }
    };
    if (channel) channel.onmessage = cleanup;
    window.addEventListener("pagehide", cleanup);
    document.addEventListener("submit", submit, true);
    return () => { cleanup(); channel?.close(); window.removeEventListener("pagehide", cleanup); document.removeEventListener("submit", submit, true); };
  }, []);
  useEffect(() => {
    const media = navigator.mediaDevices;
    let disposed = false;
    const refresh = async () => {
      try {
        const list = (await media?.enumerateDevices() || []).filter(d => d.kind === "videoinput");
        if (!disposed) { setDevices(list); setChoice(previous => previous && !["user", "environment"].includes(previous) && !list.some(d => d.deviceId === previous) ? "" : previous); }
      } catch {}
    };
    void refresh(); media?.addEventListener("devicechange", refresh);
    return () => { disposed = true; media?.removeEventListener("devicechange", refresh); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      try {
        const response = await fetch("/api/cameras", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]), cache: "no-store" });
        if (!response.ok) throw new Error();
        const list = await response.json();
        if (!controller.signal.aborted) { setShared(list); setRegistryError(""); }
      } catch { if (!controller.signal.aborted) setRegistryError("Shared camera registry unavailable. Local camera preview is available."); }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 15000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!active || !session.current) return;
    const sid = session.current, generation = operation.current, analysis = analysisOperation.current;
    const controller = new AbortController();
    const timer = setInterval(async () => {
      try {
        const value = await api(`/${sid}`, "GET", undefined, controller.signal);
        if (generation !== operation.current || analysis !== analysisOperation.current) return;
        setResult(value);
        if (source !== "local" && !["LIVE", "DETECTING"].includes(value.status)) setStreamLoaded(false);
        setStatus(["LIVE", "DETECTING"].includes(value.status) ? (source !== "local" && !streamLoaded ? "CONNECTING" : value.status) : value.status === "inference_unavailable" ? "ERROR" : "OFFLINE");
      } catch { if (generation === operation.current && !controller.signal.aborted) { stop(); setStatus("ERROR"); setError("Camera session unavailable. Stop and start the camera to reconnect."); } }
    }, 2000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [active, analyzing, source, streamLoaded]);
  useEffect(() => {
    if (!active || source === "local" || streamLoaded) return;
    const timer = setInterval(() => setStreamVersion(value => value + 1), 7000);
    return () => clearInterval(timer);
  }, [active, source, streamLoaded]);

  function select(next: string) {
    stop(); setSource(next); setError("");
    try { sessionStorage.setItem(CAMERA_PREFERENCE_KEY, next); } catch {}
  }
  async function start() {
    stop(); setError("");
    const generation = operation.current;
    setStatus("CONNECTING");
    try {
      if (source === "local") {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Camera access requires HTTPS or localhost and MediaDevices support.");
        const stream = await camera.current.start(navigator.mediaDevices, choice);
        if (!stream || generation !== operation.current) return;
        if (video.current) { video.current.srcObject = stream; await video.current.play(); }
        stream.getVideoTracks().forEach(track => track.addEventListener("ended", () => {
          if (generation === operation.current) { stop(); setStatus("ERROR"); setError("Camera disconnected. Reconnect it and retry."); }
        }, { once: true }));
        const list = await navigator.mediaDevices.enumerateDevices();
        if (generation !== operation.current) return;
        setDevices(list.filter(d => d.kind === "videoinput"));
      } else {
        const id = source === "shared" ? shared[0]?.id : source.slice(7);
        if (!id) throw new Error("Select an available shared camera.");
        const value = await api("", "POST", JSON.stringify({ source_id: id }));
        if (generation !== operation.current) { void api(`/${value.session_id}`, "DELETE").catch(() => {}); return; }
        session.current = value.session_id; setResult(value);
      }
      if (generation === operation.current) { setActive(true); setStatus(source === "local" ? "LIVE" : "CONNECTING"); }
    } catch (failure) {
      if (generation === operation.current) { stop(); setStatus("ERROR"); setError((failure instanceof DOMException || ["NotAllowedError", "NotFoundError", "NotReadableError", "OverconstrainedError"].includes((failure as Error).name)) ? cameraError(failure) : (failure as Error).message); }
    }
  }
  async function stopAI() {
    const revision = ++analysisOperation.current; pump.current.stop(); setAnalyzing(false); setStartingAI(false); setResult(previous => previous ? { ...previous, detection: null, analyzing: false } : null);
    setStatus(active ? "LIVE" : "OFFLINE");
    const sid = session.current;
    if (sid) try { await api(`/${sid}/stop`, "POST", JSON.stringify({ revision })); } catch { setError("Could not confirm analysis stop. Stop Camera to close the session."); }
  }
  async function startAI() {
    const generation = operation.current, analysis = ++analysisOperation.current;
    setStartingAI(true); setError("");
    let created: string | null = null;
    try {
      let sid = session.current;
      if (!sid) {
        const value = await api("", "POST", JSON.stringify({ source_id: "browser" }));
        sid = value.session_id; created = sid;
        if (generation !== operation.current || analysis !== analysisOperation.current) { void api(`/${sid}`, "DELETE").catch(() => {}); return; }
        session.current = sid;
      }
      await api(`/${sid}/start`, "POST", JSON.stringify({ revision: analysis }));
      if (generation !== operation.current || analysis !== analysisOperation.current) return;
      setAnalyzing(true); setStatus("DETECTING");
      if (source === "local") {
        const canvas = document.createElement("canvas");
        pump.current.start(async () => {
          const element = video.current;
          if (!element?.videoWidth) return null;
          const scale = Math.min(1, 960 / element.videoWidth, 720 / element.videoHeight);
          canvas.width = Math.round(element.videoWidth * scale); canvas.height = Math.round(element.videoHeight * scale);
          canvas.getContext("2d")?.drawImage(element, 0, 0, canvas.width, canvas.height);
          return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", .75));
        }, async (frame, signal) => {
          try {
            const value = await api(`/${sid}/frames`, "POST", frame, signal);
            if (!signal.aborted && analysis === analysisOperation.current) { setResult(value); setStatus("DETECTING"); setError(""); }
          } catch (failure) {
            if ((failure as Error).message === "busy") { setError("Inference busy. Retrying at the selected sampling rate."); return; }
            throw failure;
          }
        }, fps, () => { setAnalyzing(false); setStatus("ERROR"); setError("AI inference unavailable. Stop and restart analysis to retry."); });
      }
    } catch (failure) {
      if (generation === operation.current && analysis === analysisOperation.current) {
        if (created) { session.current = null; void api(`/${created}`, "DELETE").catch(() => {}); }
        setStatus("ERROR"); setError((failure as Error).message);
      }
    } finally { if (analysis === analysisOperation.current) setStartingAI(false); }
  }
  const detection = analyzing ? result?.detection : null;
  const button = "rounded-lg px-4 py-2 bg-surface-container disabled:opacity-50";
  return <section aria-label="Camera Manager" className="bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg space-y-4">
    <div className="flex justify-between gap-2"><h2 className="font-semibold">Camera Manager</h2><span role="status">{status}</span></div>
    <label className="block">Camera source<select className="block w-full mt-2 p-3 rounded-lg bg-surface-container" value={source} onChange={e => select(e.target.value)}>
      <option value="disabled">Camera Disabled</option><option value="local">This Device&apos;s Camera</option><option value="shared">Shared camera · default registered source</option>
      {shared.map(c => <option key={c.id} value={`shared:${c.id}`}>{c.label} · shared ({c.availability})</option>)}
    </select></label>
    {registryError && <p role="status">{registryError}</p>}
    {source === "local" && <>
      <label className="block">Device camera<select className="block w-full mt-2 p-3 bg-surface-container" value={choice} onChange={e => { stop(); setChoice(e.target.value); setError(""); }}>
        <option value="">Default camera</option><option value="user">Front camera</option><option value="environment">Rear camera</option>
        {devices.filter(d => d.deviceId).map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
      </select></label>
      <p className="text-sm">Start Camera requests permission for local preview. Start AI Detection opts in to sending sampled JPEG frames for analysis. Stop AI Detection ends transmission and keeps the preview running.</p>
      <label>Sampling rate <select value={fps} disabled={analyzing || startingAI} onChange={e => setFps(Number(e.target.value))}>{[1, 2, 5].map(n => <option key={n} value={n}>{n} fps maximum</option>)}</select></label>
    </>}
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={source === "disabled" || active || status === "CONNECTING"} onClick={() => void start()}>Start Camera</button>
      <button className={button} disabled={!active && status !== "CONNECTING"} onClick={stop}>Stop Camera</button>
      <button className={button} disabled={!active || analyzing || startingAI || (source !== "local" && !streamLoaded)} onClick={() => void startAI()}>Start AI Detection</button>
      {error && !active && <button className={button} onClick={() => void start()}>Retry</button>}
      <button className={button} disabled={!analyzing && !startingAI} onClick={() => void stopAI()}>Stop AI Detection</button>
    </div>
    {error && <p role="alert" className="text-error">{error}</p>}
    <div className="aspect-video bg-black rounded-lg overflow-hidden relative flex items-center justify-center text-white">
      {source === "local" ? <div className="relative max-w-full max-h-full" style={{ aspectRatio: video.current?.videoWidth ? `${video.current.videoWidth}/${video.current.videoHeight}` : "16/9" }}>
        <video ref={video} autoPlay muted playsInline className={`max-w-full max-h-full ${active ? "" : "hidden"}`} />
        {detection && <svg viewBox={`0 0 ${detection.shape[1]} ${detection.shape[0]}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-label="Detection boxes">
          {detection.boxes.map((box, i) => <g key={i}><rect x={box.xyxy[0]} y={box.xyxy[1]} width={box.xyxy[2] - box.xyxy[0]} height={box.xyxy[3] - box.xyxy[1]} fill="none" stroke={box.label.startsWith("contam") ? "#ffb020" : "#30df80"} strokeWidth="3" /><text x={box.xyxy[0]} y={Math.max(18, box.xyxy[1] - 5)} fill="white" stroke="black" strokeWidth=".5" fontSize="18">{box.label} {Math.round(box.conf * 100)}%</text></g>)}
        </svg>}
      </div> : active && result ?
        // Native MJPEG fan-out; no image optimization or duplicate capture.
        <img key={streamVersion} src={`/api/cameras/sessions/${result.session_id}/stream?v=${streamVersion}`} alt="Shared camera preview" className="w-full h-full object-contain" onLoad={() => { setStreamLoaded(true); setStatus(analyzing ? "DETECTING" : "LIVE"); setError(""); }} onError={() => { setStreamLoaded(false); setStatus("OFFLINE"); setError("Shared camera disconnected. Stop and start to reconnect."); }} /> : null}
      {!active && <span className="absolute p-4 text-center">{status === "CONNECTING" ? "Waiting for camera…" : "Select a source and press Start Camera."}</span>}
    </div>
    <p>AI Detection: {analyzing ? detection ? `${detection.message} · ${detection.severity} · ${Math.round(detection.max_conf * 100)}% · ${Math.round(detection.ms)} ms` : "Waiting for inference…" : "Off · preview only"}</p>
    <p className="text-sm">Camera choices belong to this tab. Shared camera analysis is processed once per source; grow-room alerts and equipment controls remain independent.</p>
  </section>;
}
