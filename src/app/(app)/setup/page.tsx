import Link from "next/link";
import { getT } from "@/lib/i18n-server";

const STEPS = [
  { n: 1, label: "Step 1 · Done", name: "Connect controller", state: "done" },
  { n: 2, label: "Step 2 · Now", name: "Camera photo tips", state: "now" },
  { n: 3, label: "Step 3 · Next", name: "Confirm climate targets", state: "next" },
] as const;

export default async function SetupPage() {
  const t = await getT();
  return (
    <div className="flex flex-col w-full px-4 md:px-space-lg py-space-md max-w-[1180px] mx-auto gap-space-md">
      <div className="bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-col gap-space-md">
        <div className="flex flex-wrap items-start justify-between gap-space-sm">
          <div>
            <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">{t("Room setup")}</span>
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{t("Camera setup guide")}</h1>
          </div>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container-low font-label-md text-label-md text-on-surface-variant">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">checklist</span>{t("Step 2 of 3")}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
          {STEPS.map((s) => (
            <div key={s.n} className={`flex items-center gap-space-sm p-space-sm rounded-lg ${s.state === "done" ? "bg-tertiary-fixed/60" : s.state === "now" ? "bg-primary-fixed ring-2 ring-primary-container/40" : "bg-surface-container-low"}`}>
              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-label-md text-label-md font-bold shrink-0 ${s.state === "done" ? "bg-tertiary text-on-tertiary" : s.state === "now" ? "bg-primary-container text-on-primary" : "bg-surface-container-high text-on-surface-variant"}`}>
                {s.state === "done" ? <span aria-hidden="true" className="material-symbols-outlined text-[18px]">check</span> : s.n}
              </span>
              <div>
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase block">{t(s.label)}</span>
                <span className="font-label-md text-label-md text-on-surface font-semibold">{t(s.name)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-col gap-space-md">
        <div>
          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold flex items-center gap-1">
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">center_focus_strong</span>{t("Photo quality")}
          </span>
          <h2 className="font-headline-md text-headline-md text-on-surface">{t("Take photos the AI can read")}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl">
            {t("The AI looks at one bag at a time and marks areas that may be mould. Clear, close photos give the most reliable results.")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          {[
            { img: "/stitch/433d0a34f9.jpg", tag: "Good photo", tagCls: "bg-tertiary-fixed text-tertiary", icon: "check_circle", head: "What makes a good scan", tips: ["Hold the phone 20–30 cm from the bag, facing it straight on.", "Use soft daylight or indirect light.", "Fill the frame with one bag."] },
            { img: "/stitch/3be105fc60.jpg", tag: "Avoid", tagCls: "bg-error-container text-on-error-container", icon: "cancel", head: "What causes 'could not check'", tips: ["Flash glare on the plastic.", "Far-away shots of many bags at once.", "Dark or blurry photos."] },
          ].map((c) => (
            <div key={c.tag} className="rounded-xl overflow-hidden bg-surface-container-low flex flex-col">
              <div className="relative aspect-[16/9] bg-surface-container-high">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.img} alt="" className="w-full h-full object-cover" />
                <span className={`absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${c.tagCls}`}>
                  <span aria-hidden="true" className="material-symbols-outlined text-[14px]">{c.icon}</span>{t(c.tag)}
                </span>
                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-inverse-surface/70 text-inverse-on-surface font-label-sm text-[10px]">{t("Illustration")}</span>
              </div>
              <div className="p-space-md flex flex-col gap-2">
                <span className="font-label-md text-label-md text-on-surface font-semibold">{t(c.head)}</span>
                <ul className="flex flex-col gap-1.5">
                  {c.tips.map((tip) => (
                    <li key={tip} className="flex items-start gap-2 font-body-md text-body-md text-on-surface-variant">
                      <span className="w-1.5 h-1.5 rounded-full bg-outline mt-2 shrink-0" />{t(tip)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md p-space-md rounded-xl bg-primary-fixed/50">
          <div className="flex items-center gap-space-md">
            <div className="w-12 h-12 rounded-xl bg-secondary-container flex items-center justify-center shrink-0">
              <span aria-hidden="true" className="material-symbols-outlined text-[24px] text-on-secondary-fixed">photo_camera</span>
            </div>
            <div>
              <p className="font-headline-sm text-headline-sm text-on-surface">{t("Test the camera with one bag")}</p>
              <p className="font-body-md text-body-md text-on-surface-variant">{t("Take one photo and check the AI can see the bag before routine checks.")}</p>
            </div>
          </div>
          <Link href="/scan" className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-secondary-container text-on-secondary-fixed font-label-md text-label-md font-semibold">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">photo_camera</span>{t("Take test photo")}
          </Link>
        </div>

        <div className="flex items-start gap-2 p-space-md rounded-lg bg-surface-container-low">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-primary">verified_user</span>
          <p className="font-body-md text-body-md text-on-surface-variant">
            <span className="font-semibold text-on-surface">{t("You stay in charge.")}</span>{" "}
            {t("The AI flags areas for you to look at. It never removes a bag or changes the climate because of a photo.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-sm border-t border-surface-container">
          <Link href="/status" className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface">
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_back</span>{t("Back: controller status")}
          </Link>
          <Link href="/climate" className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold">
            {t("Next: climate targets")}<span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
