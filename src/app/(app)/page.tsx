"use client";

import Link from "next/link";
import { ScanPhoto } from "@/components/ScanPhoto";
import { STATUS_DOT } from "@/components/Shell";
import { TrendChart } from "@/components/TrendChart";
import { LEVEL_CLASS, LEVEL_TEXT, cameraName, hhmm, levelOf, roomName } from "@/lib/data";
import { useT, useTD } from "@/lib/i18n";
import { useStore, type RoomStatus } from "@/lib/store";
import type { Alert } from "@/lib/types";

const ALERT_ICON: Record<Alert["kind"], string> = { mould: "warning", climate: "humidity_low", device: "cloud_off" };

const STATUS: Record<RoomStatus, { chip: string; icon: string; label: string }> = {
  ok: { chip: "bg-tertiary-fixed text-tertiary", icon: "check_circle", label: "All good" },
  check: { chip: "bg-secondary-fixed text-on-secondary-fixed", icon: "warning", label: "Please check" },
  mould: { chip: "bg-error-container text-on-error-container", icon: "report", label: "Likely mould" },
  climate: { chip: "bg-secondary-fixed text-on-secondary-fixed", icon: "thermostat", label: "Check climate" },
  offline: { chip: "bg-surface-variant text-on-surface-variant", icon: "cloud_off", label: "Room offline" },
};

