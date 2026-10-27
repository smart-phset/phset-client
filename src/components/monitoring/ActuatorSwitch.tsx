"use client";

import { useId } from "react";
import { useT } from "@/lib/i18n";
import type { Actuator, CommandStatus, Freshness } from "@/lib/monitoring";
import { actuatorControl } from "@/lib/actuator-controls";

interface ActuatorSwitchProps {
  label: string;
  reported: boolean | null;
  pending?: boolean;
  disabled?: boolean;
  describedBy?: string;
  onChange: (on: boolean) => void;
}

// Native button activation supplies Enter/Space support without duplicate key handlers.
// An unknown report renders an inert placeholder, not a falsely unchecked switch.
export function ActuatorSwitch({ label, reported, pending = false, disabled = false, describedBy, onChange }: ActuatorSwitchProps) {
  const t = useT();
  const unavailable = reported === null;
  return <button type="button" role={unavailable ? undefined : "switch"}
    aria-checked={unavailable ? undefined : reported} aria-busy={pending}
    aria-label={unavailable ? `${label}: ${t("Unknown")}` : label} aria-describedby={describedBy}
    disabled={disabled || pending || unavailable}
    onClick={() => { if (!disabled && !pending && reported !== null) onChange(!reported); }}
    className="inline-flex min-h-11 items-center gap-3 self-start rounded-full px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-not-allowed">
    <span aria-hidden="true" className={`relative inline-block h-10 w-20 shrink-0 rounded-full border transition-colors duration-200 motion-reduce:transition-none ${unavailable
      ? "border-dashed border-outline bg-surface-container-high" : reported ? "border-tertiary-container bg-tertiary-container" : "border-outline bg-outline"}`}>
      <span className={`absolute top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none ${unavailable ? "translate-x-6" : reported ? "translate-x-11" : "translate-x-1"}`}>
        {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-outline-variant border-t-primary motion-reduce:animate-none" />
          : unavailable ? <span className="text-on-surface-variant font-bold">?</span> : null}
      </span>
    </span>
    <span aria-hidden="true" className={`font-semibold ${unavailable ? "text-on-surface-variant" : reported ? "text-tertiary" : "text-on-surface-variant"}`}>
      {t(unavailable ? "Unknown" : reported ? "ON" : "OFF")}
    </span>
  </button>;
}

const labels: Record<Actuator, string> = { fan: "Fan", light: "Light", pump: "Water Pump" };
const icons: Record<Actuator, string> = { fan: "mode_fan", light: "lightbulb", pump: "water_drop" };
const descriptions: Record<Actuator, string> = {
  fan: "Ventilates the grow room.", light: "Controls grow-room lighting.",
  pump: "Automatically turns off after approximately 10 seconds.",
};

export function ActuatorCard({ actuator, value, health, canControl, command, onChange }: {
  actuator: Actuator; value: boolean | null | undefined; health: Freshness;
  canControl: boolean; command?: CommandStatus; onChange: (on: boolean) => void;
}) {
  const t = useT();
  const id = useId();
  const control = actuatorControl(value, health, canControl, command);
  const pendingLabel = command?.pending.target ? "Turning on…" : "Turning off…";
  const warning = command?.phase === "unconfirmed" || command?.phase === "error";
  return <article aria-labelledby={`${id}-label`} className="rounded-xl bg-surface-container-lowest p-5 shadow-sm border border-outline-variant/60 flex flex-col gap-4">
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className={`material-symbols-outlined rounded-xl p-2 ${control.reported ? "bg-tertiary-fixed text-tertiary" : "bg-surface-container-low text-on-surface-variant"}`}>{icons[actuator]}</span>
      <h3 id={`${id}-label`} className="text-headline-sm font-headline-sm">{t(labels[actuator])}</h3>
    </div>
    <p className="text-on-surface-variant">{t("Status")}: <strong className="text-on-surface">{t(control.reported === null ? "Unavailable" : control.reported ? "ON" : "OFF")}</strong></p>
    <ActuatorSwitch label={t(labels[actuator])} reported={control.reported} pending={control.pending}
      disabled={control.disabled} describedBy={`${id}-description ${id}-feedback`} onChange={onChange} />
    <div id={`${id}-description`} className="text-sm text-on-surface-variant flex-1 space-y-2">
      <p>{t(descriptions[actuator])}</p>
      {control.reported !== null && <p>{t("Reported by ESP32")}</p>}
      {control.reported === null && typeof value === "boolean" && <p>{t("Last reported")}: {t(value ? "ON" : "OFF")}</p>}
    </div>
    <div id={`${id}-feedback`} role="status" aria-live="polite" aria-atomic="true" className="min-h-12 text-sm space-y-2">
      {control.reason && <p className="text-on-surface-variant">{t(control.reason)}</p>}
      {control.pending && <p className="flex items-center gap-2 font-semibold text-primary">
        <span aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary motion-reduce:animate-none" />
        {t(pendingLabel)} <span className="font-normal">{t("Waiting for ESP32 confirmation.")}</span>
      </p>}
      {command && !control.pending && <p className={warning ? "rounded-lg bg-secondary-fixed p-3 text-on-secondary-fixed" : "text-on-surface-variant"}>{t(command.message)}</p>}
    </div>
  </article>;
}
