"use client";
import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { selectAIToasts } from "./aiAlertSelectors";
import { toastDismissed, toastExpired } from "./aiAlertSlice";
import { TOAST_DURATION_MS, type AIToast } from "./aiAlertTransitions";
import { AISeverityBadge, severityStyles } from "./AISeverityBadge";

export function AIToastCard({ toast }: { toast: AIToast }) {
  const dispatch = useAppDispatch();
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const delay = Math.max(0, toast.createdAt + TOAST_DURATION_MS - Date.now());
    const fade = setTimeout(() => setClosing(true), Math.max(0, delay - 200));
    const expire = setTimeout(() => dispatch(toastExpired({ id: toast.id, now: Date.now() })), delay);
    return () => { clearTimeout(fade); clearTimeout(expire); };
  }, [toast.id, toast.createdAt, dispatch]);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => dispatch(toastDismissed(toast.id)), 200);
    return () => clearTimeout(timer);
  }, [closing, toast.id, dispatch]);
  const icon = { success: "check_circle", warning: "warning", error: "error", info: "info" }[toast.type];
  return <article className={`ai-toast rounded-xl p-4 shadow-xl border border-outline/20 ${severityStyles[toast.to]} ${closing ? "ai-toast-closing" : ""}`}
    role={toast.type === "error" ? "alert" : "status"} aria-atomic="true">
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="material-symbols-outlined">{icon}</span>
      <div className="min-w-0 flex-1"><h2 className="font-semibold">{toast.title}</h2>
        <AISeverityBadge severity={toast.to} />
        <p className="mt-1 text-sm">{toast.message}</p>
        {toast.confidence !== null && <p className="mt-1 text-sm">AI contamination confidence: {Math.round(toast.confidence * 100)}%</p>}<p className="mt-2 text-xs break-all">Camera: {toast.cameraId}</p></div>
      <button type="button" onClick={() => setClosing(true)} aria-label={`Dismiss ${toast.title}`}
        className="rounded p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        <span aria-hidden="true" className="material-symbols-outlined text-[20px]">close</span>
      </button>
    </div>
  </article>;
}
export function AIToastContainer() {
  const toasts = useAppSelector(selectAIToasts);
  return <aside aria-label="AI severity notifications" aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-3 top-20 z-[100] flex flex-col gap-3 sm:left-auto sm:right-5 sm:w-96">
    {toasts.map(toast => <div className="pointer-events-auto" key={toast.id}><AIToastCard toast={toast} /></div>)}
  </aside>;
}
