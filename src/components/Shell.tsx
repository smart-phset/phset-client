"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLang, useT } from "@/lib/i18n";
import type { SessionUser } from "@/lib/session";
import { useStore, type RoomStatus } from "@/lib/store";

const NAV = [
  { href: "/", label: "Overview", icon: "grid_view" },
  { href: "/scan", label: "AI scan", icon: "center_focus_weak" },
  { href: "/climate", label: "Climate", icon: "thermostat" },
  { href: "/alerts", label: "Alerts", icon: "warning" },
  { href: "/history", label: "Scan history", icon: "history" },
  { href: "/status", label: "System status", icon: "sensors" },
];

const ITEM = "flex items-center justify-between px-space-md py-2.5 rounded-lg transition-colors";
const IDLE = "font-body-md text-body-md text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface";
const ACTIVE = "bg-surface-container-low text-primary-container font-semibold";

export const STATUS_LABEL: Record<RoomStatus, string> = {
  ok: "All good", check: "Please check", mould: "Likely mould", climate: "Check climate", offline: "Room offline",
};

export const STATUS_DOT: Record<RoomStatus, string> = {
  ok: "bg-tertiary", check: "bg-secondary-container", mould: "bg-error", climate: "bg-secondary-container", offline: "bg-outline",
};

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
}

