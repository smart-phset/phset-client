import history from "./mock/history.json";
import type { Alert, Level, Reading, Room, Scan, Settings } from "./types";

/** A farm has several grow rooms; each has its own controller (ESP32). */
export const ROOMS: Room[] = [
  { id: "r1", name: "Room 1", device: "esp32-1", bags: 1000 },
  { id: "r2", name: "Room 2", device: "esp32-2", bags: 800 },
  { id: "r3", name: "Room 3", device: "esp32-3", bags: 600 },
];

const SCAN_ROOM: Record<string, string> = {
  s2: "r1", s5: "r1", s7: "r1", s1: "r1", s10: "r1",
  s6: "r2", s3: "r2", s8: "r2", s11: "r2",
  s4: "r3", s9: "r3", s12: "r3",
};

/** Feedback already given on older scans (matches the resolved alerts below). */
const SCAN_FEEDBACK: Record<string, "confirmed" | "fine"> = { s3: "confirmed", s1: "fine", s9: "fine" };

/** Real photos (public dataset) with our model's real results, run on 2026-10-03. Rooms are demo assignments. */
export const SCANS: Scan[] = (history as unknown as Scan[]).map((s) => ({ ...s, room: SCAN_ROOM[s.id] ?? "r1", feedback: SCAN_FEEDBACK[s.id] }));

/** All times are shown in Cambodia time (UTC+7), as ISO strings with +07:00. */
const KH_OFFSET_MS = 7 * 3600e3;
export function toKhISO(ms: number) {
  return new Date(ms + KH_OFFSET_MS).toISOString().slice(0, 19) + "+07:00";
}
export function nowISO() {
  return toKhISO(Date.now());
}
/** "Today", "Yesterday" or the date, in Cambodia time. */
export function dayLabel(iso: string) {
  const today = nowISO().slice(0, 10);
  const yesterday = toKhISO(Date.now() - 86400e3).slice(0, 10);
  const d = iso.slice(0, 10);
  return d === today ? "Today" : d === yesterday ? "Yesterday" : d;
}
/** The sample data was written for 2026-10-10 14:10. The app moves it so it ends a few minutes before "now". */
export const DEMO_NOW = Date.parse("2026-10-10T14:10:00+07:00");
export function shiftISO(iso: string, deltaMs: number) {
  return toKhISO(Date.parse(iso) + deltaMs);
}

const base = (device: string, temp_c: number, rh: number, fan_on: boolean, mist_on: boolean): Reading => ({
  device, time: "2026-10-10T14:02:30+07:00", temp_c, rh, fan_on, mist_on, water_ok: true, fault: "", online: true, co2_ppm: null,
});

/** Demo starting points: Room 1 all good, Room 2 slightly dry, Room 3 running warm. */
export const INITIAL_READINGS: Record<string, Reading> = {
  r1: base("esp32-1", 27.4, 88.2, true, false),
  r2: base("esp32-2", 26.9, 85.6, false, true),
  r3: base("esp32-3", 30.6, 86.4, true, false),
};

export const DEFAULT_SETTINGS: Settings = {
  rh_low: 85,
  rh_high: 90,
  temp_max: 30,
  fan_override: "auto",
  mist_override: "auto",
  fan_until: null,
  mist_until: null,
};

export const INITIAL_ALERTS: Alert[] = [
  { id: "a8", room: "r3", time: "2026-10-10T13:31:00+07:00", kind: "climate", level: "amber", title: "Temperature above target",
    detail: "30.4 °C, above 30 °C. Fan ventilating fresh air.", scan_id: null, resolved_at: null },
  { id: "a1", room: "r2", time: "2026-10-10T12:45:03+07:00", kind: "mould", level: "amber", title: "Please check a bag",
    detail: "AI scan, 70% confidence", scan_id: "s6", resolved_at: null },
  { id: "a2", room: "r2", time: "2026-10-10T12:15:47+07:00", kind: "mould", level: "red", title: "Likely mould on a bag",
    detail: "AI scan, 94% confidence", scan_id: "s3", resolved_at: "2026-10-10T12:31:00+07:00", resolution: "Bag removed" },
  { id: "a3", room: "r1", time: "2026-10-10T11:20:30+07:00", kind: "mould", level: "amber", title: "Please check a bag",
    detail: "AI scan, 74% confidence", scan_id: "s1", resolved_at: "2026-10-10T11:35:00+07:00", resolution: "Looks fine" },
  { id: "a7", room: "r3", time: "2026-10-10T10:50:12+07:00", kind: "mould", level: "amber", title: "Please check a bag",
    detail: "AI scan, 63% confidence", scan_id: "s9", resolved_at: "2026-10-10T11:05:00+07:00", resolution: "Looks fine" },
  { id: "a4", room: "r1", time: "2026-10-10T09:12:00+07:00", kind: "climate", level: "amber", title: "Humidity below target",
    detail: "84.1% for 6 minutes, mister running", scan_id: null, resolved_at: "2026-10-10T09:18:00+07:00", resolution: "Back in range" },
  { id: "a5", room: "r3", time: "2026-10-10T08:44:00+07:00", kind: "device", level: "grey", title: "Room did not report",
    detail: "No data for 3 minutes, back online at 08:47", scan_id: null, resolved_at: "2026-10-10T08:47:00+07:00", resolution: "Reconnected" },
  { id: "a6", room: "r2", time: "2026-10-09T18:30:00+07:00", kind: "device", level: "amber", title: "Water tank low",
    detail: "Mister paused until refilled", scan_id: null, resolved_at: "2026-10-09T18:52:00+07:00", resolution: "Refilled" },
];

/** Alert levels. Only the highest *contaminated* box counts (never the highest of all boxes). */
export const RED_AT = 0.8;
export const AMBER_AT = 0.4;

export function levelOf(s: Pick<Scan, "verdict" | "max_contaminated_conf" | "n_healthy">): Level {
  if (s.verdict === "no_detection" || s.verdict === "camera_error") return "grey";
  if (s.max_contaminated_conf >= RED_AT) return "red";
  if (s.max_contaminated_conf >= AMBER_AT) return "amber";
  return "green";
}

export const LEVEL_TEXT: Record<Level, { badge: string; icon: string; short: string }> = {
  red: { badge: "Likely mould", icon: "report", short: "Likely mould" },
  amber: { badge: "Please check this bag", icon: "warning", short: "Please check" },
  green: { badge: "No mould seen", icon: "verified", short: "No mould seen" },
  grey: { badge: "Could not check", icon: "visibility_off", short: "Could not check" },
};

/** Tailwind classes per level, using the Stitch tokens. */
export const LEVEL_CLASS: Record<Level, { chip: string; text: string; box: string }> = {
  red: { chip: "bg-error-container text-on-error-container", text: "text-error", box: "#ba1a1a" },
  amber: { chip: "bg-secondary-fixed text-on-secondary-fixed", text: "text-secondary", box: "#f3bf37" },
  green: { chip: "bg-tertiary-fixed text-tertiary", text: "text-tertiary", box: "#86d89b" },
  grey: { chip: "bg-surface-variant text-on-surface-variant", text: "text-on-surface-variant", box: "#737784" },
};

export function roomName(id: string) {
  return ROOMS.find((r) => r.id === id)?.name ?? id;
}

export function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}

export function hhmm(iso: string) {
  return iso.slice(11, 16);
}

export function cameraName(c: string) {
  return c === "phone-1" ? "Phone 1" : c;
}
