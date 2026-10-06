"use client";

import Link from "next/link";
import { useState } from "react";
import { ScanPhoto } from "@/components/ScanPhoto";
import { LEVEL_TEXT, cameraName, hhmm, levelOf, roomName } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import type { Level } from "@/lib/types";

// Status colours from the design system (colour + icon + word, never colour alone).
const F: Record<Level, { fg: string; bg: string; icon: string }> = {
  red: { fg: "#B42318", bg: "#FDE8E6", icon: "dangerous" },
  amber: { fg: "#8A5A00", bg: "#FDF3DC", icon: "warning" },
  green: { fg: "#146C3A", bg: "#E7F4EC", icon: "check_circle" },
  grey: { fg: "#475467", bg: "#EEF0F3", icon: "visibility_off" },
};
const ORDER: Level[] = ["red", "amber", "green", "grey"];

export default function HistoryPage() {
  const t = useT();
  const { scans, rooms } = useStore();
  const [filter, setFilter] = useState<"all" | Level>("all");
  const [roomF, setRoomF] = useState<"all" | string>("all");
  const inRoom = scans.filter((s) => roomF === "all" || s.room === roomF);
  const list = inRoom.filter((s) => filter === "all" || levelOf(s) === filter);
  const n = (l: Level) => inRoom.filter((s) => levelOf(s) === l).length;
  const flagged = inRoom.filter((s) => levelOf(s) === "red" && !s.feedback);

  return (
    <div className="flex flex-col w-full">
      <div className="px-4 md:px-space-xl py-space-lg flex flex-col gap-space-lg max-w-[1440px] mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md bg-surface-container-lowest p-space-md md:p-space-lg rounded-xl shadow-sm">
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-sm text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
              <span className="inline-block w-2 h-2 rounded-full bg-primary-container" />
              <span>{t("AI checks · all rooms")}</span>
            </div>
            <div className="flex items-baseline gap-space-sm flex-wrap">
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{t("Scan history")}</h1>
              <span className="font-body-md text-body-md text-on-surface-variant">/ {t("{n} scans today", { n: inRoom.length })}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-space-sm">
            <div className="flex items-center bg-surface-container-low rounded-lg p-1">
              {[{ id: "all", name: "All rooms" }, ...rooms].map((r) => (
                <button key={r.id} type="button" onClick={() => setRoomF(r.id)}
                  className={`px-3 py-1.5 rounded-lg font-label-md text-label-md transition-all ${roomF === r.id ? "bg-surface-container-lowest text-primary-container shadow-sm font-semibold" : "text-on-surface-variant hover:text-on-surface"}`}>
                  {t(r.name)}
                </button>
              ))}
            </div>
            <Link href="/scan" className="flex items-center gap-space-xs px-4 py-2.5 rounded-lg bg-secondary-container text-on-secondary-fixed font-label-md text-label-md font-bold shadow-md hover:bg-secondary-fixed-dim active:scale-[0.98] transition-all">
              <span aria-hidden="true" className="material-symbols-outlined text-[20px]">photo_camera</span>
              <span>{t("Take photo")}</span>
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-space-xs">
          <button onClick={() => setFilter("all")} type="button"
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-label-md text-label-md font-semibold transition-all ${filter === "all" ? "bg-primary-container text-on-primary" : "bg-surface-container-lowest text-on-surface-variant"}`}>
            <span>{t("All")}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-label-sm ${filter === "all" ? "bg-surface-container-lowest/20 text-on-primary" : "bg-surface-container-high"}`}>{inRoom.length}</span>
          </button>
          {ORDER.map((l) => (
            <button key={l} onClick={() => setFilter(l)} type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-md text-label-md font-semibold transition-all"
              style={filter === l ? { background: F[l].fg, color: "#fff" } : { background: "#fff", color: F[l].fg }}>
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{F[l].icon}</span>
              <span>{t(LEVEL_TEXT[l].short)}</span>
              <span className="px-1.5 py-0.5 rounded-full text-label-sm" style={{ background: filter === l ? "rgba(255,255,255,.25)" : F[l].bg }}>{n(l)}</span>
            </button>
          ))}
        </div>

        {flagged.length > 0 && filter !== "green" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm p-space-md rounded-xl" style={{ background: "#FDE8E6" }}>
            <div className="flex items-start gap-space-sm">
              <span aria-hidden="true" className="material-symbols-outlined text-[22px]" style={{ color: "#B42318" }}>emergency_home</span>
              <div>
                <p className="font-headline-sm text-headline-sm" style={{ color: "#B42318" }}>{t("{n} bag(s) flagged as likely mould", { n: flagged.length })}</p>
                <p className="font-body-md text-body-md text-on-surface-variant">{t("Open the scan, check the bag, and record what you found.")}</p>
              </div>
            </div>
            <Link href={`/scan/${flagged[0].id}`} className="px-4 py-2 rounded-lg font-label-md text-label-md font-semibold text-white self-start sm:self-auto" style={{ background: "#B42318" }}>{t("Open scan")}</Link>
          </div>
        )}

        {list.length === 0 && (
          <div className="p-space-lg rounded-xl bg-surface-container-low text-center font-body-md text-body-md text-on-surface-variant">{t("No scans match this filter.")}</div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-space-md">
          {list.map((s) => {
            const l = levelOf(s);
            const conf = l === "red" || l === "amber" ? ` (${Math.round(s.max_contaminated_conf * 100)}%)` : "";
            return (
              <Link key={s.id} href={`/scan/${s.id}`} className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow group">
                <div className="relative aspect-square bg-surface-container-high">
                  <ScanPhoto scan={s} labels={false} />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-inverse-surface/80 text-inverse-on-surface font-label-sm text-label-sm flex items-center gap-1">
                    <span aria-hidden="true" className="material-symbols-outlined text-[13px]">schedule</span>{hhmm(s.time)}
                  </span>
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-surface-container-lowest/90 text-on-surface font-label-sm text-label-sm">{t(roomName(s.room))}</span>
                </div>
                <div className="p-space-sm md:p-space-md flex flex-col gap-2">
                  <span className="font-headline-sm text-headline-sm text-on-surface">{t("Scan {time}", { time: hhmm(s.time) })}</span>
                  <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold" style={{ background: F[l].bg, color: F[l].fg }}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[14px]">{F[l].icon}</span>{t(LEVEL_TEXT[l].short)}{conf}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{t(cameraName(s.camera))}{s.feedback ? ` · ${t("reviewed")}` : ""}</span>
                  <span className="font-label-sm text-label-sm text-primary-container flex items-center gap-1 group-hover:underline">
                    {t("View result")} <span aria-hidden="true" className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-space-md rounded-xl bg-surface-container-low">
          <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-2">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-outline">verified_user</span>
            {t("AI checks are suggestions. Confirm by looking at the bag before removing it.")}
          </p>
          <span className="font-label-sm text-label-sm text-outline">{t("Photos: public oyster-bag dataset (CC BY 4.0), results from our model")}</span>
        </div>
      </div>
    </div>
  );
}
