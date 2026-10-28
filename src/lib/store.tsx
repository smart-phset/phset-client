"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_SETTINGS, DEMO_NOW, INITIAL_ALERTS, INITIAL_READINGS, ROOMS, SCANS, hhmm, levelOf, nowISO, pct, shiftISO } from "./data";
import type { Alert, Override, Reading, Room, Scan, Settings } from "./types";

export interface Activity {
  time: string;
  event: string;
  reason: string;
  kind: "mist" | "fan";
  on: boolean;
}

export type RoomStatus = "ok" | "check" | "mould" | "climate" | "offline";

interface Store {
  rooms: Room[];
  room: Room;
  setRoom: (id: string) => void;
  /** Current room */
  reading: Reading;
  settings: Settings;
  activity: Activity[];
  updatedAgo: number;
  /** All rooms */
  readings: Record<string, Reading>;
  settingsOf: (roomId: string) => Settings;
  agoOf: (roomId: string) => number;
  statusOf: (roomId: string) => RoomStatus;
  live: boolean; // true when real backend data is flowing
  scans: Scan[];
  alerts: Alert[];
  openAlerts: Alert[];
  addScan: (s: Scan) => void;
  setFeedback: (scanId: string, fb: "confirmed" | "fine") => void;
  resolveAlert: (id: string, resolution: string) => void;
  setOverride: (device: "fan" | "mist", value: Override) => void;
  saveTargets: (t: Pick<Settings, "rh_low" | "rh_high" | "temp_max">) => void;
}

const Ctx = createContext<Store | null>(null);
const OVERRIDE_MS = 10 * 60 * 1000;
const ROOM_KEY = "sp_room";
export const STATE_KEY = "sp_demo_v1";
const STATE_TTL_MS = 12 * 3600e3;

const SEED_ACTIVITY: Record<string, Activity[]> = {
  r1: [
    { time: "14:03", event: "Mister off", reason: "Humidity reached 90.1%, upper target", kind: "mist", on: false },
    { time: "14:02", event: "Mister on", reason: "Humidity 84.6%, below 85% target", kind: "mist", on: true },
    { time: "13:40", event: "Fan on", reason: "Fresh-air schedule", kind: "fan", on: true },
  ],
  r2: [{ time: "13:58", event: "Mister on", reason: "Humidity 84.8%, below 85% target", kind: "mist", on: true }],
  r3: [{ time: "13:31", event: "Fan on", reason: "Temperature 30.4 °C, above 30 °C. Ventilating fresh air", kind: "fan", on: true }],
};

function nowHHMM() {
  return nowISO().slice(11, 16);
}

