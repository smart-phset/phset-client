"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { ACTUATORS, CONFIRM_MS, POLL_MS, browserJson, confirmsCommand, freshness, MonitoringError,
  type Actuator, type CommandReceipt, type Detection, type MonitorSnapshot, type PendingCommand } from "@/lib/monitoring";
import { startMonitoringPoll } from "@/lib/monitoring-poll";

type CommandStatus = { phase: "sending" | "accepted" | "confirmed" | "unconfirmed" | "error";
  message: string; pending: PendingCommand; receipt?: CommandReceipt };
type CommandStatuses = Partial<Record<Actuator, CommandStatus>>;
const actuatorLabels = { fan: "Fan", light: "Light", pump: "Water Pump" };
const statusLabels = { active: "Active", stale: "Stale", offline: "Offline", unavailable: "Unavailable" };
const statusIcons = { active: "check_circle", stale: "warning", offline: "cloud_off", unavailable: "cloud_off" };
const statusStyles = { active: "bg-tertiary-fixed text-tertiary", stale: "bg-secondary-fixed text-on-secondary-fixed",
  offline: "bg-surface-variant text-on-surface-variant", unavailable: "bg-error-container text-on-error-container" };
const errorMessage = (error: unknown) => error instanceof MonitoringError ? error.message : "Cannot reach the monitoring server. Check your connection.";
const dateText = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : "No report yet";

