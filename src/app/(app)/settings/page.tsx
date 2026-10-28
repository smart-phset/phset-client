import Link from "next/link";
import { LangChoice } from "@/components/LangChoice";
import { ResetDemo } from "@/components/ResetDemo";
import { ROOMS } from "@/lib/data";
import { getT } from "@/lib/i18n-server";
import { currentUser } from "@/lib/session";

const card = "bg-surface-container-lowest rounded-xl p-space-md md:p-space-lg shadow-sm flex flex-col gap-space-md";

function Head({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-space-sm">
      <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
        <span aria-hidden="true" className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <div>
        <h2 className="font-headline-md text-headline-md text-on-surface">{title}</h2>
        <p className="font-label-sm text-label-sm text-on-surface-variant">{sub}</p>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const t = await getT();
  const user = (await currentUser()) ?? { name: "Guest", guest: true };
  return (
    <div className="flex flex-col w-full px-4 md:px-space-lg py-space-md max-w-[1240px] mx-auto gap-space-md">
      <div>
        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t("Settings")}</span>
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{t("Settings and about")}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{t("Language, account, rooms, alert levels, and how the AI works.")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        <div className="lg:col-span-7 flex flex-col gap-space-md">
          <section className={card}>
            <h2 className="font-semibold">Camera preferences</h2>
            <p>Each tab selects its own camera in AI Scan. Press Start to grant camera access. Local preview never uploads video; shared grow-room alerts are independent.</p>
            <Link href="/scan" className="text-primary underline">Open Camera Manager</Link>
          </section>

          <section className={card}>
            <Head icon="translate" title={t("Language")} sub={t("Interface language")} />
            <LangChoice />
            <p className="font-label-sm text-label-sm text-on-surface-variant">{t("Khmer text is a first draft and is being checked by our team. Some screens still show English.")}</p>
          </section>

          <section className={card}>
            <Head icon="shield" title={t("AI alert levels")} sub={t("How a photo result becomes an alert (read-only)")} />
            {[
              ["warning", "bg-secondary-fixed text-on-secondary-fixed", "Please check", "The AI is 40% sure or more that an area is mould.", "Look at the bag"],
              ["report", "bg-error-container text-on-error-container", "Likely mould", "The AI is 80% sure or more.", "Remove the bag"],
              ["visibility_off", "bg-surface-container-high text-on-surface-variant", "Could not check", "No bag found, or the photo was too dark or blurry.", "Take another photo"],
            ].map(([icon, chip, name, rule, act]) => (
              <div key={name} className="flex items-center gap-space-sm p-space-sm rounded-lg bg-surface-container-low">
                <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${chip}`}><span aria-hidden="true" className="material-symbols-outlined text-[18px]">{icon}</span></span>
                <div className="flex-1 min-w-0">
                  <p className="font-label-md text-label-md text-on-surface font-semibold">{t(name)}</p>
                  <p className="font-body-md text-body-md text-on-surface-variant">{t(rule)}</p>
                </div>
                <span className="hidden sm:inline font-label-sm text-label-sm px-2 py-1 rounded bg-surface-container-lowest text-on-surface-variant">{t(act)}</span>
              </div>
            ))}
            <p className="font-label-sm text-label-sm text-on-surface-variant">Historical public-dataset figures below have not been revalidated for this release and do not establish accuracy on live farm footage.</p>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              {t("Measured on 752 public validation photos: at 40% no mould photo was missed, but 38% of healthy photos were flagged. At 80%, 10% of healthy photos were flagged and 14 of 373 mould photos were missed. That is why there are two levels.")}
            </p>
          </section>

          <section className={card}>
            <Head icon="info" title={t("About this prototype")} sub={t("What the AI is, and what it is not yet")} />
            <div className="grid grid-cols-2 gap-space-sm">
              <div className="p-space-sm rounded-lg bg-surface-container-low">
                <span className="font-label-sm text-label-sm text-on-surface-variant block">{t("Version")}</span>
                <span className="font-label-md text-label-md text-on-surface font-semibold">{t("Prototype v0.2")}</span>
              </div>
              <div className="p-space-sm rounded-lg bg-surface-container-low">
                <span className="font-label-sm text-label-sm text-on-surface-variant block">{t("AI model")}</span>
                <span className="font-label-md text-label-md text-on-surface font-semibold font-mono">yolov8n-2026-06-20</span>
              </div>
            </div>
            <div className="flex items-start gap-2 p-space-sm rounded-lg bg-secondary-fixed/50">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px] text-secondary">lightbulb</span>
              <p className="font-body-md text-body-md text-on-surface">
                {t("The AI was trained on public photos of oyster grow bags. It has not yet been tested on our own farm. AI checks are suggestions: always confirm by looking at the bag before removing it.")}
              </p>
            </div>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              {t("Example bag photos: Roboflow Universe \"contamination-detection\" dataset (Oyster Mushroom Fruiting Bag workspace), CC BY 4.0. Results shown are our model's own output.")}
            </p>
            <ResetDemo />
            <p className="font-label-sm text-label-sm text-on-surface-variant">{t("Demo changes (scans, resolved alerts, targets) are kept on this device for 12 hours. Reset to start the demo fresh.")}</p>
          </section>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-space-md">
          <section className={card}>
            <Head icon="badge" title={t("Account")} sub={user.guest ? t("You are using SmartPhset without an account") : t("Signed-in team")} />
            <div className="flex items-center gap-space-sm p-space-sm rounded-lg bg-surface-container-low">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${user.guest ? "bg-surface-container-high" : "bg-primary"}`}>
                <span aria-hidden="true" className={`material-symbols-outlined ${user.guest ? "text-on-surface-variant" : "text-on-primary"}`}>{user.guest ? "person_outline" : "person"}</span>
              </div>
              <div>
                <p className="font-label-md text-label-md text-on-surface font-semibold">{user.guest ? t("Guest") : user.name}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">{user.guest ? t("No account") : t("Team account")}</p>
              </div>
            </div>
            {user.guest ? (
              <form action="/api/auth/signout" method="post"><button type="submit" className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">login</span>{t("Sign in with an account")}
              </button></form>
            ) : (
              <form action="/api/auth/signout" method="post"><button type="submit" className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-error-container text-on-error-container font-label-md text-label-md font-semibold">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">logout</span>{t("Sign out")}
              </button></form>
            )}
          </section>

          <section className={card}>
            <Head icon="warehouse" title={t("Rooms")} sub={t("Grow rooms on this farm")} />
            <div className="flex flex-col divide-y divide-surface-container">
              {ROOMS.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 font-body-md text-body-md">
                  <span className="text-on-surface font-medium">{t(r.name)}</span>
                  <span className="text-on-surface-variant font-mono text-[13px]">{r.device} · {t("{n} bags", { n: r.bags.toLocaleString() })}</span>
                </div>
              ))}
            </div>
            <p className="font-label-sm text-label-sm text-on-surface-variant">{t("Each room has its own controller, sensor, fan and mister. Adding rooms from the website is coming later.")}</p>
          </section>

          <section className={card}>
            <Head icon="developer_board" title={t("Room hardware")} sub={t("Prototype parts, in every room")} />
            <div className="flex flex-col divide-y divide-surface-container">
              {[
                ["Controller", "ESP32"],
                ["Temperature and humidity", "SHT4x-class sensor"],
                ["Fan", "12 V fan, switched by the ESP32"],
                ["Mister", "Ultrasonic mist maker"],
                ["Water", "Float switch"],
                ["Camera", "Phone camera, by hand"],
                ["CO₂", "Not measured"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2 font-body-md text-body-md gap-2">
                  <span className="text-on-surface-variant">{t(k)}</span>
                  <span className="text-on-surface font-medium text-right">{t(v)}</span>
                </div>
              ))}
            </div>
            <Link href="/setup" className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-surface-container-low text-primary font-label-md text-label-md font-semibold">
              <span aria-hidden="true" className="material-symbols-outlined text-[18px]">photo_camera</span>{t("Camera setup guide")}
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
