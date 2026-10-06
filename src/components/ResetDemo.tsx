"use client";

import { useT } from "@/lib/i18n";
import { STATE_KEY } from "@/lib/store";

/** Clears the saved demo state (scans, alerts, targets, overrides) and reloads the sample data. */
export function ResetDemo() {
  const t = useT();
  return (
    <button type="button" onClick={() => { try { localStorage.removeItem(STATE_KEY); } catch {} window.location.href = "/"; }}
      className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-surface-container-low text-on-surface font-label-md text-label-md font-semibold hover:bg-surface-container">
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">restart_alt</span>{t("Reset demo data")}
    </button>
  );
}
