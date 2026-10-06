"use client";

import { useLang, useT } from "@/lib/i18n";

export function LangChoice() {
  const { lang, setLang } = useLang();
  const t = useT();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
      {([["en", "English"], ["km", "ភាសាខ្មែរ (Khmer)"]] as const).map(([code, name]) => {
        const on = lang === code;
        return (
          <button key={code} type="button" onClick={() => setLang(code)} aria-pressed={on}
            className={`flex items-center justify-between p-space-sm px-space-md rounded-lg bg-surface-container-low text-left ${on ? "ring-2 ring-primary-container/60" : "hover:bg-surface-container"}`}>
            <span className={`flex items-center gap-2 font-label-md text-label-md ${on ? "text-on-surface font-semibold" : "text-on-surface-variant"}`}>
              <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${on ? "text-primary-container" : ""}`}>{on ? "radio_button_checked" : "radio_button_unchecked"}</span>
              {name}
            </span>
            {on && <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-primary-container text-on-primary">{t("Active")}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Compact EN | ខ្មែរ switch (sign-in page). */
export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center rounded-lg border border-outline-variant p-0.5 bg-surface-container-lowest" role="group" aria-label="Language">
      {(["en", "km"] as const).map((l, i) => (
        <span key={l} className="flex items-center">
          {i === 1 && <span className="text-outline-variant text-[12px] px-0.5">|</span>}
          <button type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
            className={`px-2.5 py-1 rounded font-label-md text-label-md ${lang === l ? "bg-surface-container-high text-on-surface font-semibold" : "text-on-surface-variant hover:text-on-surface"}`}>
            {l === "en" ? "EN" : "ខ្មែរ"}
          </button>
        </span>
      ))}
    </div>
  );
}
