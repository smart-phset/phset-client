"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { browserJson, MonitoringError, type Detection } from "@/lib/monitoring";
import { startMonitoringPoll } from "@/lib/monitoring-poll";

export default function DetectionHistory() {
  const t = useT();
  const [detections, setDetections] = useState<Detection[]>([]);
  const [camera, setCamera] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => startMonitoringPoll(async signal => {
    try {
      const next = await browserJson<{ cameraId: string; detections: Detection[] }>("/api/monitoring/detections", {
        signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
      });
      if (!signal.aborted) { setDetections(next.detections); setCamera(next.cameraId); setError(null); }
    } catch (e) {
      if (!signal.aborted) setError(e instanceof MonitoringError ? e.message : "Cannot reach the monitoring server.");
    } finally { if (!signal.aborted) setLoading(false); }
  }, {
    visible: () => document.visibilityState !== "hidden",
    later: (callback, delay) => window.setTimeout(callback, delay),
    cancel: timer => window.clearTimeout(timer as number),
    onVisibility: callback => { document.addEventListener("visibilitychange", callback);
      return () => document.removeEventListener("visibilitychange", callback); },
  }), []);
  return <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-6 space-y-4">
    <h1 className="text-headline-lg font-headline-lg">{t("Detection history")}</h1>
    <p className="text-on-surface-variant">{t("Latest 20 stored results from the real backend. No photo files are provided by this API.")}</p>
    {camera && <p>{t("Camera")}: {camera}</p>}
    {loading && <p role="status">{t("Loading AI results…")}</p>}
    {error && <p role="alert" className="p-3 rounded-lg bg-error-container text-on-error-container">{t(error)}</p>}
    {!loading && !error && !detections.length && <p>{t("No detections have been reported for this camera.")}</p>}
    <div className="space-y-3">{detections.map(detection => <article key={detection.id} className="bg-surface-container-lowest p-5 rounded-xl shadow-sm">
      <div className="flex flex-wrap gap-3 justify-between"><h2 className="text-headline-sm">{t(detection.message)}</h2>
        <time dateTime={detection.captured_at}>{new Date(detection.captured_at).toLocaleString()}</time></div>
      <p className="mt-2 text-on-surface-variant">{t("Severity")}: {detection.severity} · {t("Contamination confidence")}: {detection.verdict === "no_detection" || detection.verdict === "camera_error" ? t("Unavailable") : `${(detection.max_contaminated_conf * 100).toFixed(1)}%`}</p>
    </article>)}</div>
  </div>;
}