export default function Overview() {
  const t = useT();
  const td = useTD();
  const { rooms, room, setRoom, reading, readings, settings, statusOf, scans, alerts, openAlerts } = useStore();
  const roomScans = scans.filter((s) => s.room === room.id);
  const last = roomScans[0];
  const lastLevel = last ? levelOf(last) : null;
  const status = statusOf(room.id);
  const tempOk = reading.temp_c <= settings.temp_max;
  const rhOk = reading.rh >= settings.rh_low - 1 && reading.rh <= settings.rh_high + 1;
  const needAttention = rooms.filter((r) => statusOf(r.id) !== "ok").length;

  const lastText = !last ? t("No AI check yet") : lastLevel === "green" ? t("found no mould") : lastLevel === "grey" ? t("could not check the photo") : t("flagged a bag");
  const title = {
    ok: t("Climate is in range. Last AI check {result} ({time}).", { result: lastText, time: last ? hhmm(last.time) : "–" }),
    check: t("The AI flagged a bag. Please take a look."),
    mould: t("The AI found likely mould. Remove the bag now."),
    climate: !tempOk ? (reading.fan_on ? t("Temperature is above target. The fan is ventilating.") : t("Temperature is above target. The fan is off.")) : t("Humidity is outside the target band."),
    offline: t("This room has not reported recently."),
  }[status];
  const body = {
    ok: settings.fan_override === "auto" && settings.mist_override === "auto"
      ? t("{room} is within its targets. Fan {fan}, mister {mist}, both in auto mode.", { room: t(room.name), fan: reading.fan_on ? t("ventilating") : t("idle"), mist: reading.mist_on ? t("running") : t("off") })
      : t("{room} is within its targets. Manual control is on; it returns to auto after 10 minutes.", { room: t(room.name) }),
    check: t("Open the alert to see the marked area."),
    mould: t("Open the alert to see the photo and what to do."),
    climate: !tempOk ? t("The fan ventilates toward the outside air, which can be warm too. Check the room if it stays hot.") : t("The room is adjusting on its own. Manual control is on the Climate page."),
    offline: t("Climate control keeps running on the room's controller. Check its power and Wi-Fi."),
  }[status];

  return (
    <div className="flex flex-col w-full">
      <div className="max-w-[1280px] w-full mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
              <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary">grid_view</span>{t("All rooms")}
            </h2>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {needAttention === 0 ? t("All rooms are fine") : t("{n} of {m} rooms need attention", { n: needAttention, m: rooms.length })}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {rooms.map((r) => {
              const st = statusOf(r.id);
              const rd = readings[r.id];
              const open = openAlerts.filter((a) => a.room === r.id).length;
              const sel = r.id === room.id;
              return (
                <button key={r.id} type="button" onClick={() => setRoom(r.id)} aria-pressed={sel}
                  className={`text-left bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col gap-3 transition-all ${sel ? "ring-2 ring-primary-container" : "hover:shadow-md"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[st]}`} />{t(r.name)}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${STATUS[st].chip}`}>
                      <span aria-hidden="true" className="material-symbols-outlined text-[14px]">{STATUS[st].icon}</span>{t(STATUS[st].label)}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-4 font-label-md text-label-md text-on-surface-variant tabular-nums">
                    <span><span className="font-headline-sm text-headline-sm text-on-surface">{rd.temp_c.toFixed(1)}</span> °C</span>
                    <span><span className="font-headline-sm text-headline-sm text-on-surface">{rd.rh.toFixed(0)}</span> % RH</span>
                    <span className="ml-auto font-label-sm text-label-sm">{open ? t(open === 1 ? "1 open alert" : "{n} open alerts", { n: open }) : t("{n} bags", { n: r.bags.toLocaleString() })}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full font-label-md text-label-md ${STATUS[status].chip}`}>
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>{STATUS[status].icon}</span>
                  <span className="font-semibold">{t(room.name)} · {t(STATUS[status].label)}</span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${status === "offline" ? "bg-outline" : "bg-tertiary"}`} />
                  {t("Reports every 30 s")}
                </span>
              </div>
              <div className="space-y-2 max-w-2xl">
                <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{title}</h1>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">{body}</p>
              </div>
            </div>
            <div className="mt-6 pt-5 bg-surface-container-low rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                [t("Target temp"), `≤ ${settings.temp_max.toFixed(1)}°C`],
                [t("Target RH"), `${settings.rh_low} – ${settings.rh_high}%`],
                [t("Fan"), settings.fan_override === "auto" ? t("Auto") : t("Manual")],
                [t("Mister"), settings.mist_override === "auto" ? t("Auto") : t("Manual")],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{k}</span>
                  <span className="font-headline-sm text-headline-sm text-on-surface tabular-nums mt-0.5">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-secondary text-[20px]">center_focus_weak</span>
                <span className="font-headline-sm text-headline-sm text-on-surface">{t("Last AI check")}</span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant tabular-nums">{last ? last.time.slice(11, 19) : ""}</span>
            </div>
            {last && lastLevel ? (
              <Link href={`/scan/${last.id}`} className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-surface-container-high my-2 group block">
                <ScanPhoto scan={last} labels={false} />
                <div className="absolute inset-0 bg-gradient-to-t from-on-surface/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded font-label-md text-label-md shadow-sm ${LEVEL_CLASS[lastLevel].chip}`}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>{LEVEL_TEXT[lastLevel].icon}</span>
                    <span className="font-semibold">{t(LEVEL_TEXT[lastLevel].short)}</span>
                  </div>
                  <span className="font-label-sm text-label-sm text-on-primary bg-on-surface/60 px-2 py-0.5 rounded backdrop-blur-sm">{t(cameraName(last.camera))}</span>
                </div>
              </Link>
            ) : (
              <div className="w-full aspect-[4/3] rounded-lg bg-surface-container-low my-2 flex flex-col items-center justify-center gap-2 text-on-surface-variant">
                <span aria-hidden="true" className="material-symbols-outlined text-[32px]">photo_camera</span>
                <span className="font-body-md text-body-md">{t("No photos for this room yet")}</span>
              </div>
            )}
            <div className="flex flex-col gap-3 pt-2">
              {last && lastLevel && lastLevel === "grey" && (
                <div className="font-label-sm text-label-sm text-on-surface-variant">{t("The last photo could not be checked. Take another, closer photo.")}</div>
              )}
              {last && lastLevel && lastLevel !== "grey" && (
                <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
                  <span>{lastLevel === "green" ? t("Bags checked") : t("Highest mould confidence")}</span>
                  <span className="font-semibold text-on-surface tabular-nums">
                    {lastLevel === "green" ? t("{n} · none flagged", { n: last.n_healthy }) : `${Math.round(last.max_contaminated_conf * 100)}%`}
                  </span>
                </div>
              )}
              <Link href="/scan" className="w-full h-12 bg-secondary-container hover:bg-secondary-fixed text-on-secondary-container font-headline-sm text-headline-sm rounded-lg flex items-center justify-center gap-2 transition-colors active:scale-[0.99]">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>photo_camera</span>
                <span>{t("Take photo")}</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Tile label={t("Temperature")} dot={tempOk ? "bg-tertiary" : "bg-secondary"}>
            <Big value={reading.temp_c.toFixed(1)} unit="°C" />
            <div className="space-y-1.5">
              <span className="font-label-sm text-label-sm text-on-surface-variant">{t("Target: ≤ {v} °C", { v: settings.temp_max.toFixed(1) })}</span>
              <svg className="w-full h-6 text-primary-container" fill="none" preserveAspectRatio="none" viewBox="0 0 100 24">
                <path d="M0,16 Q15,18 30,14 T60,11 T85,15 L100,10" stroke="currentColor" strokeLinecap="round" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          </Tile>
          <Tile label={t("Humidity")} dot={rhOk ? "bg-tertiary" : "bg-secondary"}>
            <Big value={reading.rh.toFixed(0)} unit="% RH" />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant gap-1">
                <span>{t("Target: {a} – {b}%", { a: settings.rh_low, b: settings.rh_high })}</span>
                <span className={`font-semibold ${rhOk ? "text-tertiary" : "text-secondary"}`}>{rhOk ? t("In band") : t("Adjusting")}</span>
              </div>
              <div className="h-2 w-full bg-surface-container-high rounded-full relative overflow-hidden">
                <div className="absolute top-0 bottom-0 bg-tertiary-fixed rounded-full" style={{ left: `${((settings.rh_low - 70) / 30) * 100}%`, right: `${100 - ((settings.rh_high - 70) / 30) * 100}%` }} />
                <div className="absolute top-0 bottom-0 w-2 -ml-1 bg-tertiary-container rounded-full transition-all" style={{ left: `${Math.min(100, Math.max(0, ((reading.rh - 70) / 30) * 100))}%` }} />
              </div>
            </div>
          </Tile>
          <Tile label={t("Fan")} badge={settings.fan_override === "auto" ? t("Auto") : t("Manual")}>
            <div className="py-3 flex items-baseline gap-1.5">
              <span className={`font-headline-hero-mobile text-headline-hero-mobile tracking-tight ${reading.fan_on ? "text-on-surface" : "text-on-surface-variant"}`}>{reading.fan_on ? t("On") : t("Off")}</span>
              {reading.fan_on && <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-tertiary animate-spin">mode_fan</span>}
            </div>
            <div className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">air</span>
              <span>{reading.fan_on ? t("ventilating") : t("idle")}</span>
            </div>
          </Tile>
          <Tile label={t("Mister")} badge={settings.mist_override === "auto" ? t("Auto") : t("Manual")}>
            <div className="py-3 flex items-baseline gap-1">
              <span className={`font-headline-hero-mobile text-headline-hero-mobile tracking-tight ${reading.mist_on ? "text-on-surface" : "text-on-surface-variant"}`}>{reading.mist_on ? t("On") : t("Off")}</span>
            </div>
            <div className="font-label-sm text-label-sm text-on-surface-variant truncate">{reading.mist_on ? t("adding humidity") : t("humidity in band")}</div>
          </Tile>
          <Tile label={t("Water tank")} icon="water_full">
            <div className="py-3 flex items-baseline gap-1">
              <span className="font-headline-hero-mobile text-headline-hero-mobile text-on-surface tracking-tight">{reading.water_ok ? t("OK") : t("Low")}</span>
            </div>
            <div className="font-label-sm text-label-sm text-on-surface-variant truncate">{t("Float switch")}</div>
          </Tile>
          <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col justify-between opacity-85">
            <div className="flex items-center justify-between">
              <span className="font-label-md text-label-md text-on-surface-variant font-medium">{t("CO₂ level")}</span>
              <span aria-hidden="true" className="material-symbols-outlined text-outline text-[16px]">sensors_off</span>
            </div>
            <div className="py-3 flex items-baseline">
              <span className="font-headline-sm text-headline-sm text-on-surface-variant font-semibold">{t("Not measured")}</span>
            </div>
            <div className="font-label-sm text-label-sm text-outline truncate" title={t("No CO₂ sensor in this prototype")}>{t("No CO₂ sensor in this prototype")}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-6 shadow-sm flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("Climate history (24 hours)")} · {t(room.name)}</h2>
                <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">{t("Demo trend ending at the live reading. Real history appears when the room's controller is connected.")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 font-label-sm text-label-sm text-on-surface-variant">
                <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-primary-container rounded" /><span>{t("Temp (°C)")}</span></div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-tertiary-container rounded" /><span>{t("Humidity (% RH)")}</span></div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-tertiary-fixed opacity-60 rounded" /><span>{t("Target band")}</span></div>
              </div>
            </div>
            <div className="relative w-full h-64 sm:h-72 my-2">
              <TrendChart roomId={room.id} range="24 h" temp={reading.temp_c} rh={reading.rh} rhLow={settings.rh_low} rhHigh={settings.rh_high} tempMax={settings.temp_max} />
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <div className="flex justify-between items-center text-on-surface-variant font-label-sm text-label-sm tabular-nums">
                <span>{t("24 h ago")}</span>
                {["18:00", "22:00", "02:00", "06:00", "10:00"].map((x) => <span key={x} className="hidden sm:inline">{x}</span>)}
                <span className="font-semibold text-on-surface">{t("Now")}</span>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm border-t border-outline-variant/30 pt-2 gap-2">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-tertiary">water_drop</span>
                  <span>{t("Shaded bars: mister running. Dashed yellow line: ventilation temperature.")}</span>
                </span>
                <Link href="/climate" className="text-primary font-semibold hover:underline whitespace-nowrap">{t("Climate details")}</Link>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-on-surface-variant text-[20px]">notifications_active</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("Recent alerts")}</h2>
              </div>
              <Link className="font-label-md text-label-md text-primary font-semibold hover:underline flex items-center" href="/alerts">{t("View all ({n})", { n: alerts.length })}</Link>
            </div>
            <div className="flex flex-col gap-3 py-1">
              {alerts.slice(0, 3).map((a) => (
                <Link key={a.id} href={a.scan_id ? `/scan/${a.scan_id}` : "/alerts"} className={`p-3 rounded-lg flex flex-col gap-1.5 ${a.level === "grey" ? "bg-surface-container-high" : "bg-surface-container-low"} hover:ring-1 hover:ring-outline-variant`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-label-sm text-label-sm font-semibold ${LEVEL_CLASS[a.level].chip}`}>
                      <span aria-hidden="true" className="material-symbols-outlined text-[14px]">{a.level === "red" ? "report" : ALERT_ICON[a.kind]}</span>
                      <span>{t(a.title)}</span>
                    </div>
                    <span className="font-label-sm text-label-sm text-on-surface-variant tabular-nums">{hhmm(a.time)}</span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface mt-0.5">{t(roomName(a.room))} · {td(a.detail)}</p>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {a.resolved_at ? t("Resolved {time} · {how}", { time: hhmm(a.resolved_at), how: t(a.resolution ?? "") }) : t("Open")}
                  </span>
                </Link>
              ))}
            </div>
            <div className="pt-3 border-t border-outline-variant/30 flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-on-surface-variant">{openAlerts.length === 0 ? t("No open alerts") : t("{n} open", { n: openAlerts.length })}</span>
              <Link href="/alerts" className="text-primary font-label-md text-label-md font-semibold hover:underline flex items-center gap-1">
                <span>{t("All alerts")}</span>
                <span aria-hidden="true" className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="py-4 text-center">
          <p className="font-label-sm text-label-sm text-on-surface-variant">{t("AI checks are suggestions. Confirm by looking at the bag.")}</p>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, dot, badge, icon, children }: { label: string; dot?: string; badge?: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between gap-1">
        <span className="font-label-md text-label-md text-on-surface-variant font-medium">{label}</span>
        {dot && <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />}
        {badge && <span className="inline-flex px-2 py-0.5 rounded bg-surface-container-high font-label-sm text-label-sm text-on-surface font-semibold">{badge}</span>}
        {icon && <span aria-hidden="true" className="material-symbols-outlined text-primary-container text-[18px]">{icon}</span>}
      </div>
      {children}
    </div>
  );
}

function Big({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="py-3 flex items-baseline gap-1">
      <span className="font-headline-hero-mobile text-headline-hero-mobile xl:font-headline-hero xl:text-headline-hero text-on-surface tabular-nums tracking-tight">{value}</span>
      <span className="font-unit-hero text-unit-hero text-on-surface-variant">{unit}</span>
    </div>
  );
}
