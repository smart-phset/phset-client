"use client";

import { useEffect, useRef, useState } from "react";
import { useLatestAIDetectionState } from "@/features/ai-alerts/aiDetectionApi";
import { AISeverityBadge } from "@/features/ai-alerts/AISeverityBadge";
import { isFreshDetection } from "@/features/ai-alerts/aiAlertTransitions";
import { useT } from "@/lib/i18n";
import { ActuatorCard } from "./ActuatorSwitch";
import { actuatorControl, expireActuatorCommand } from "@/lib/actuator-controls";
import { ACTUATORS, POLL_MS, browserJson, observeCommand, acceptCommand, freshness, MonitoringError,
  type Actuator, type CommandReceipt, type CommandStatus, type Detection, type MonitorSnapshot, type PendingCommand } from "@/lib/monitoring";
import { startMonitoringPoll } from "@/lib/monitoring-poll";

type CommandStatuses = Partial<Record<Actuator, CommandStatus>>;
const statusLabels = { active: "ONLINE", stale: "STALE", offline: "OFFLINE", unavailable: "Unavailable" };
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
  const ai = useLatestAIDetectionState();
  const detection = ai.data?.detection ?? null;
  const aiError = ai.isError ? "Detection metadata unavailable." : null;
  const aiLoading = ai.isLoading || ai.isUninitialized;
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
              if (command) current[actuator] = observeCommand(command, next.state, actuator, Date.now());
            }
            commandsRef.current = current; setCommands(current);
          } catch (error) {
            if (!signal.aborted && mounted.current) setStateError(errorMessage(error));
          } finally { if (!signal.aborted && mounted.current) setLoading(false); }
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
      if (command) {
        const next = expireActuatorCommand(command, now);
        if (next !== command) { current[actuator] = next; changed = true; }
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
    // Ref guard closes the gap before React renders the disabled switch.
    if (commandRequests.current[actuator] || actuatorControl(state?.[actuator], health, canControl, commandsRef.current[actuator]).disabled) return;
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
      update(acceptCommand(commandsRef.current[actuator] ?? { phase: "sending", message: "Sending command…", pending }, receipt));
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
        {!canControl && <div className="mb-4 rounded-lg bg-surface-container-low p-3">{t("Guest access is read-only. Sign in with a team account to control equipment.")} <form action="/api/auth/signout" method="post" className="inline"><button type="submit" className="text-primary underline">{t("Sign in")}</button></form></div>}
        <div className="grid md:grid-cols-3 gap-4">
          {ACTUATORS.map(actuator => <ActuatorCard key={actuator} actuator={actuator}
            value={state?.[actuator]} health={health} canControl={canControl} command={commands[actuator]}
            onChange={on => { void send(actuator, on); }} />)}
        </div>
      </section>
      <section aria-labelledby="ai-title" className="bg-surface-container-lowest rounded-xl p-5 sm:p-6 shadow-sm">
        <h2 id="ai-title" className="text-headline-sm font-headline-sm">{t("AI / Mushroom Health")}</h2>
        <p className="text-on-surface-variant mt-2">{t("Latest stored detection. AI checks are suggestions; inspect the crop before acting.")}</p>
        {aiLoading && <p role="status" className="mt-4">{t("Loading AI result…")}</p>}
        {aiError && <p role="status" className="mt-4 text-on-surface-variant">{t(aiError)} {detection && t("Showing the last retrieved result.")}</p>}
        <AISeverityBadge severity={!aiError && detection && now !== null && isFreshDetection(detection, now) ? detection.severity : "GREY"} />
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