function shiftHHMM(hhmmStr: string, deltaMs: number) {
  return shiftISO(`2026-10-10T${hhmmStr}:00+07:00`, deltaMs).slice(11, 16);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const monitoring = path === "/" || path === "/climate" || path === "/history" || path === "/status";
  const [roomId, setRoomId] = useState(ROOMS[0].id);
  const [readings, setReadings] = useState<Record<string, Reading>>(INITIAL_READINGS);
  const [lastUpdate, setLastUpdate] = useState(() => Date.now() - 8000);
  const [tick, setTick] = useState(() => Date.now());
  const [live, setLive] = useState(false);
  const [settings, setSettings] = useState<Record<string, Settings>>(() => Object.fromEntries(ROOMS.map((r) => [r.id, { ...DEFAULT_SETTINGS }])));
  const [scans, setScans] = useState<Scan[]>(SCANS);
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [activity, setActivity] = useState<Record<string, Activity[]>>(SEED_ACTIVITY);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Load the saved demo state (kept 12 hours), or move the sample timeline so it ends a few minutes before now.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && saved.v === 1 && Date.now() - saved.savedAt < STATE_TTL_MS) {
        setScans(saved.scans);
        setAlerts(saved.alerts);
        setSettings(saved.settings);
        setActivity(saved.activity);
        setLoaded(true);
        return;
      }
    } catch {}
    const delta = Date.now() - DEMO_NOW;
    setScans((xs) => xs.map((s) => (s.id.startsWith("n") ? s : { ...s, time: shiftISO(s.time, delta) })));
    setAlerts((xs) => xs.map((a) => (a.id.startsWith("a-") ? a : {
      ...a, time: shiftISO(a.time, delta), resolved_at: a.resolved_at ? shiftISO(a.resolved_at, delta) : null,
    })));
    setActivity((all) => Object.fromEntries(Object.entries(all).map(([room, xs]) => [room, xs.map((x) => ({ ...x, time: shiftHHMM(x.time, delta) }))])));
    setLoaded(true);
  }, []);

  // Save what the user did, so a page reload does not undo it. Photos held only in this tab (blob:) are not kept.
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify({
        v: 1, savedAt: Date.now(), scans: scans.filter((s) => !s.file_url.startsWith("blob:")), alerts, settings, activity,
      }));
    } catch {}
  }, [loaded, scans, alerts, settings, activity]);

  // Remember the chosen room between visits.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ROOM_KEY);
      if (saved && ROOMS.some((r) => r.id === saved)) setRoomId(saved);
    } catch {}
  }, []);
  const setRoom = useCallback((id: string) => {
    setRoomId(id);
    try {
      localStorage.setItem(ROOM_KEY, id);
    } catch {}
  }, []);

  // Clock for "updated N s ago" and override countdowns.
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Expire manual overrides.
  useEffect(() => {
    setSettings((all) => {
      let changed = false;
      const next = { ...all };
      for (const [id, s] of Object.entries(all)) {
        let n = s;
        if (s.fan_until && tick > s.fan_until) n = { ...n, fan_override: "auto", fan_until: null };
        if (s.mist_until && tick > s.mist_until) n = { ...n, mist_override: "auto", mist_until: null };
        if (n !== s) {
          next[id] = n;
          changed = true;
        }
      }
      return changed ? next : all;
    });
  }, [tick]);

  const log = useCallback((room: string, a: Omit<Activity, "time">) => {
    setActivity((all) => ({ ...all, [room]: [{ ...a, time: nowHHMM() }, ...(all[room] ?? [])].slice(0, 30) }));
  }, []);

  // Readings: real backend when connected, otherwise a gentle simulation of each room's box.
  useEffect(() => {
    if (monitoring) return; // Live pages use Spring and must never fall back to demo readings.
    let stop = false;
    async function poll() {
      let any = false;
      for (const r of ROOMS) {
        try {
          const res = await fetch(`/api/readings/latest?device=${r.device}`, { cache: "no-store" });
          const j = await res.json();
          if (!stop && j && !j.demo && typeof j.temp_c === "number") {
            setReadings((all) => ({ ...all, [r.id]: j }));
            any = true;
          }
        } catch {}
      }
      if (any) {
        setLastUpdate(Date.now());
        setLive(true);
      }
      return any;
    }
    function simulate() {
      setReadings((all) => {
        const next: Record<string, Reading> = {};
        for (const room of ROOMS) {
          const r = all[room.id];
          const s = settingsRef.current[room.id];
          const warm = room.id === "r3";
          const temp = Math.min(warm ? 31.2 : 28.8, Math.max(warm ? 29.6 : 26.4, r.temp_c + (Math.random() - 0.5) * 0.3));
          let mistOn = r.mist_on;
          let rh = r.rh + (mistOn ? 0.7 + Math.random() * 0.4 : -(0.15 + Math.random() * 0.25));
          if (s.mist_override === "auto") {
            if (!mistOn && rh < s.rh_low) {
              mistOn = true;
              log(room.id, { event: "Mister on", reason: `Humidity ${rh.toFixed(1)}%, below ${s.rh_low}% target`, kind: "mist", on: true });
            } else if (mistOn && rh >= s.rh_high) {
              mistOn = false;
              log(room.id, { event: "Mister off", reason: `Humidity reached ${rh.toFixed(1)}%, upper target`, kind: "mist", on: false });
            }
          } else {
            mistOn = s.mist_override === "on";
          }
          rh = Math.min(93, Math.max(82, rh));
          const fanAuto = temp > s.temp_max || new Date().getMinutes() % 5 < 2; // over temperature, or fresh-air schedule
          const fanOn = s.fan_override === "auto" ? fanAuto : s.fan_override === "on";
          next[room.id] = { ...r, temp_c: +temp.toFixed(1), rh: +rh.toFixed(1), mist_on: mistOn, fan_on: fanOn, time: new Date().toISOString() };
        }
        return next;
      });
      setLastUpdate(Date.now());
    }
    let id: ReturnType<typeof setInterval>;
    poll().then((ok) => {
      if (stop) return;
      id = setInterval(ok ? poll : simulate, ok ? 10000 : 5000);
    });
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [log, monitoring]);

  const addScan = useCallback((s: Scan) => {
    setScans((xs) => [s, ...xs]);
    const level = levelOf(s);
    if (level === "red" || level === "amber") {
      setAlerts((xs) => [
        { id: `a-${s.id}`, room: s.room, time: s.time, kind: "mould", level,
          title: level === "red" ? "Likely mould on a bag" : "Please check a bag",
          detail: `AI scan at ${hhmm(s.time)}, ${pct(s.max_contaminated_conf)} confidence`,
          scan_id: s.id, resolved_at: null },
        ...xs,
      ]);
    }
  }, []);

  const alertsRef = useRef(alerts);
  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  const resolveAlert = useCallback((id: string, resolution: string) => {
    const scanId = alertsRef.current.find((a) => a.id === id)?.scan_id;
    setAlerts((xs) => xs.map((a) => (a.id === id ? { ...a, resolved_at: nowISO(), resolution } : a)));
    // resolving a mould alert also records the answer on its scan
    if (scanId) {
      const fb: "confirmed" | "fine" = resolution === "Bag removed" ? "confirmed" : "fine";
      setScans((xs) => xs.map((s) => (s.id === scanId && !s.feedback ? { ...s, feedback: fb } : s)));
    }
  }, []);

  const setFeedback = useCallback((scanId: string, fb: "confirmed" | "fine") => {
    setScans((xs) => xs.map((s) => (s.id === scanId ? { ...s, feedback: fb } : s)));
    setAlerts((xs) => xs.map((a) => (a.scan_id === scanId && !a.resolved_at
      ? { ...a, resolved_at: nowISO(), resolution: fb === "confirmed" ? "Bag removed" : "Looks fine" } : a)));
  }, []);

  const setOverride = useCallback((device: "fan" | "mist", value: Override) => {
    const until = value === "auto" ? null : Date.now() + OVERRIDE_MS;
    setSettings((all) => {
      const s = all[roomId];
      return { ...all, [roomId]: device === "fan" ? { ...s, fan_override: value, fan_until: until } : { ...s, mist_override: value, mist_until: until } };
    });
    log(roomId, { event: `${device === "fan" ? "Fan" : "Mister"} ${value === "auto" ? "back to Auto" : value}`,
      reason: value === "auto" ? "Manual control ended" : "Manual control from the website, 10 minutes", kind: device, on: value === "on" });
  }, [log, roomId]);

  const saveTargets = useCallback((t: Pick<Settings, "rh_low" | "rh_high" | "temp_max">) => {
    setSettings((all) => ({ ...all, [roomId]: { ...all[roomId], ...t } }));
  }, [roomId]);

  const value = useMemo<Store>(() => {
    const agoOf = () => Math.max(0, Math.round((tick - lastUpdate) / 1000));
    const settingsOf = (id: string) => settings[id] ?? DEFAULT_SETTINGS;
    const openAlerts = alerts.filter((a) => !a.resolved_at);
    const statusOf = (id: string): RoomStatus => {
      const r = readings[id];
      const s = settingsOf(id);
      if (!r || !r.online || agoOf() > 90) return "offline";
      const open = openAlerts.filter((a) => a.room === id);
      if (open.some((a) => a.level === "red")) return "mould";
      if (open.some((a) => a.kind === "mould")) return "check";
      if (r.temp_c > s.temp_max || r.rh < s.rh_low - 1 || r.rh > s.rh_high + 1) return "climate";
      return "ok";
    };
    return {
      rooms: ROOMS,
      room: ROOMS.find((r) => r.id === roomId) ?? ROOMS[0],
      setRoom,
      reading: readings[roomId],
      settings: settingsOf(roomId),
      activity: activity[roomId] ?? [],
      updatedAgo: agoOf(),
      readings, settingsOf, agoOf, statusOf, live, scans, alerts, openAlerts,
      addScan, setFeedback, resolveAlert, setOverride, saveTargets,
    };
  }, [roomId, setRoom, readings, settings, activity, tick, lastUpdate, live, scans, alerts, addScan, setFeedback, resolveAlert, setOverride, saveTargets]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

/** Time left on a manual override as m:ss, or null. */
export function useCountdown(until: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!until) return null;
  const s = Math.max(0, Math.round((until - now) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
