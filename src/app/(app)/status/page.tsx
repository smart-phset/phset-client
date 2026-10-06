"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ScanPhoto } from "@/components/ScanPhoto";
import { hhmm, roomName } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";

type Health = { demo: boolean; backend: string; mode?: string };
type State = "ok" | "warn" | "off";

const PILL: Record<State, string> = {
  ok: "bg-tertiary-fixed text-tertiary",
  warn: "bg-secondary-fixed text-on-secondary-fixed",
  off: "bg-surface-container-high text-on-surface-variant",
};

export default function StatusPage() {
  const t = useT();
  const { rooms, readings, agoOf, live, scans, setRoom } = useStore();
  const [health, setHealth] = useState<Health | null>(null);
  const [checkedAt, setCheckedAt] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      setHealth(await r.json());
    } catch {
      setHealth({ demo: false, backend: "unreachable" });
    }
    setCheckedAt(new Date().toTimeString().slice(0, 8));
    setBusy(false);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const demo = !health || health.demo;
  const serverOk = health?.backend === "online";
  const last = scans[0];

  const roomCards = rooms.map((r) => {
    const rd = readings[r.id];
    const up = rd.online && agoOf(r.id) <= 90;
    return {
      key: r.id, icon: "warehouse", group: t("Room controller"), name: t(r.name), state: (up ? "ok" : "off") as State, pill: up ? t("Online") : t("Offline"),
      rows: [
        [t("Device"), rd.device],
        [t("Last report"), t("{n} s ago", { n: agoOf(r.id) })],
        [t("Temp / humidity"), `${rd.temp_c.toFixed(1)} °C · ${rd.rh.toFixed(1)}%`],
        [t("Water tank"), rd.water_ok ? t("OK") : t("Low")],
      ] as [string, string][],
      note: live ? t("Live") : t("Simulated in demo mode"),
      onClick: () => setRoom(r.id),
    };
  });

  const shared = [
    { key: "server", icon: "laptop_windows", group: t("Server"), name: t("Farm laptop"), state: (demo ? "off" : serverOk ? "ok" : "warn") as State,
      pill: demo ? t("Not connected") : serverOk ? t("Online") : t("Unreachable"),
      rows: [[t("Role"), t("Stores readings and photos")], [t("Mode"), demo ? t("Demo (no server)") : health?.mode === "bridge" ? t("AI service only") : t("Full API")]] as [string, string][],
      note: t("Reached through a secure tunnel") },
    { key: "ai", icon: "center_focus_weak", group: t("AI"), name: t("AI mould check"), state: (demo ? "off" : serverOk ? "ok" : "warn") as State,
      pill: demo ? t("Not connected") : serverOk ? t("Ready") : t("Unreachable"),
      rows: [[t("Model"), "yolov8n-2026-06-20"], [t("Runs on"), t("The farm laptop")]] as [string, string][],
      note: t("Trained on public photos; farm testing in progress") },
    { key: "net", icon: "public", group: t("Connection"), name: t("Internet link"), state: (demo ? "off" : serverOk ? "ok" : "warn") as State,
      pill: demo ? t("Not set up") : serverOk ? t("Connected") : t("Down"),
      rows: [[t("Website"), t("Online")], [t("Tunnel to laptop"), demo ? t("Not configured") : serverOk ? t("Working") : t("Not reachable")]] as [string, string][],
      note: t("If it drops, each room keeps running on its own") },
  ];

  const all = [...roomCards, ...shared];
  const okCount = all.filter((c) => c.state === "ok").length;

  return (
    <div className="flex flex-col w-full px-4 md:px-space-lg py-space-md max-w-[1240px] mx-auto gap-space-md">
      <div className="flex flex-wrap items-end justify-between gap-space-sm">
        <div>
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t("Farm")} / <span className="text-primary-container">{t("Diagnostics")}</span></span>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{t("System status")}</h1>
        </div>
        <button onClick={check} disabled={busy} type="button" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-lowest shadow-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low disabled:opacity-60">
          <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${busy ? "animate-spin" : ""}`}>refresh</span>
          {t("Check again")}
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-wrap items-center justify-between gap-space-md">
        <div className="flex items-center gap-space-md">
          <span className={`w-3 h-3 rounded-full shrink-0 ${okCount === all.length ? "bg-tertiary" : okCount >= rooms.length ? "bg-secondary-container" : "bg-outline"}`} />
          <div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface flex flex-wrap items-center gap-2">
              {okCount === all.length ? t("All parts working") : demo ? t("Demo mode: rooms simulated, no server connected") : t("Some parts need attention")}
              <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-tertiary font-label-sm text-label-sm">{t("{n} / {m} OK", { n: okCount, m: all.length })}</span>
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">{t("Each room controls its own climate. The laptop, AI and internet add records, photos and this website.")}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="font-label-sm text-label-sm text-on-surface-variant block">{t("Last checked")}</span>
          <span className="font-label-md text-label-md font-semibold text-on-surface tabular-nums">{checkedAt || "…"}</span>
        </div>
      </div>

      <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 pt-1">
        <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary">warehouse</span>{t("Rooms")}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        {roomCards.map(({ key, ...c }) => <Card key={key} {...c} />)}
      </div>

      <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2 pt-1">
        <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary">hub</span>{t("Shared parts")}
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        <div className="lg:col-span-3 bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary">photo_camera</span>{t("Last photo checked")}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">{hhmm(last.time)}</span>
          </div>
          <Link href={`/scan/${last.id}`} className="block aspect-[4/3] rounded-lg overflow-hidden bg-surface-container-high"><ScanPhoto scan={last} labels={false} /></Link>
          <span className="font-label-sm text-label-sm text-on-surface-variant">{t(roomName(last.room))} · {t("Phone camera, by hand")}</span>
        </div>
        <div className="lg:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-space-md">
          {shared.map(({ key, ...c }) => <Card key={key} {...c} />)}
        </div>
      </div>

      <div className="flex items-center gap-2 p-space-sm px-space-md rounded-lg bg-surface-container-low font-label-sm text-label-sm text-on-surface-variant">
        <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-outline">info</span>
        {t("AI checks are suggestions. Confirm by looking at the bag.")}
      </div>
    </div>
  );
}

function Card({ icon, group, name, state, pill, rows, note, onClick }: {
  icon: string; group: string; name: string; state: State; pill: string; rows: [string, string][]; note: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} className={`bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""} ${state === "off" ? "opacity-90" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-space-sm min-w-0">
          <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">{icon}</span>
          </div>
          <div className="min-w-0">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block">{group}</span>
            <span className="font-headline-sm text-headline-sm text-on-surface leading-tight">{name}</span>
          </div>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${PILL[state]}`}>{pill}</span>
      </div>
      <div className="flex flex-col gap-1.5 py-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2 font-body-md text-body-md">
            <span className="text-on-surface-variant">{k}</span>
            <span className="text-on-surface font-medium text-right font-mono text-[13px]">{v}</span>
          </div>
        ))}
      </div>
      <span className="font-label-sm text-label-sm text-outline border-t border-surface-container pt-2">{note}</span>
    </div>
  );
}
