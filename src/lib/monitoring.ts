// Browser-safe contracts for the inspected Spring API. No credentials or demo data.
export const ACTUATORS = ["fan", "light", "pump"] as const;
export type Actuator = (typeof ACTUATORS)[number];
export const POLL_MS = 5_000;
export const STALE_MS = 20_000;
export const OFFLINE_MS = 60_000;
export const CONFIRM_MS = 20_000;

export interface DeviceState {
  device_id: string;
  temperature_c: number | null;
  humidity_percent: number | null;
  soil_moisture_percent: number | null;
  telemetry_captured_at: string | null;
  telemetry_received_at: string | null;
  fan: boolean | null;
  light: boolean | null;
  pump: boolean | null;
  state_captured_at: string | null;
  state_received_at: string | null;
}

export interface CommandReceipt {
  command_id: string;
  on: boolean;
  expires_at: number;
}

export interface Detection {
  id: string;
  camera_id: string;
  captured_at: string;
  created_at: string;
  verdict: string;
  severity: "RED" | "AMBER" | "GREEN" | "GREY";
  message: string;
  max_conf: number;
  max_contaminated_conf: number;
  n_contaminated: number;
  n_healthy: number;
}

export interface MonitorSnapshot {
  deviceId: string;
  state: DeviceState;
  canControl: boolean;
  // Spring cannot prove soil validity. This installation has no soil sensor.
  soil: { available: false; reason: string };
}

export class MonitoringError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function timestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const nullableTime = (v: unknown) => v === null || (typeof v === "string" && timestampMs(v) !== null);
const nullableMetric = (v: unknown, min: number, max: number) =>
  v === null || (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max);

export function parseDeviceState(value: unknown, deviceId: string): DeviceState {
  if (!record(value) || value.device_id !== deviceId ||
      !nullableMetric(value.temperature_c, -20, 60) ||
      !nullableMetric(value.humidity_percent, 0, 100) ||
      !nullableMetric(value.soil_moisture_percent, 0, 100) ||
      !["telemetry_captured_at", "telemetry_received_at", "state_captured_at", "state_received_at"].every(k => nullableTime(value[k])) ||
      !ACTUATORS.every(k => value[k] === null || typeof value[k] === "boolean")) {
    throw new MonitoringError("invalid_response", "The backend returned invalid device state.");
  }
  return {
    device_id: deviceId,
    temperature_c: value.temperature_c as number | null,
    humidity_percent: value.humidity_percent as number | null,
    // Never propagate floating GPIO34 percentages to the browser.
    soil_moisture_percent: null,
    telemetry_captured_at: value.telemetry_captured_at as string | null,
    telemetry_received_at: value.telemetry_received_at as string | null,
    state_captured_at: value.state_captured_at as string | null,
    state_received_at: value.state_received_at as string | null,
    fan: value.fan as boolean | null,
    light: value.light as boolean | null,
    pump: value.pump as boolean | null,
  };
}

export function parseReceipt(value: unknown, on: boolean): CommandReceipt {
  if (!record(value) || typeof value.command_id !== "string" || !value.command_id ||
      value.on !== on || typeof value.expires_at !== "number" || !Number.isSafeInteger(value.expires_at)) {
    throw new MonitoringError("invalid_response", "Command response was invalid. Check reported state before trying again.");
  }
  return { command_id: value.command_id, on, expires_at: value.expires_at };
}

export function parseDetection(value: unknown, cameraId: string): Detection {
  if (!record(value) || value.camera_id !== cameraId || typeof value.id !== "string" ||
      typeof value.captured_at !== "string" || timestampMs(value.captured_at) === null ||
      typeof value.created_at !== "string" || timestampMs(value.created_at) === null ||
      !["contamination_suspected", "no_contamination_seen", "no_detection", "camera_error"].includes(String(value.verdict)) ||
      !["RED", "AMBER", "GREEN", "GREY"].includes(String(value.severity)) || typeof value.message !== "string" ||
      !["max_conf", "max_contaminated_conf"].every(k => typeof value[k] === "number" && Number.isFinite(value[k]) && value[k] >= 0 && value[k] <= 1) ||
      !["n_contaminated", "n_healthy"].every(k => typeof value[k] === "number" && Number.isSafeInteger(value[k]) && value[k] >= 0) ||
      ((value.verdict === "no_detection" || value.verdict === "camera_error") && value.severity !== "GREY")) {
    throw new MonitoringError("invalid_response", "The backend returned an invalid AI result.");
  }
  // Explicit selection excludes unrelated fields and any upstream error details.
  return {
    id: value.id, camera_id: cameraId,
    captured_at: value.captured_at, created_at: value.created_at,
    verdict: value.verdict as string, severity: value.severity as Detection["severity"],
    message: value.message, max_conf: value.max_conf as number,
    max_contaminated_conf: value.max_contaminated_conf as number,
    n_contaminated: value.n_contaminated as number, n_healthy: value.n_healthy as number,
  };
}

export type Freshness = "active" | "stale" | "offline" | "unavailable";
export function freshness(captured: string | null, received: string | null, now: number): Freshness {
  const capture = timestampMs(captured), receive = timestampMs(received);
  if (capture === null || receive === null || capture > now + POLL_MS || receive > now + POLL_MS) return "unavailable";
  // Old captured data remains stale even if it was just ingested.
  const age = Math.max(now - capture, now - receive);
  return age > OFFLINE_MS ? "offline" : age > STALE_MS ? "stale" : "active";
}

export interface PendingCommand {
  target: boolean;
  sentAt: number;
  baselineCaptured: string | null;
  baselineReceived: string | null;
}

export function confirmsCommand(state: DeviceState, actuator: Actuator, pending: PendingCommand, now: number): boolean {
  const capture = timestampMs(state.state_captured_at), receive = timestampMs(state.state_received_at);
  return state[actuator] === pending.target && freshness(state.state_captured_at, state.state_received_at, now) === "active" &&
    capture !== null && receive !== null && receive >= pending.sentAt &&
    capture > (timestampMs(pending.baselineCaptured) ?? -Infinity) &&
    receive > (timestampMs(pending.baselineReceived) ?? -Infinity);
}

export async function browserJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store", signal: init.signal ?? AbortSignal.timeout(8_000) });
  const value: unknown = await response.json();
  if (!response.ok) {
    throw new MonitoringError(record(value) && typeof value.error === "string" ? value.error : "request_failed",
      record(value) && typeof value.message === "string" ? value.message : "Request failed.", response.status);
  }
  return value as T;
}