export function GrowRoomDashboard({ deviceId, teamAccount }: { deviceId: string; teamAccount: boolean }) {
  const t = useT();
  const [snapshot, setSnapshot] = useState<MonitorSnapshot | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detection, setDetection] = useState<Detection | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [commands, setCommands] = useState<CommandStatuses>({});
  const commandsRef = useRef<CommandStatuses>({});
  const commandRequests = useRef<Partial<Record<Actuator, AbortController>>>({});
  const [now, setNow] = useState<number | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const requests = commandRequests.current;
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    const stop = startMonitoringPoll(async signal => {
      const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(8_000)]);
      await Promise.all([
        (async () => {
          try {
            const next = await browserJson<MonitorSnapshot>("/api/monitoring/state", { signal: requestSignal });
            if (signal.aborted || !mounted.current) return;
            setSnapshot(next); setStateError(null); setNow(Date.now());
            const current = { ...commandsRef.current };
            for (const actuator of ACTUATORS) {
              const command = current[actuator];
              if (command?.phase === "accepted" && confirmsCommand(next.state, actuator, command.pending, Date.now())) {
                current[actuator] = { ...command, phase: "confirmed", message: "ESP32 reported the requested state." };
              }
            }
            commandsRef.current = current; setCommands(current);
          } catch (error) {
            if (!signal.aborted && mounted.current) setStateError(errorMessage(error));
          } finally { if (!signal.aborted && mounted.current) setLoading(false); }
        })(),
        (async () => {
          try {
            const next = await browserJson<{ detection: Detection }>("/api/monitoring/detection", { signal: requestSignal });
            if (!signal.aborted && mounted.current) { setDetection(next.detection); setAiError(null); }
          } catch (error) {
            if (!signal.aborted && mounted.current) setAiError(errorMessage(error));
          } finally { if (!signal.aborted && mounted.current) setAiLoading(false); }
        })(),
      ]);
    }, {
      visible: () => document.visibilityState !== "hidden",
      later: (callback, delay) => window.setTimeout(callback, delay),
      cancel: timer => window.clearTimeout(timer as number),
      onVisibility: callback => { document.addEventListener("visibilitychange", callback);
        return () => document.removeEventListener("visibilitychange", callback); },
    }, POLL_MS);
    return () => {
      mounted.current = false; stop(); window.clearInterval(tick);
      for (const request of Object.values(requests)) request?.abort();
    };
  }, []);

  useEffect(() => {
    if (now === null) return;
    let changed = false;
    const current = { ...commandsRef.current };
    for (const actuator of ACTUATORS) {
      const command = current[actuator];
      if (command?.phase === "accepted" && now - command.pending.sentAt > CONFIRM_MS) {
        current[actuator] = { ...command, phase: "unconfirmed",
          message: "Accepted, but no matching ESP32 report was observed. Check the device; the command will not be retried." };
        changed = true;
      }
    }
    if (changed) { commandsRef.current = current; setCommands(current); }
  }, [now]);

  const state = snapshot?.state;
  const health = stateError ? "unavailable" : state && now !== null
    ? freshness(state.state_captured_at, state.state_received_at, now) : "unavailable";
  const telemetryHealth = state && now !== null
    ? freshness(state.telemetry_captured_at, state.telemetry_received_at, now) : "unavailable";
  const canControl = teamAccount && (snapshot?.canControl ?? true);

  async function send(actuator: Actuator, on: boolean) {
    if (commandRequests.current[actuator] || !canControl || (on && health !== "active")) return;
    const controller = new AbortController();
    commandRequests.current[actuator] = controller;
    const pending: PendingCommand = { target: on, sentAt: Date.now(),
      baselineCaptured: state?.state_captured_at ?? null, baselineReceived: state?.state_received_at ?? null };
    const update = (status: CommandStatus) => {
      if (!mounted.current) return;
      commandsRef.current = { ...commandsRef.current, [actuator]: status };
      setCommands(commandsRef.current);
    };
    update({ phase: "sending", message: "Sending command…", pending });
    try {
      const receipt = await browserJson<CommandReceipt>(`/api/monitoring/actuators/${actuator}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]),
      });
      update({ phase: "accepted", message: "Accepted for MQTT transmission. Waiting for ESP32 state…", pending, receipt });
    } catch (error) {
      update({ phase: "error", message: error instanceof MonitoringError ? error.message
        : "Delivery could not be confirmed. Check reported state before trying again.", pending });
    } finally { delete commandRequests.current[actuator]; }
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-6 space-y-6">
      <section className="bg-surface-container-lowest rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-label-md text-primary font-semibold mb-2">{t("Live monitoring")}</p>
            <h1 className="text-headline-lg font-headline-lg">{t("SmartPhset Grow Room")}</h1>
            <p className="mt-2 text-on-surface-variant break-all">{t("Device")}: <strong>{snapshot?.deviceId ?? deviceId}</strong></p></div>
          <span role="status" className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-label-md font-semibold ${loading ? "bg-surface-container" : statusStyles[health]}`}>
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{loading ? "sensors" : statusIcons[health]}</span>
            {loading ? t("Connecting…") : t(statusLabels[health])}</span>
        </div>
        <dl className="grid sm:grid-cols-2 gap-3 mt-5 text-body-md">
          <div><dt className="text-on-surface-variant">{t("Last seen by backend")}</dt><dd>{t(dateText(state?.state_received_at))}</dd></div>
          <div><dt className="text-on-surface-variant">{t("Device state captured")}</dt><dd>{t(dateText(state?.state_captured_at))}</dd></div>
        </dl>
        <p className="mt-4 text-on-surface-variant">{t("Updates about every 5 seconds while this page is visible. Status is based on reported timestamps.")}</p>
        {stateError && <p role="alert" className="mt-4 rounded-lg bg-error-container text-on-error-container p-3">{t(stateError)} {state && t("Showing the last retrieved report.")}</p>}
      </section>
      <section aria-labelledby="environment-title">
        <h2 id="environment-title" className="text-headline-sm font-headline-sm mb-3">{t("Environment")}</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <SensorCard label="Temperature" unit="°C" value={state?.temperature_c} loading={loading}
            stale={telemetryHealth !== "active" || !!stateError} timestamp={state?.telemetry_captured_at} />
          <SensorCard label="Humidity" unit="%" value={state?.humidity_percent} loading={loading}
            stale={telemetryHealth !== "active" || !!stateError} timestamp={state?.telemetry_captured_at} />
          <SensorCard label="Soil Moisture" unavailable="Sensor not installed" />
        </div>
      </section>
      <section aria-labelledby="equipment-title">
        <h2 id="equipment-title" className="text-headline-sm font-headline-sm mb-3">{t("Equipment")}</h2>
        <p className="text-on-surface-variant mb-4">{t("States are reported by the ESP32; they do not measure physical load operation.")}</p>
        {!canControl && <p className="mb-4 rounded-lg bg-surface-container-low p-3">{t("Guest access is read-only. Sign in with a team account to control equipment.")} <Link href="/api/auth/signout" className="text-primary underline">{t("Sign in")}</Link></p>}
        <div className="grid md:grid-cols-3 gap-4">
          {ACTUATORS.map(actuator => {
            const command = commands[actuator], value = state?.[actuator];
            const sending = command?.phase === "sending";
            return <article key={actuator} className="rounded-xl bg-surface-container-lowest p-5 shadow-sm flex flex-col">
              <h3 className="text-headline-sm font-headline-sm">{t(actuatorLabels[actuator])}</h3>
              <p className="my-4 text-headline-lg font-semibold">{typeof value === "boolean" ? t(value ? "ON" : "OFF") : t("Unknown")}
                {state && health !== "active" && <span className="ml-2 text-label-md text-on-surface-variant">{t("Last reported")}</span>}</p>
              <p className="text-on-surface-variant mb-4 flex-1">{t(actuator === "pump"
                ? "Relay switching verified. Water pump/load operation remains unverified. The pump output automatically turns OFF after approximately 10 seconds."
                : "Physical equipment operation remains unverified.")}</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={t(actuatorLabels[actuator])}>
                <button type="button" disabled={!canControl || sending || health !== "active" || command?.phase === "accepted"}
                  onClick={() => { void send(actuator, true); }} className="min-h-11 rounded-lg bg-primary text-on-primary font-semibold disabled:opacity-40 disabled:cursor-not-allowed">{t("Turn ON")}</button>
                <button type="button" disabled={!canControl || sending} onClick={() => { void send(actuator, false); }}
                  className="min-h-11 rounded-lg border border-outline text-primary font-semibold disabled:opacity-40 disabled:cursor-not-allowed">{t("Turn OFF")}</button>
              </div>
              {health !== "active" && canControl && <p className="mt-3 text-on-surface-variant">{t("ON requires recent device state. OFF remains available.")}</p>}
              <div role="status" aria-live="polite" className="mt-3 text-body-md min-h-10">
                {command && <p className="font-semibold">{t("Last command")}: {t(command.pending.target ? "ON" : "OFF")}</p>}
                {command && <p className={command.phase === "error" || command.phase === "unconfirmed" ? "text-error" : "text-on-surface-variant"}>{t(command.message)}</p>}
                {command?.receipt && <p className="text-label-sm text-on-surface-variant mt-1 break-all">{t("Command")}: {command.receipt.command_id}</p>}
              </div>
            </article>;
          })}
        </div>
      </section>
      <section aria-labelledby="ai-title" className="bg-surface-container-lowest rounded-xl p-5 sm:p-6 shadow-sm">
        <h2 id="ai-title" className="text-headline-sm font-headline-sm">{t("AI / Mushroom Health")}</h2>
        <p className="text-on-surface-variant mt-2">{t("Latest stored detection. AI checks are suggestions; inspect the crop before acting.")}</p>
        {aiLoading && <p role="status" className="mt-4">{t("Loading AI result…")}</p>}
        {aiError && <p role="status" className="mt-4 text-on-surface-variant">{t(aiError)} {detection && t("Showing the last retrieved result.")}</p>}
        {detection && <DetectionCard detection={detection} />}
      </section>
    </div>
  );
}

