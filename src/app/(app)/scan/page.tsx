"use client";

import { CameraManager } from "@/components/CameraManager";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ScanPhoto } from "@/components/ScanPhoto";
import { LEVEL_CLASS, LEVEL_TEXT, SCANS, hhmm, levelOf, nowISO } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import type { Scan } from "@/lib/types";

const DEMO_ORDER = ["s3", "s1", "s2", "s4"]; // red, amber, green, grey: real saved results
let demoTurn = 0;
// Uploading one of our own sample photos (public/mock) shows that photo's real result.
const SAMPLE_FILES: Record<string, string> = {
  "bag-amber": "s1", "bag-green": "s2", "bag-red": "s3", "bag-none": "s4",
  "scan-05": "s5", "scan-06": "s6", "scan-07": "s7", "scan-08": "s8", "scan-09": "s9", "scan-10": "s10", "scan-11": "s11", "scan-12": "s12",
};

async function shrink(file: File, max = 1280): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  try { c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height); } finally { bmp.close(); }
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("resize failed"))), "image/jpeg", 0.8));
}

export default function ScanPage() {
  // /scan always opens the real Python stream, independently of room/demo state.
  const [mode, setMode] = useState<"live" | "upload">("live");
  const router = useRouter();
  const { scans, addScan, live, rooms, room, setRoom } = useStore();
  const t = useT();
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(f: File | undefined, input?: HTMLInputElement) {
    if (input) input.value = ""; // so choosing the same file again still works
    if (!f) return;
    setError(null);
    if (!f.type.startsWith("image/")) {
      setError(t("That file is not a photo. Please choose a JPEG or PNG image."));
      return;
    }
    try {
      const blob = await shrink(f);
      const url = URL.createObjectURL(blob);
      setPreview(url);
      const started = Date.now();
      const r = await fetch(`/api/images?camera=phone-1&room=${room.id}`, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob, signal: AbortSignal.timeout(35000) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || t("The AI could not check this photo."));
      await new Promise((ok) => setTimeout(ok, Math.max(0, 1200 - (Date.now() - started))));
      const id = `n${Date.now()}`;
      const time = nowISO();
      let scan: Scan;
      if (j.demo) {
        const stem = f.name.replace(/\.[^.]+$/, "").toLowerCase();
        let wanted = SAMPLE_FILES[stem];
        if (!wanted) {
          wanted = DEMO_ORDER[demoTurn % DEMO_ORDER.length];
          demoTurn += 1;
        }
        const sample = SCANS.find((s) => s.id === wanted)!;
        scan = { ...sample, id, time, room: room.id, demo: true, feedback: undefined };
      } else {
        scan = { ...j, id, time, room: room.id, file_url: url };
        scan.level = levelOf(scan);
      }
      addScan(scan);
      router.push(`/scan/${id}`);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error && !/decode|bitmap|source image/i.test(e.message) ? e.message : t("This photo could not be opened. Please try another JPEG or PNG image."));
    }
  }

  return (
    <div className="flex flex-col w-full px-4 md:px-space-lg py-space-md max-w-[1240px] mx-auto space-y-space-lg">
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0], e.target)} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => onFile(e.target.files?.[0], e.target)} />

      <h1 className="sr-only">{t("AI scan")}</h1>
      <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-xs">
        <div className="flex items-center gap-space-sm font-label-md text-label-md">
          <span className="text-on-surface-variant font-medium">{t("AI scan")}</span>
          <span className="text-outline-variant">/</span>
          <span className="text-on-surface font-semibold">{t("New scan")}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low text-on-surface text-label-sm font-label-sm shadow-sm">
          <span className={`w-2 h-2 rounded-full ${mode === "live" ? "bg-primary" : live ? "bg-tertiary" : "bg-outline"}`} />
          <span>
            {t(room.name)} · {mode === "live" ? "Live camera" : live ? t("AI server connected") : t("Demo mode")} {mode === "upload" && <>· {t("Model")}: <span className="font-mono tracking-tight text-primary">yolov8n-2026-06-20</span></>}
          </span>
        </div>
      </div>

      <div role="group" aria-label="Detection mode" className="flex gap-2">
        <button type="button" aria-pressed={mode === "live"} onClick={() => setMode("live")} className={`rounded-lg px-5 py-3 ${mode === "live" ? "bg-primary text-white" : "bg-surface-container-low"}`}>Live Detection</button>
        <button type="button" aria-pressed={mode === "upload"} onClick={() => setMode("upload")} className={`rounded-lg px-5 py-3 ${mode === "upload" ? "bg-primary text-white" : "bg-surface-container-low"}`}>Upload Image</button>
      </div>
      {mode === "live" ? <CameraManager /> : <>
      {!live && (
        <div className="flex items-start gap-space-sm bg-surface-container-low rounded-xl p-space-md">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary shrink-0">info</span>
          <p className="font-body-md text-body-md text-on-surface-variant">
            <span className="font-semibold text-on-surface">{t("Demo mode.")}</span>{" "}
            {t("No AI server is connected, so after you take a photo you will see a saved example: a real bag photo with our model's real result. Connect the farm laptop to check your own photos.")}
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-space-sm bg-error-container text-on-error-container rounded-xl p-space-md">
          <span aria-hidden="true" className="material-symbols-outlined text-[20px] shrink-0">error</span>
          <p className="font-body-md text-body-md">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-12 gap-space-lg items-stretch">
        <section className="col-span-12 lg:col-span-7 flex flex-col">
          <div className="flex-1 bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-space-md">
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary">center_focus_strong</span>
                <span className="font-headline-sm text-headline-sm text-on-surface">{t("Bag photo")}</span>
              </div>
              <label className="flex items-center gap-1.5 font-label-sm text-label-sm text-on-surface-variant">
                {t("Room")}
                <select value={room.id} onChange={(e) => setRoom(e.target.value)} className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-label-md text-label-md text-on-surface">
                  {rooms.map((r) => <option key={r.id} value={r.id}>{t(r.name)}</option>)}
                </select>
              </label>
            </div>

            {preview ? (
              <div className="relative w-full min-h-[380px] flex-1 rounded-xl overflow-hidden bg-inverse-surface shadow-inner flex items-center justify-center">
                <img className="absolute inset-0 w-full h-full object-contain brightness-75" alt={t("Your bag photo")} src={preview} />
                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-primary/20 pointer-events-none" />
                <div className="absolute left-0 right-0 h-[2px] bg-secondary-container shadow-[0_0_12px_#ffca42] top-1/2 -translate-y-1/2 pointer-events-none animate-pulse" />
                <div className="relative z-10 flex items-center gap-space-sm bg-surface-container-lowest/95 backdrop-blur px-5 py-3 rounded-full shadow-md text-on-surface">
                  <svg className="animate-spin h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
                  </svg>
                  <span className="font-label-md text-label-md font-semibold text-on-surface">{t("Checking for mould… about 2 seconds")}</span>
                </div>
              </div>
            ) : (
              <div className="flex-1 border-2 border-dashed border-outline-variant bg-surface-bright rounded-xl p-space-lg md:p-space-xl flex flex-col items-center justify-center text-center min-h-[380px] transition-colors hover:bg-surface-container-low/50">
                <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface mb-space-md shadow-sm">
                  <span aria-hidden="true" className="material-symbols-outlined text-[32px] text-primary">photo_camera</span>
                </div>
                <h3 className="font-headline-md text-headline-md text-on-surface mb-space-xs">{t("Take or upload a bag photo")}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant max-w-md mb-space-lg">{t("Fill the frame with one bag face, in good light, without flash glare.")}</p>
                <div className="flex flex-wrap items-center justify-center gap-space-sm mb-space-md">
                  <button onClick={() => camRef.current?.click()} className="bg-secondary-container text-on-secondary-fixed font-semibold px-6 py-3 rounded-lg shadow-sm flex items-center gap-space-xs hover:bg-secondary-fixed-dim transition-colors active:scale-[0.99]" type="button">
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px]">photo_camera</span>
                    <span className="font-label-md text-label-md">{t("Take photo")}</span>
                  </button>
                  <button onClick={() => fileRef.current?.click()} className="bg-surface-container-lowest text-on-surface px-5 py-3 rounded-lg shadow-sm hover:bg-surface-container-low transition-colors flex items-center gap-space-xs font-semibold" type="button">
                    <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-on-surface-variant">upload_file</span>
                    <span className="font-label-md text-label-md">{t("Upload a photo")}</span>
                  </button>
                </div>
                <p className="font-label-sm text-label-sm text-outline">{t("JPEG or PNG · resized automatically to 1280 px before upload")}</p>
              </div>
            )}
          </div>
        </section>

        <section className="col-span-12 lg:col-span-5 flex flex-col">
          <div className="flex-1 bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-space-xs mb-space-md pb-space-xs">
                <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary">psychology_alt</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">{t("How the AI check works")}</h2>
              </div>
              <ol className="space-y-space-md relative">
                {[
                  ["Photo", "You take or upload a clear photo of one oyster-mushroom grow bag."],
                  ["AI looks for mould", "Our AI model, running on the farm laptop, marks areas that may be mould and gives a confidence score."],
                  ["You confirm", "You look at the bag and decide. The AI suggests; you make the call."],
                ].map(([title, d], i) => (
                  <li key={title} className="flex items-start gap-space-md">
                    <span className="w-7 h-7 rounded-full bg-primary-fixed text-primary font-bold text-label-md flex items-center justify-center shrink-0">{i + 1}</span>
                    <div>
                      <p className="font-headline-sm text-[15px] font-semibold text-on-surface leading-tight mb-0.5">{t(title)}</p>
                      <p className="font-body-md text-body-md text-on-surface-variant">{t(d)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-space-lg bg-surface-container-low p-space-md rounded-xl text-on-surface-variant flex items-start gap-space-sm">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary shrink-0 mt-0.5">lightbulb</span>
              <p className="font-label-md text-label-md leading-relaxed text-primary-container">{t("Works best on close-up photos of bag faces. Avoid direct sunlight and strong shadows.")}</p>
            </div>
          </div>
        </section>
      </div>

      </>}

      <section className="w-full bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm">
        <div className="flex items-center justify-between mb-space-md">
          <div className="flex items-center gap-space-xs">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-secondary">history</span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{t("Recent scans")} · Upload previews and examples · {t(room.name)}</h3>
          </div>
          <Link href="/history" className="font-label-md text-label-md text-primary font-semibold hover:underline">{t("All scans")}</Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-space-sm">
          {scans.filter((s) => s.room === room.id).slice(0, 6).map((s) => {
            const l = levelOf(s);
            return (
              <Link key={s.id} href={`/scan/${s.id}`} className="flex flex-col gap-1.5 group">
                <div className="aspect-square rounded-lg overflow-hidden bg-surface-container-high">
                  <ScanPhoto scan={s} labels={false} />
                </div>
                <div className="flex items-center justify-between font-label-sm text-label-sm">
                  <span className="text-on-surface tabular-nums">{hhmm(s.time)}</span>
                </div>
                <span className={`font-label-sm text-label-sm px-1.5 py-0.5 rounded text-center ${LEVEL_CLASS[l].chip}`}>{t(LEVEL_TEXT[l].short)}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="flex items-center justify-between pt-space-xs text-on-surface-variant font-label-sm text-label-sm border-t border-outline-variant/30">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-outline">verified_user</span>
          <span>{t("AI checks are suggestions. Confirm by looking at the bag.")}</span>
        </div>
      </div>
    </div>
  );
}
