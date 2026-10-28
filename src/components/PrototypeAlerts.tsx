"use client";

import Link from "next/link";
import { useState } from "react";
import { ScanPhoto } from "@/components/ScanPhoto";
import { dayLabel, hhmm, roomName } from "@/lib/data";
import { useT, useTD } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import type { Alert } from "@/lib/types";

type Kind = "all" | Alert["kind"];

const STYLE: Record<Alert["level"], { bar: string; chip: string; icon: string; text: string }> = {
  red: { bar: "bg-error", chip: "bg-error-container text-on-error-container", icon: "report", text: "text-error" },
  amber: { bar: "bg-secondary", chip: "bg-secondary-fixed text-on-secondary-fixed", icon: "warning", text: "text-secondary" },
  green: { bar: "bg-tertiary", chip: "bg-tertiary-fixed text-tertiary", icon: "check_circle", text: "text-tertiary" },
  grey: { bar: "bg-outline", chip: "bg-surface-container-high text-on-surface-variant", icon: "cloud_off", text: "text-outline" },
};
const KIND_ICON: Record<Alert["kind"], string> = { mould: "coronavirus", climate: "humidity_low", device: "router" };
const KIND_LABEL: Record<Alert["kind"], string> = { mould: "Mould", climate: "Climate", device: "Device" };

const day = dayLabel;