function SensorCard({ label, unit, value, loading, stale, timestamp, unavailable }: {
  label: string; unit?: string; value?: number | null; loading?: boolean; stale?: boolean;
  timestamp?: string | null; unavailable?: string;
}) {
  const t = useT();
  const hasValue = typeof value === "number" && Number.isFinite(value) && !!timestamp;
  return <article className="bg-surface-container-lowest rounded-xl p-5 shadow-sm">
    <h3 className="text-label-md text-on-surface-variant font-semibold">{t(label)}</h3>
    <p className={`mt-4 mb-3 ${hasValue && !loading ? "text-headline-hero-mobile tabular-nums" : "text-headline-sm"}`}>
      {unavailable ? t("Unavailable") : loading ? t("Loading…") : hasValue ? <>{value.toFixed(1)} <span className="text-unit-hero text-on-surface-variant">{unit}</span></> : t("Unavailable")}
    </p>
    <p className="text-on-surface-variant">{unavailable ? t(unavailable) : !loading && hasValue ? <>{stale && <strong>{t("Stale reading")} · </strong>}{dateText(timestamp)}</> : t("Waiting for valid telemetry.")}</p>
  </article>;
}

function DetectionCard({ detection }: { detection: Detection }) {
  const t = useT();
  const unavailable = detection.verdict === "camera_error" || detection.verdict === "no_detection";
  const chip = detection.severity === "RED" ? "bg-error-container text-on-error-container" : detection.severity === "AMBER"
    ? "bg-secondary-fixed text-on-secondary-fixed" : detection.severity === "GREEN" ? "bg-tertiary-fixed text-tertiary" : "bg-surface-variant text-on-surface-variant";
  return <>
    <div className="flex flex-wrap items-center gap-3 mt-4">
      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-semibold ${chip}`}>
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{unavailable ? "center_focus_weak" : detection.severity === "GREEN" ? "check_circle" : "warning"}</span>
        {t(detection.verdict === "contamination_suspected"
        ? "Contamination suspected" : detection.verdict === "no_contamination_seen" ? "No contamination seen" : "Could not inspect")}</span>
      <span className="text-on-surface-variant">{t("Camera")}: {detection.camera_id}</span>
    </div>
    <p className="mt-3">{t(detection.message)}</p>
    <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
      <div><dt className="text-on-surface-variant">{t("Captured")}</dt><dd>{dateText(detection.captured_at)}</dd></div>
      <div><dt className="text-on-surface-variant">{t("Contamination confidence")}</dt><dd>{unavailable ? t("Unavailable") : `${(detection.max_contaminated_conf * 100).toFixed(1)}%`}</dd></div>
      <div><dt className="text-on-surface-variant">{t("Highest detection confidence")}</dt><dd>{unavailable ? t("Unavailable") : `${(detection.max_conf * 100).toFixed(1)}%`}</dd></div>
      <div><dt className="text-on-surface-variant">{t("Detected bags")}</dt><dd>{detection.n_healthy} {t("healthy")}, {detection.n_contaminated} {t("flagged")}</dd></div>
    </dl>
  </>;
}
