"use client";

import { useState } from "react";
import { STATUS_DOT } from "@/components/Shell";
import { TrendChart, type Range } from "@/components/TrendChart";
import { useT, useTD } from "@/lib/i18n";
import { useCountdown, useStore } from "@/lib/store";
import type { Override } from "@/lib/types";

const RANGES: Range[] = ["6 h", "24 h", "7 d"];

export default function ClimatePage() {
  const t = useT();
  const td = useTD();
  const { reading, settings, activity, updatedAgo, live, setOverride, saveTargets, rooms, room, setRoom, statusOf } = useStore();
  const [range, setRange] = useState<Range>("24 h");
  const [low, setLow] = useState(settings.rh_low);
  const [high, setHigh] = useState(settings.rh_high);
  const [tmax, setTmax] = useState(settings.temp_max);
  const [shownRoom, setShownRoom] = useState(room.id);
  if (shownRoom !== room.id) {
    // switching rooms loads that room's saved targets into the editor
    setShownRoom(room.id);
    setLow(settings.rh_low);
    setHigh(settings.rh_high);
    setTmax(settings.temp_max);
  }
  const [saved, setSaved] = useState(false);
  const dirty = low !== settings.rh_low || high !== settings.rh_high || tmax !== settings.temp_max;
  const offline = updatedAgo > 90;
  const pos = (v: number) => `${((v - 70) / 30) * 100}%`;

  function save() {
    saveTargets({ rh_low: low, rh_high: high, temp_max: tmax });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="flex flex-col w-full">
      <div className="px-4 md:px-space-lg py-space-md flex flex-col gap-space-md max-w-[1360px] mx-auto w-full">
        <h1 className="sr-only">{t("Climate")}</h1>
        <div className="flex flex-wrap items-center gap-space-xs" role="tablist" aria-label={t("Rooms")}>
          {rooms.map((r) => (
            <button key={r.id} role="tab" aria-selected={r.id === room.id} type="button" onClick={() => setRoom(r.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-label-md text-label-md transition-all ${r.id === room.id ? "bg-primary-container text-on-primary shadow-sm font-semibold" : "bg-surface-container-lowest text-on-surface-variant hover:text-on-surface shadow-sm"}`}>
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[statusOf(r.id)]}`} />{t(r.name)}
            </button>
          ))}
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-space-sm px-space-md flex flex-wrap items-center justify-between gap-space-md shadow-sm">
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="relative flex h-2.5 w-2.5">
                {!offline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75" />}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${offline ? "bg-outline" : "bg-tertiary"}`} />
              </span>
              <span className="font-label-md text-label-md text-on-surface font-semibold tracking-wide">{offline ? t("Room offline") : t("Room online")}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">· {t("last report {n} s ago", { n: updatedAgo })}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5">
              <span aria-hidden="true" className="material-symbols-outlined text-outline text-[16px]">memory</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">{reading.device}</span>
            </div>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant">{live ? t("Live readings from the room") : t("Demo: simulated readings")}</span>
        </div>

        <div className="grid grid-cols-12 gap-space-lg items-start">
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-col gap-space-md">
              <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-xs">
                <div>
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest block">{t(room.name)}</span>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">{t("Climate")}</h2>
                </div>
                <div className="flex items-center bg-surface-container-low p-1 rounded-lg gap-1">
                  {RANGES.map((r) => (
                    <button key={r} onClick={() => setRange(r)} type="button"
                      className={r === range ? "px-3 py-1 font-label-md text-label-md rounded bg-surface-container-lowest text-primary font-bold shadow-sm" : "px-3 py-1 font-label-md text-label-md rounded text-on-surface-variant hover:text-on-surface transition-colors"}>
                      {t(r)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm pt-space-xs">
                <Stat dot="bg-primary-container" label={t("Air temp (°C)")} sub={t("Left axis")} value={reading.temp_c.toFixed(1)} unit="°C" />
                <Stat dot="bg-tertiary" label={t("Relative humidity")} sub={t("Right axis")} value={reading.rh.toFixed(1)} unit="% RH" />
                <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-3.5 h-2 rounded bg-tertiary-fixed opacity-80" />
                    <span className="font-label-sm text-label-sm text-on-surface-variant font-medium">{t("Target humidity")}</span>
                  </div>
                  <span className="font-label-md text-label-md text-on-surface font-semibold">{settings.rh_low}% – {settings.rh_high}% RH</span>
                  <span className="font-label-sm text-label-sm text-outline">{t("Ventilate above {v} °C", { v: settings.temp_max })}</span>
                </div>
              </div>

              <div className="w-full h-72 bg-surface-container-lowest rounded-lg relative overflow-hidden flex flex-col justify-between pt-4 pb-2">
                <div className="px-10 h-full"><TrendChart roomId={room.id} range={range} temp={reading.temp_c} rh={reading.rh} rhLow={settings.rh_low} rhHigh={settings.rh_high} tempMax={settings.temp_max} axes bandLabel={`${t("Target band")} ${settings.rh_low}–${settings.rh_high}%`} /></div>
                <div className="flex justify-between items-center px-10 text-on-surface-variant font-label-sm text-label-sm border-t border-surface-container-high pt-2">
                  <span>{t(range === "7 d" ? "7 days ago" : range === "6 h" ? "6 h ago" : "24 h ago")}</span>
                  <span className="hidden sm:flex items-center gap-1 font-bold text-secondary"><span aria-hidden="true" className="material-symbols-outlined text-[14px]">mode_fan</span>{t("Fan on")}</span>
                  <span className="hidden sm:flex items-center gap-1 font-bold text-primary-container"><span aria-hidden="true" className="material-symbols-outlined text-[14px]">water_drop</span>{t("Mister on")}</span>
                  <span className="text-on-surface font-semibold">{t("Now")}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-outline font-label-sm text-label-sm bg-surface-container-low px-space-md py-1.5 rounded-lg">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="material-symbols-outlined text-[15px] text-tertiary">info</span>
                  {t("The mister runs when humidity drops below {a}%, and stops at {b}%.", { a: settings.rh_low, b: settings.rh_high })}
                </span>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className="material-symbols-outlined text-primary text-[20px]">history_toggle_off</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">{t("Fan and mister activity")}</h3>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant font-mono">{t("Today ({n})", { n: activity.length })}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
                      <th className="py-2.5 px-space-md rounded-l-lg font-semibold">{t("Time")}</th>
                      <th className="py-2.5 px-space-sm font-semibold">{t("Event")}</th>
                      <th className="py-2.5 px-space-md rounded-r-lg font-semibold">{t("Reason")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container font-body-md text-body-md">
                    {activity.slice(0, 12).map((a, i) => (
                      <tr key={i} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-3 px-space-md font-label-md text-label-md text-on-surface font-mono font-medium">{a.time}</td>
                        <td className="py-3 px-space-sm whitespace-nowrap">
                          {a.kind === "fan" && a.on ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm font-bold">
                              <span aria-hidden="true" className="material-symbols-outlined text-[13px]">mode_fan</span>{t(a.event)}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-label-sm text-label-sm ${a.on ? "bg-surface-container-high text-primary-container font-bold" : "bg-surface-container text-on-surface font-semibold"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${a.on ? "bg-primary-container" : "bg-outline"}`} />{t(a.event)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-space-md text-on-surface-variant">{td(a.reason)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-space-sm py-1 flex items-center gap-2 text-outline">
              <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-outline">visibility</span>
              <span className="font-label-sm text-label-sm italic">{t("The fan ventilates toward the outside air temperature. It cannot cool below it.")}</span>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 flex flex-col gap-space-md">
            <div className="bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">{t("Targets")} · {t(room.name)}</h3>
                <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-medium">{t("Auto mode")}</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5">
                    <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-tertiary">humidity_mid</span>{t("Humidity target")}
                  </span>
                  <span className="bg-surface-container-low px-2 py-0.5 rounded font-mono font-bold text-tertiary font-label-md text-label-md">{low}% – {high}%</span>
                </div>
                <div className="relative py-4 px-1 select-none">
                  <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden relative">
                    <div className="absolute h-full bg-tertiary rounded-full" style={{ left: pos(low), right: `calc(100% - ${pos(high)})` }} />
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-surface-container-lowest shadow-md flex items-center justify-center" style={{ left: pos(reading.rh) }} title={t("Humidity now")}>
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-container" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-space-sm">
                  <Stepper label={t("Mister on below")} value={low} unit="%" step={1} min={70} max={high - 2} onChange={setLow} />
                  <Stepper label={t("Mister off at")} value={high} unit="%" step={1} min={low + 2} max={98} onChange={setHigh} />
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2 border-t border-surface-container">
                <span className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-secondary">mode_fan</span>{t("Ventilate above")}
                </span>
                <Stepper label="" value={tmax} unit="°C" step={0.5} min={24} max={34} onChange={setTmax} big />
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button onClick={save} disabled={!dirty} type="button"
                  className="w-full h-12 bg-primary-container text-on-primary font-label-md text-label-md font-bold rounded-lg flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{saved ? "task_alt" : "save"}</span>
                  {saved ? t("Saved") : t("Save targets")}
                </button>
                <p className="font-label-sm text-label-sm text-on-surface-variant text-center leading-normal px-2">{t("The room applies new targets within 30 seconds.")}</p>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">{t("Manual control")}</h3>
                <span aria-hidden="true" className="material-symbols-outlined text-outline text-[18px]">handyman</span>
              </div>
              <Control label={t("Fan")} icon="mode_fan" value={settings.fan_override} until={settings.fan_until} isOn={reading.fan_on} onPick={(v) => setOverride("fan", v)} />
              <Control label={t("Mister")} icon="water_drop" value={settings.mist_override} until={settings.mist_until} isOn={reading.mist_on} onPick={(v) => setOverride("mist", v)} />
              <div className="flex items-start gap-2 bg-surface-container-low rounded-lg p-space-sm">
                <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-outline mt-0.5">info</span>
                <p className="font-label-sm text-label-sm text-on-surface-variant">{t("Manual control ends by itself after 10 minutes, so a forgotten button cannot leave the room in the wrong state.")}</p>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-col gap-space-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">{t("Water tank")}</h3>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{t("Float switch")}</span>
              </div>
              <div className="flex items-center gap-space-md bg-surface-container-low rounded-lg p-space-md">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${reading.water_ok ? "bg-tertiary-fixed text-tertiary" : "bg-error-container text-on-error-container"}`}>
                  <span aria-hidden="true" className="material-symbols-outlined text-[26px]">{reading.water_ok ? "water_full" : "water_loss"}</span>
                </div>
                <div>
                  <span className={`font-headline-md text-headline-md font-bold ${reading.water_ok ? "text-tertiary" : "text-error"}`}>{reading.water_ok ? t("OK") : t("Low")}</span>
                  <p className="font-label-sm text-label-sm text-on-surface-variant">{reading.water_ok ? t("The mister can run.") : t("Mister paused until refilled.")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ dot, label, sub, value, unit }: { dot: string; label: string; sub: string; value: string; unit: string }) {
  return (
    <div className="bg-surface-container-low rounded-lg p-space-sm flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dot}`} />
          <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>
        </div>
        <span className="font-label-sm text-label-sm text-outline">{sub}</span>
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="font-headline-md text-headline-md text-on-surface font-bold tabular-nums">{value}</span>
        <span className="font-unit-hero text-unit-hero text-on-surface-variant">{unit}</span>
      </div>
    </div>
  );
}

function Stepper({ label, value, unit, step, min, max, onChange, big }: {
  label: string; value: number; unit: string; step: number; min: number; max: number; onChange: (v: number) => void; big?: boolean;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="font-label-sm text-label-sm text-on-surface-variant">{label}</span>}
      <div className="flex items-center justify-between bg-surface-container-low p-2 rounded-lg">
        <button type="button" onClick={() => onChange(Math.max(min, +(value - step).toFixed(1)))} className={`w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors shadow-sm`} aria-label={t("Decrease")}>
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">remove</span>
        </button>
        <div className="flex items-baseline gap-1">
          <span className={`${big ? "font-headline-md text-headline-md" : "font-headline-sm text-headline-sm"} font-bold text-on-surface font-mono`}>{big ? value.toFixed(1) : value}</span>
          <span className="font-unit-hero text-unit-hero text-on-surface-variant font-medium">{unit}</span>
        </div>
        <button type="button" onClick={() => onChange(Math.min(max, +(value + step).toFixed(1)))} className={`w-10 h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors shadow-sm`} aria-label={t("Increase")}>
          <span aria-hidden="true" className="material-symbols-outlined text-[20px]">add</span>
        </button>
      </div>
    </div>
  );
}

function Control({ label, icon, value, until, isOn, onPick }: {
  label: string; icon: string; value: Override; until: number | null; isOn: boolean; onPick: (v: Override) => void;
}) {
  const left = useCountdown(until);
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between font-label-md text-label-md">
        <span className="text-on-surface font-medium flex items-center gap-1.5">
          <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-on-surface-variant">{icon}</span>{label}
          <span className="font-label-sm text-label-sm text-on-surface-variant">· {isOn ? t("on now") : t("off now")}</span>
        </span>
        <span className={`font-label-sm text-label-sm font-bold uppercase tracking-wider ${value === "auto" ? "text-tertiary" : "text-secondary"}`}>{value === "auto" ? t("Automatic") : t("Overridden")}</span>
      </div>
      <div className="grid grid-cols-3 bg-surface-container-low p-1 rounded-lg gap-1">
        {(["auto", "on", "off"] as Override[]).map((v) => (
          <button key={v} onClick={() => onPick(v)} type="button"
            className={`py-2 rounded font-label-md text-label-md capitalize transition-colors ${value === v ? (v === "auto" ? "bg-surface-container-lowest text-primary font-bold shadow-sm" : "bg-secondary-container text-on-secondary-fixed font-bold shadow-sm") : "text-on-surface-variant hover:text-on-surface"}`}>
            {v === "auto" ? t("Auto") : v === "on" ? t("On") : t("Off")}
          </button>
        ))}
      </div>
      {value !== "auto" && left && (
        <div className="flex items-center gap-1.5 bg-secondary-fixed text-on-secondary-fixed rounded px-2 py-1 font-label-sm text-label-sm font-mono">
          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">timer</span>
          {t(value === "on" ? "On for 10 min · back to Auto in {left}" : "Off for 10 min · back to Auto in {left}", { left })}
        </div>
      )}
    </div>
  );
}
