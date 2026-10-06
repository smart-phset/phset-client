"use client";

import Link from "next/link";
import { use } from "react";
import { ScanPhoto } from "@/components/ScanPhoto";
import { LEVEL_CLASS, LEVEL_TEXT, cameraName, hhmm, levelOf, pct, roomName } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import type { Level, Scan } from "@/lib/types";

type T = (en: string, vars?: Record<string, string | number>) => string;

function copy(s: Scan, level: Level, t: T) {
  const n = s.n_contaminated;
  switch (level) {
    case "red":
      return {
        title: t("The AI is fairly sure this area is mould ({p} confidence).", { p: pct(s.max_contaminated_conf) }),
        body: t("Act now so it does not spread to the bags around it."),
        steps: [t("Remove this bag from the room now."), t("Check the bags next to it and under it."), t("Tell us what you found.")],
        yes: t("Bag removed"), no: t("Not mould"),
      };
    case "amber":
      return {
        title: t(n === 1 ? "The AI found 1 area that may be mould ({p} confidence)." : "The AI found {n} areas that may be mould (highest {p} confidence).", { n, p: pct(s.max_contaminated_conf) }),
        body: t("This is a suggestion. Please look at the marked area before deciding."),
        steps: [t("Look closely at the marked area."), t("Green, black or pink spots mean mould: move this bag away from the others."), t("Tell us what you found.")],
        yes: t("Mould confirmed, bag removed"), no: t("Looks fine to me"),
      };
    case "green":
      return {
        title: t(s.n_healthy === 1 ? "The AI checked 1 bag and flagged no mould." : "The AI checked {n} bags and flagged no mould.", { n: s.n_healthy }),
        body: t("A clear result is not a guarantee. If anything looks or smells wrong, check the bag yourself."),
        steps: [], yes: null, no: null,
      };
    default:
      return {
        title: s.verdict === "camera_error" ? t("The photo could not be read.") : t("No bag was found in this photo."),
        body: t("Move closer so one bag face fills the frame, and add light. Blurry or dark photos cannot be checked."),
        steps: [], yes: null, no: null,
      };
  }
}

