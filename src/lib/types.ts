// Shapes follow docs/api-contract.md.

export type Level = "red" | "amber" | "green" | "grey";
export type Verdict = "contamination_suspected" | "no_contamination_seen" | "no_detection" | "camera_error";
export type Override = "auto" | "on" | "off";

export interface Room {
  id: string;
  name: string;
  device: string;
  bags: number;
}

export interface Reading {
  device: string;
  time: string;
  temp_c: number;
  rh: number;
  fan_on: boolean;
  mist_on: boolean;
  water_ok: boolean;
  fault: string;
  online: boolean;
  co2_ppm: null;
}

export interface Box {
  label: string;
  conf: number;
  xyxy: [number, number, number, number] | number[];
}

export interface Scan {
  id: string;
  room: string;
  time: string;
  camera: string;
  verdict: Verdict | string;
  level: Level | string;
  max_contaminated_conf: number;
  n_contaminated: number;
  n_healthy: number;
  width: number;
  height: number;
  boxes: Box[];
  file_url: string;
  model_version?: string;
  ms?: number;
  /** Set when the result is a saved example because no AI server is connected. */
  demo?: boolean;
  feedback?: "confirmed" | "fine";
}

export interface Alert {
  id: string;
  room: string;
  time: string;
  kind: "mould" | "climate" | "device";
  level: Level;
  title: string;
  detail: string;
  scan_id: string | null;
  resolved_at: string | null;
  resolution?: string;
}

export interface Settings {
  rh_low: number;
  rh_high: number;
  temp_max: number;
  fan_override: Override;
  mist_override: Override;
  fan_until: number | null;
  mist_until: number | null;
}