export function Sidebar({ user }: { user: SessionUser }) {
  const path = usePathname();
  const monitoring = path === "/" || path === "/climate" || path === "/history" || path === "/scan";
  const t = useT();
  const { openAlerts } = useStore();
  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-60 bg-surface-container-lowest border-r border-outline-variant z-50 flex-col justify-between select-none">
      <div className="flex flex-col">
        <Link href="/" className="h-16 px-space-md border-b border-outline-variant flex items-center gap-space-sm">
          <img alt="" className="h-9 w-9 object-contain" src="/brand/logo-mark.svg" />
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm tracking-tight text-[#19325A] leading-none">SmartPhset</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest mt-1">{t("Mould early-warning")}</span>
          </div>
        </Link>
        <nav className="p-space-sm flex flex-col gap-1">
          {NAV.map((n) => {
            const active = isActive(path, n.href);
            return (
              <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={`${ITEM} ${active ? ACTIVE : IDLE}`}>
                <div className="flex items-center gap-space-sm">
                  <span aria-hidden="true" className="material-symbols-outlined text-[20px]">{n.icon}</span>
                  <span>{t(n.label)}</span>
                </div>
                {!monitoring && n.href === "/alerts" && openAlerts.length > 0 && (
                  <span className="bg-error-container text-on-error-container font-label-sm text-label-sm px-1.5 py-0.5 rounded-full">{openAlerts.length}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-space-sm flex flex-col gap-space-sm border-t border-outline-variant bg-surface-container-lowest">
        <nav>
          <Link href="/settings" className={`flex items-center gap-space-sm px-space-md py-2.5 rounded-lg transition-colors ${isActive(path, "/settings") ? ACTIVE : IDLE}`}>
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">settings</span>
            <span>{t("Settings")}</span>
          </Link>
        </nav>
        <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low border border-outline-variant">
          <div className="flex items-center gap-space-sm min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${user.guest ? "bg-surface-container-high" : "bg-primary"}`}>
              <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${user.guest ? "text-on-surface-variant" : "text-on-primary"}`}>{user.guest ? "person_outline" : "person"}</span>
            </div>
            <div className="flex flex-col truncate">
              <span className="font-label-md text-label-md text-on-surface truncate">{user.guest ? t("Guest") : user.name}</span>
              <span className="font-label-sm text-label-sm text-on-surface-variant truncate">{user.guest ? t("No account") : t("Team account")}</span>
            </div>
          </div>
          <a href="/api/auth/signout" aria-label={user.guest ? t("Sign in") : t("Sign out")} title={user.guest ? t("Sign in") : t("Sign out")} className="material-symbols-outlined text-outline text-[18px] hover:text-on-surface">
            {user.guest ? "login" : "logout"}
          </a>
        </div>
      </div>
    </aside>
  );
}

function RoomPicker() {
  const { rooms, room, setRoom, statusOf } = useStore();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        aria-label={`${t(room.name)}: ${t(STATUS_LABEL[statusOf(room.id)])}`}
        className="flex items-center gap-space-xs px-2.5 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low transition-colors">
        <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-on-surface-variant">warehouse</span>
        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[statusOf(room.id)]}`} />
        <span className="font-label-md text-label-md text-on-surface whitespace-nowrap">{t(room.name)}</span>
        <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
      </button>
      {open && (
        <div role="listbox" className="absolute left-0 top-full mt-1 w-60 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-md p-1 z-50">
          {rooms.map((r) => (
            <button key={r.id} role="option" aria-selected={r.id === room.id} type="button" onClick={() => { setRoom(r.id); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left ${r.id === room.id ? "bg-surface-container-low" : "hover:bg-surface-container-low"}`}>
              <span className="flex items-center gap-2 font-label-md text-label-md text-on-surface">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[statusOf(r.id)]}`} />{t(r.name)}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">{t(STATUS_LABEL[statusOf(r.id)])}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Topbar({ user }: { user: SessionUser }) {
  const path = usePathname();
  const monitoring = path === "/" || path === "/climate" || path === "/history" || path === "/scan";
  const { updatedAgo, reading, live } = useStore();
  const { lang, setLang } = useLang();
  const t = useT();
  const offline = updatedAgo > 90 || !reading.online;
  return (
    <header className="fixed top-0 left-0 lg:left-60 right-0 h-16 bg-surface-container-lowest border-b border-outline-variant z-40 flex items-center justify-between gap-2 px-space-sm sm:px-space-md lg:px-space-lg">
      <div className="flex items-center gap-space-sm sm:gap-space-md min-w-0">
        <Link href="/" className="lg:hidden flex items-center shrink-0">
          <img alt="SmartPhset" className="h-8 w-8 object-contain" src="/brand/logo-mark.svg" />
        </Link>
        {monitoring ? <Link href="/" className="font-label-md text-primary font-semibold">{t("Grow room monitoring")}</Link> : <RoomPicker />}
        {!monitoring && !live && (
          <span className="hidden md:inline-flex font-label-sm text-label-sm px-2 py-1 rounded bg-surface-container text-on-surface-variant" title={t("No grow room server connected. Readings are simulated and scan photos are real saved examples.")}>
            {t("Demo data")}
          </span>
        )}
      </div>
      <div className="flex items-center gap-space-xs sm:gap-space-sm lg:gap-space-md">
        {!monitoring && <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-outline-variant bg-surface">
          <span className="relative flex h-2 w-2">
            {!offline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary-container opacity-75" />}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${offline ? "bg-outline" : "bg-tertiary"}`} />
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant tabular-nums whitespace-nowrap">
            {offline ? t("Room offline") : live ? t("Live · updated {n} s ago", { n: updatedAgo }) : t("Demo · updated {n} s ago", { n: updatedAgo })}
          </span>
        </div>}
        <div className="flex items-center rounded-lg border border-outline-variant p-0.5 bg-surface" role="group" aria-label="Language">
          {(["en", "km"] as const).map((l, i) => (
            <span key={l} className="flex items-center">
              {i === 1 && <span className="text-outline-variant text-[12px] px-0.5">|</span>}
              <button type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
                className={`px-2.5 py-1.5 rounded font-label-sm text-label-sm ${lang === l ? "bg-surface-container-high text-on-surface font-semibold" : "text-on-surface-variant hover:text-on-surface"}`}>
                {l === "en" ? "EN" : "ខ្មែរ"}
              </button>
            </span>
          ))}
        </div>
        <Link href="/settings" aria-label={t("Settings")} title={user.guest ? t("Guest") : user.name} className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${user.guest ? "bg-surface-container-high" : "bg-primary"}`}>
          <span aria-hidden="true" className={`material-symbols-outlined text-[18px] ${user.guest ? "text-on-surface-variant" : "text-on-primary"}`}>{user.guest ? "person_outline" : "person"}</span>
        </Link>
      </div>
    </header>
  );
}

export function MobileNav() {
  const path = usePathname();
  const monitoring = path === "/" || path === "/climate" || path === "/history" || path === "/scan";
  const t = useT();
  const { openAlerts } = useStore();
  const cls = (href: string) =>
    `flex-1 flex flex-col items-center justify-center min-h-[44px] min-w-[44px] gap-1 transition-colors ${isActive(path, href) ? "text-primary font-bold" : "text-on-surface-variant"}`;
  return (
    <nav className="lg:hidden fixed bottom-0 w-full z-50 bg-surface/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(0,0,0,0.05)]">
      <div className="flex justify-between items-center h-20 px-space-sm relative">
        <Link className={cls("/")} href="/">
          <span aria-hidden="true" className="material-symbols-outlined text-[24px]">dashboard</span>
          <span className="font-label-sm text-label-sm">{t("Overview")}</span>
        </Link>
        <Link className={cls("/climate")} href="/climate">
          <span aria-hidden="true" className="material-symbols-outlined text-[24px]">thermostat</span>
          <span className="font-label-sm text-label-sm">{t("Climate")}</span>
        </Link>
        <div className="relative flex flex-col items-center justify-center px-space-xs -top-4">
          <Link aria-label={t("Scan")} className="w-14 h-14 rounded-full bg-secondary-container text-on-secondary-fixed flex items-center justify-center shadow-[0_4px_12px_rgba(15,27,45,0.12)] transition-transform active:scale-95" href="/scan">
            <span aria-hidden="true" className="material-symbols-outlined text-[28px]">photo_camera</span>
          </Link>
          <span className="font-label-sm text-label-sm text-on-surface font-semibold mt-1">{t("Scan")}</span>
        </div>
        <Link className={`${cls("/alerts")} relative`} href="/alerts">
          <div className="relative flex items-center justify-center">
            <span aria-hidden="true" className="material-symbols-outlined text-[24px]">notifications</span>
            {!monitoring && openAlerts.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-error text-on-error font-label-sm text-[10px] w-4 h-4 rounded-full flex items-center justify-center leading-none">{openAlerts.length}</span>
            )}
          </div>
          <span className="font-label-sm text-label-sm">{t("Alerts")}</span>
        </Link>
        <Link className={cls("/history")} href="/history">
          <span aria-hidden="true" className="material-symbols-outlined text-[24px]">history</span>
          <span className="font-label-sm text-label-sm">{t("History")}</span>
        </Link>
      </div>
    </nav>
  );
}