export default function ScanResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { scans, readings, setFeedback } = useStore();
  const t = useT();
  const scan = scans.find((s) => s.id === id);

  if (!scan) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center flex flex-col items-center gap-4">
        <span aria-hidden="true" className="material-symbols-outlined text-[40px] text-outline">image_not_supported</span>
        <h1 className="font-headline-md text-headline-md">{t("This scan is no longer here")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("New photos are kept until the page is reloaded.")}</p>
        <Link href="/scan" className="bg-secondary-container text-on-secondary-fixed font-semibold px-6 py-3 rounded-lg">{t("Take a photo")}</Link>
      </div>
    );
  }

  const level = levelOf(scan);
  const c = copy(scan, level, t);
  const reading = readings[scan.room] ?? Object.values(readings)[0];
  const flagged = level === "red" || level === "amber";

  return (
    <div className="flex flex-col w-full px-4 md:px-space-lg py-space-md max-w-[1440px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-space-sm mb-space-md gap-space-xs">
        <div className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant">
          <Link href="/scan" className="hover:text-on-surface">{t("AI scan")}</Link>
          <span className="text-outline-variant">/</span>
          <span className="font-semibold text-on-surface">{t("Scan {time}", { time: hhmm(scan.time) })}</span>
          {flagged && !scan.feedback && <span className="ml-space-xs px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">{t("Review needed")}</span>}
          {scan.feedback && <span className="ml-space-xs px-2 py-0.5 rounded-full bg-tertiary-fixed text-tertiary font-label-sm text-label-sm">{t("Reviewed")}</span>}
        </div>
        <div className="flex items-center flex-wrap gap-x-space-sm gap-y-1 font-label-sm text-label-sm text-on-surface-variant">
          <span>{t("Room")}: <span className="font-medium text-on-surface">{t(roomName(scan.room))}</span></span>
          <span className="text-outline-variant">·</span>
          <span>{t("Camera")}: <span className="font-medium text-on-surface">{t(cameraName(scan.camera))}</span></span>
          {scan.ms && (<><span className="text-outline-variant">·</span><span>{t("Check took")} <span className="font-medium text-on-surface">{(scan.ms / 1000).toFixed(1)} s</span></span></>)}
          <span className="font-mono text-[10px] bg-surface-container px-1.5 py-0.5 rounded text-on-surface-variant">{scan.model_version ?? "yolov8n-2026-06-20"}</span>
        </div>
      </div>

      {scan.demo && (
        <div className="mb-space-md flex items-start gap-space-sm bg-surface-container-low rounded-xl p-space-md">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary shrink-0">info</span>
          <p className="font-body-md text-body-md text-on-surface-variant">
            <span className="font-semibold text-on-surface">{t("Demo result.")}</span>{" "}
            {t("No AI server is connected, so this is a saved example: a real bag photo with our model's real result, not your photo.")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        <div className="lg:col-span-7 flex flex-col gap-space-sm order-2 lg:order-1">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="relative w-full aspect-square sm:aspect-[4/3] bg-inverse-surface overflow-hidden select-none">
              <ScanPhoto scan={scan} fit="contain" />
              <div className="absolute top-3 right-3 bg-surface-container-lowest/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-on-surface font-label-sm text-label-sm flex items-center gap-1.5 shadow-sm">
                <span className={`w-2 h-2 rounded-full ${level === "red" ? "bg-error" : level === "amber" ? "bg-secondary" : level === "green" ? "bg-tertiary" : "bg-outline"}`} />
                <span>{flagged ? t("{n} marked", { n: scan.n_contaminated }) : level === "green" ? t("{n} bag(s) seen", { n: scan.n_healthy }) : t("Nothing recognised")}</span>
              </div>
            </div>
            <div className="p-space-md bg-surface-container-lowest flex flex-col sm:flex-row items-center justify-between gap-space-sm">
              <Link href="/scan" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-secondary-container hover:bg-secondary-fixed-dim text-on-secondary-fixed font-label-md text-label-md px-4 py-2.5 rounded-lg transition-colors">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">photo_camera</span> {t("Take another photo")}
              </Link>
              <span className="font-label-sm text-label-sm text-on-surface-variant text-center sm:text-right">
                {t("Dashed outlines: bags the AI recognised. Solid outlines: possible mould.")}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-space-sm">
            {[
              ["thermostat", t("Temperature now"), reading.temp_c.toFixed(1), "°C"],
              ["humidity_mid", t("Humidity now"), reading.rh.toFixed(0), "%"],
              ["mode_fan", t("Fan"), reading.fan_on ? t("On") : t("Off"), ""],
            ].map(([icon, label, v, u]) => (
              <div key={label} className="bg-surface-container-lowest p-space-sm rounded-lg flex items-center gap-space-sm">
                <div className="w-8 h-8 rounded-lg bg-surface-container hidden sm:flex items-center justify-center text-primary">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{icon}</span>
                </div>
                <div className="min-w-0">
                  <div className="font-label-sm text-label-sm text-on-surface-variant">{label}</div>
                  <div className="font-headline-sm text-headline-sm text-on-surface">{v}<span className="font-unit-hero text-unit-hero font-normal text-on-surface-variant">{u}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-space-sm order-1 lg:order-2">
          <div className="bg-surface-container-lowest p-space-md md:p-space-lg rounded-xl shadow-sm flex flex-col">
            <div className={`inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full font-label-md text-label-md font-semibold ${LEVEL_CLASS[level].chip}`}>
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{LEVEL_TEXT[level].icon}</span>
              <span>{t(LEVEL_TEXT[level].badge)}</span>
            </div>
            <h1 className="font-headline-md text-headline-md text-on-surface mt-space-md mb-space-xs leading-snug">{c.title}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">{c.body}</p>

            {c.steps.length > 0 && (
              <div className="rounded-lg bg-surface-container-low p-space-md my-space-md flex flex-col gap-space-sm">
                <div className="font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">{t("What to do")}</div>
                <div className="flex flex-col gap-2.5">
                  {c.steps.map((step, i) => (
                    <div key={step} className="flex items-start gap-space-sm">
                      <span className="w-5 h-5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <span className="font-body-md text-body-md text-on-surface">
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {c.yes && !scan.feedback && (
              <div className="flex flex-col gap-space-xs">
                <button onClick={() => setFeedback(scan.id, "confirmed")} className="w-full bg-tertiary hover:bg-tertiary-container text-on-tertiary font-label-md text-label-md py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm" type="button">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">verified</span> {c.yes}
                </button>
                <button onClick={() => setFeedback(scan.id, "fine")} className="w-full bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors" type="button">
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px]">check</span> {c.no}
                </button>
              </div>
            )}
            {scan.feedback && (
              <div className="flex items-center gap-2 bg-tertiary-fixed text-tertiary rounded-lg px-3 py-2.5 font-label-md text-label-md">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">task_alt</span>
                {scan.feedback === "confirmed" ? t("Saved: mould confirmed, bag removed. The alert is closed.") : t("Saved: looks fine. The alert is closed.")}
              </div>
            )}
            {!c.yes && (
              <Link href="/scan" className="mt-space-md w-full bg-secondary-container text-on-secondary-fixed font-label-md text-label-md py-3 px-4 rounded-lg flex items-center justify-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">photo_camera</span> {t("Take another photo")}
              </Link>
            )}

            <div className="mt-space-md pt-space-sm">
              <details className="group cursor-pointer">
                <summary className="flex items-center justify-between font-label-md text-label-md text-on-surface-variant list-none select-none">
                  <span className="flex items-center gap-1 font-semibold text-on-surface"><span aria-hidden="true" className="material-symbols-outlined text-[16px]">info</span> {t("Details")}</span>
                  <span aria-hidden="true" className="material-symbols-outlined text-[18px] group-open:rotate-180 transition-transform">expand_more</span>
                </summary>
                <div className="mt-space-sm p-space-sm bg-surface-container-low rounded-lg font-mono text-[11px] text-on-surface-variant grid grid-cols-2 gap-y-1.5 gap-x-2">
                  <div><span className="text-outline">{t("Model")}:</span> {scan.model_version ?? "yolov8n"}</div>
                  <div><span className="text-outline">{t("Photo")}:</span> {scan.width} × {scan.height} px</div>
                  <div><span className="text-outline">{t("Time")}:</span> {scan.time.slice(11, 19)}</div>
                  <div><span className="text-outline">{t("Camera")}:</span> {t(cameraName(scan.camera))}</div>
                  <div><span className="text-outline">{t("Mould score")}:</span> {pct(scan.max_contaminated_conf)}</div>
                  <div><span className="text-outline">{t("Bags seen")}:</span> {scan.n_healthy + scan.n_contaminated}</div>
                </div>
                <p className="mt-2 font-label-sm text-label-sm text-on-surface-variant">
                  {t("Trained on public oyster-bag photos, not yet tested on our farm. Please check with a look at the bag.")}
                </p>
              </details>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-space-lg bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-md">
        <div className="flex items-center justify-between">
          <span className="font-headline-sm text-headline-sm text-on-surface">{t("Recent scans")} · {t(roomName(scan.room))}</span>
          <Link href="/history" className="font-label-md text-label-md text-primary font-semibold hover:underline">{t("All scans")}</Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-space-sm">
          {scans.filter((s) => s.room === scan.room).slice(0, 6).map((s) => {
            const l = levelOf(s);
            return (
              <Link key={s.id} href={`/scan/${s.id}`} className={`flex flex-col gap-1.5 rounded-lg p-1 ${s.id === scan.id ? "ring-2 ring-primary-container" : ""}`}>
                <div className="aspect-square rounded-md overflow-hidden bg-surface-container-high"><ScanPhoto scan={s} labels={false} /></div>
                <span className="font-label-sm text-label-sm text-on-surface tabular-nums">{hhmm(s.time)}</span>
                <span className={`font-label-sm text-label-sm px-1.5 py-0.5 rounded text-center ${LEVEL_CLASS[l].chip}`}>{t(LEVEL_TEXT[l].short)}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <p className="py-4 text-center font-label-sm text-label-sm text-on-surface-variant">{t("AI checks are suggestions. Confirm by looking at the bag.")}</p>
    </div>
  );
}