export function PrototypeAlerts() {
  const t = useT();
  const td = useTD();
  const { alerts, scans, rooms, resolveAlert } = useStore();
  const [roomF, setRoomF] = useState<"all" | string>("all");
  const inRoom = alerts.filter((a) => roomF === "all" || a.room === roomF);
  const openCount = inRoom.filter((a) => !a.resolved_at).length;
  const [kind, setKind] = useState<Kind>("all");
  const [tab, setTab] = useState<"open" | "resolved">(alerts.some((a) => !a.resolved_at) ? "open" : "resolved");
  const [sel, setSel] = useState<string | null>(null);

  const inTab = inRoom.filter((a) => (tab === "open" ? !a.resolved_at : !!a.resolved_at));
  const list = inTab.filter((a) => kind === "all" || a.kind === kind);
  const selected = list.find((a) => a.id === sel) ?? list[0];
  const scan = selected?.scan_id ? scans.find((s) => s.id === selected.scan_id) : undefined;
  const count = (k: Kind) => inTab.filter((a) => k === "all" || a.kind === k).length;

  return (
    <div className="flex flex-col w-full px-4 md:px-space-lg py-space-md max-w-[1440px] mx-auto">
      <h1 className="sr-only">{t("Alerts")}</h1>
      <section className="flex flex-col gap-space-sm pb-space-md mb-space-md">
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <div className="flex flex-wrap items-center gap-space-xs">
            {(["all", "mould", "climate", "device"] as Kind[]).map((k) => {
              const on = kind === k;
              return (
                <button key={k} onClick={() => setKind(k)} type="button"
                  className={on
                    ? "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md shadow-sm transition-transform active:scale-95"
                    : "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors font-label-md text-label-md"}>
                  <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{k === "all" ? "filter_list" : KIND_ICON[k]}</span>
                  {k === "all" ? t("All") : t(KIND_LABEL[k])}
                  <span className={`ml-0.5 px-1.5 rounded-full text-[11px] font-semibold ${on ? "bg-white/20 text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>{count(k)}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center p-1 rounded-xl bg-surface-container-low">
            {(["open", "resolved"] as const).map((x) => (
              <button key={x} onClick={() => { setTab(x); setSel(null); }} type="button"
                className={tab === x
                  ? "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md shadow-sm"
                  : "flex items-center gap-2 px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors"}>
                {x === "open" ? <span className={`w-2 h-2 rounded-full ${openCount ? "bg-error animate-pulse" : "bg-outline"}`} /> : <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-tertiary">task_alt</span>}
                <span className="font-semibold">{x === "open" ? t("Open") : t("Resolved")}</span>
                <span className="px-1.5 rounded text-[11px] bg-surface-container-high text-on-surface-variant font-semibold">{x === "open" ? openCount : inRoom.length - openCount}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-space-xs">
          <span className="font-label-sm text-label-sm text-on-surface-variant mr-1">{t("Room")}:</span>
          {[{ id: "all", name: "All rooms" }, ...rooms].map((r) => (
            <button key={r.id} type="button" onClick={() => { setRoomF(r.id); setSel(null); }}
              className={`px-3 py-2 rounded-full font-label-sm text-label-sm transition-colors ${roomF === r.id ? "bg-primary-fixed text-primary font-semibold" : "bg-surface-container-low text-on-surface-variant hover:text-on-surface"}`}>
              {t(r.name)}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <div className="lg:col-span-7 flex flex-col gap-space-sm">
          <div className="flex items-center justify-between px-1 mb-1">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-on-surface-variant">list_alt</span>
              <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">{tab === "open" ? t("Open alerts") : t("Resolved alerts")}</span>
            </div>
            <span className="font-label-sm text-label-sm text-outline">{t("Newest first")}</span>
          </div>

          {list.length === 0 && (
            <div className="p-space-md rounded-xl bg-surface-container-low/70 flex items-center justify-between">
              <div className="flex items-center gap-space-md">
                <div className="w-10 h-10 rounded-full bg-tertiary-fixed flex items-center justify-center text-tertiary shrink-0">
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">eco</span>
                </div>
                <div>
                  <p className="font-headline-sm text-[15px] text-on-surface leading-tight font-semibold">{tab === "open" ? t("No open alerts.") : t("Nothing resolved yet.")}</p>
                  <p className="font-body-md text-label-md text-on-surface-variant">{t("New alerts appear here when the AI flags a bag or the climate leaves its targets.")}</p>
                </div>
              </div>
            </div>
          )}

          {list.map((a) => {
            const st = STYLE[a.level];
            const s = a.scan_id ? scans.find((x) => x.id === a.scan_id) : undefined;
            const active = selected?.id === a.id;
            return (
              <article key={a.id} onClick={() => setSel(a.id)} tabIndex={0} role="button" aria-pressed={active}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(a.id); } }}
                className={`p-space-md rounded-xl bg-surface-container-lowest transition-all cursor-pointer relative overflow-hidden group ${active ? "shadow-md ring-2 ring-primary-container/60" : "shadow-sm hover:shadow-md"} ${a.resolved_at ? "opacity-90" : ""}`}>
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${st.bar}`} />
                <div className="flex items-start justify-between gap-space-md pl-1">
                  <div className="flex items-start gap-space-md flex-1 min-w-0">
                    {s ? (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-surface-container-high"><ScanPhoto scan={s} labels={false} /></div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0 text-secondary">
                        <span aria-hidden="true" className="material-symbols-outlined text-[28px]">{KIND_ICON[a.kind]}</span>
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-label-sm ${st.chip}`}>
                          <span aria-hidden="true" className="material-symbols-outlined text-[14px]">{a.kind === "mould" ? st.icon : KIND_ICON[a.kind]}</span>
                          {t(KIND_LABEL[a.kind])}
                        </span>
                        <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container text-on-surface">{t(roomName(a.room))}</span>
                        {a.resolved_at && <span className="font-label-sm text-label-sm text-outline">{t("Resolved {time} · {how}", { time: hhmm(a.resolved_at), how: t(a.resolution ?? "") })}</span>}
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface truncate group-hover:text-primary transition-colors">{t(a.title)}</h3>
                      <p className="font-body-md text-body-md text-on-surface-variant mt-0.5 line-clamp-1">{td(a.detail)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end shrink-0 pl-2">
                    <span className={`font-label-md text-label-md font-semibold ${a.resolved_at ? "text-on-surface-variant" : st.text}`}>{hhmm(a.time)}</span>
                    <span className="font-label-sm text-[11px] text-outline mt-0.5">{t(day(a.time))}</span>
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary mt-2">chevron_right</span>
                  </div>
                </div>
              </article>
            );
          })}

          <div className="flex items-center gap-2 pt-2 px-1 text-on-surface-variant">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-outline shrink-0">info</span>
            <p className="font-label-sm text-label-sm text-outline italic">{t("AI checks are suggestions. Confirm by looking at the bag.")}</p>
          </div>
        </div>

        {selected && (
          <aside className="lg:col-span-5 bg-surface-container-lowest rounded-xl shadow-md p-space-md md:p-space-lg flex flex-col gap-space-md lg:sticky lg:top-20">
            <div className="flex items-start justify-between pb-space-sm gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm tracking-wide uppercase font-bold ${selected.level === "red" ? "bg-error text-on-error" : STYLE[selected.level].chip}`}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[14px]">{STYLE[selected.level].icon}</span>
                    {selected.level === "red" ? t("Likely mould") : selected.level === "amber" ? t("Please check") : t("Device")}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">{t(roomName(selected.room))}</span>
                </div>
                <h2 className="font-headline-md text-headline-md text-on-surface">{t(selected.title)}</h2>
              </div>
              <div className="text-right shrink-0">
                <span className="font-label-sm text-label-sm text-outline block">{t(day(selected.time))}</span>
                <span className="font-label-md text-label-md font-semibold text-on-surface tabular-nums">{selected.time.slice(11, 19)}</span>
              </div>
            </div>

            {scan && (
              <div className="relative w-full h-64 rounded-xl overflow-hidden bg-inverse-surface shadow-inner">
                <ScanPhoto scan={scan} fit="contain" />
              </div>
            )}

            <p className="font-body-md text-body-md text-on-surface-variant">{td(selected.detail)}</p>

            <div className="rounded-lg bg-surface-container-low p-space-md flex flex-col gap-2">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">{t("What to do")}</span>
              {(selected.kind === "mould"
                ? ["Look at the marked area on the bag.", "If you see green, black or pink spots, take the bag out of the room.", "Check the bags next to it."]
                : selected.kind === "climate"
                  ? ["The room adjusts on its own. Check that the mister has water.", "If it stays out of range, use manual control on the Climate page."]
                  : ["Check the room controller's power and Wi-Fi.", "Climate control keeps running on the controller while it is offline."]
              ).map((x, i) => (
                <div key={x} className="flex items-start gap-2 font-body-md text-body-md text-on-surface">
                  <span className="w-5 h-5 rounded-full bg-surface-container-high font-label-sm text-label-sm flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>{t(x)}
                </div>
              ))}
            </div>

            {selected.resolved_at ? (
              <div className="flex items-center gap-2 bg-tertiary-fixed text-tertiary rounded-lg px-3 py-2.5 font-label-md text-label-md">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">task_alt</span>
                {t("Resolved at {time}: {how}", { time: hhmm(selected.resolved_at), how: t(selected.resolution ?? "") })}
              </div>
            ) : (
              <button onClick={() => resolveAlert(selected.id, selected.kind === "mould" ? "Bag removed" : "Checked")} type="button"
                className="w-full bg-tertiary hover:bg-tertiary-container text-on-tertiary font-label-md text-label-md py-3 rounded-lg flex items-center justify-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">done_all</span>
                {selected.kind === "mould" ? t("Mark resolved (bag removed)") : t("Mark resolved")}
              </button>
            )}
            <div className="grid grid-cols-2 gap-space-xs">
              {scan ? (
                <Link href={`/scan/${scan.id}`} className="bg-primary-container text-on-primary font-label-md text-label-md py-2.5 rounded-lg flex items-center justify-center gap-1.5">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">center_focus_weak</span> {t("Open AI scan")}
                </Link>
              ) : (
                <Link href="/climate" className="bg-primary-container text-on-primary font-label-md text-label-md py-2.5 rounded-lg flex items-center justify-center gap-1.5">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">thermostat</span> {t("Open climate")}
                </Link>
              )}
              {!selected.resolved_at && selected.kind === "mould" ? (
                <button onClick={() => resolveAlert(selected.id, "False alarm")} type="button" className="bg-surface-container-low text-on-surface font-label-md text-label-md py-2.5 rounded-lg flex items-center justify-center gap-1.5">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">close</span> {t("False alarm")}
                </button>
              ) : (
                <Link href="/history" className="bg-surface-container-low text-on-surface font-label-md text-label-md py-2.5 rounded-lg flex items-center justify-center gap-1.5">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">history</span> {t("Scan history")}
                </Link>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
