"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { browserJson, freshness, type MonitorSnapshot } from "@/lib/monitoring";
import { useLatestAIDetectionState } from "@/features/ai-alerts/aiDetectionApi";

type Check = { name: string; status: string; message: string };

export default function StatusPage() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);
  const ai = useLatestAIDetectionState();
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]);
    setBusy(true);
    void Promise.all([
      (async (): Promise<Check> => {
        const data = await browserJson<MonitorSnapshot>("/api/monitoring/state", { signal });
        const state = data.state;
        return { name: "Grow-room controller", status: freshness(state.state_captured_at, state.state_received_at, Date.now()).toUpperCase(),
          message: `${data.deviceId} · Last received: ${state.state_received_at ?? "No report"}. Telemetry: ${freshness(state.telemetry_captured_at, state.telemetry_received_at, Date.now())}.` };
      })().catch(() => ({ name: "Grow-room controller", status: "UNAVAILABLE", message: "Could not retrieve authenticated Spring device state. Open Overview for details." })),
      (async (): Promise<Check> => {
        const response = await fetch("/api/ai/live/health", { cache: "no-store", signal });
        if (response.status === 401) throw new Error();
        const data = await response.json();
        return { name: "Shared Python AI", status: response.ok && data.streaming === true ? "STREAM AVAILABLE" : "UNAVAILABLE",
          message: `Service: ${data.status ?? "offline"} · Camera: ${data.camera ?? "not available"}. Video rendering must be checked in Camera Manager.` };
      })().catch(() => ({ name: "Shared Python AI", status: "UNAVAILABLE", message: "Cannot reach the authorized live service." })),
    ]).then(value => { if (!controller.signal.aborted) { setChecks(value); setBusy(false); } });
    return () => controller.abort();
  }, [revision]);
  return <div className="max-w-[1240px] mx-auto px-4 md:px-6 py-6 space-y-5">
    <h1 className="text-headline-lg">System status</h1>
    <p>Read-only service checks. This page does not test physical loads, MQTT delivery, or model accuracy.</p>
    <button type="button" disabled={busy} onClick={() => setRevision(value => value + 1)} className="rounded-lg px-4 py-2 bg-primary text-white disabled:opacity-50">Check again</button>
    {busy ? <p role="status">Checking services…</p> : <div className="grid md:grid-cols-2 gap-4">{checks.map(check => <section key={check.name} className="rounded-xl p-5 bg-surface-container-lowest space-y-3">
      <h2 className="font-semibold">{check.name}</h2><p role="status">{check.status}</p><p className="break-words">{check.message}</p>
    </section>)}</div>}
    <section className="rounded-xl p-5 bg-surface-container-lowest space-y-3"><h2 className="font-semibold">Spring detection metadata</h2>
      <p role="status">{ai.isError ? "UNAVAILABLE · Backend authentication or connectivity needs attention." : ai.data ? `Readable · Camera: ${ai.data.cameraId} · Last detection: ${ai.data.detection.captured_at}` : "Waiting for metadata…"}</p>
      <p>Readable metadata alone does not establish a live video connection.</p>
    </section>
    <div className="flex flex-wrap gap-5"><Link className="underline text-primary" href="/">Open Overview</Link><Link className="underline text-primary" href="/scan">Open Camera Manager</Link><Link className="underline text-primary" href="/history">Open Scan History</Link></div>
    <p className="text-on-surface-variant">Results are snapshots from the last check. Press Check again to refresh.</p>
  </div>;
}
