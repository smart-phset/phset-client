import type { Detection } from "../../lib/monitoring.ts";

export type AISeverity = Detection["severity"];
// 5s publication + 2s polling + normal transport latency, never old saved scans.
export const DETECTION_FRESH_MS = 15_000;
export const TOAST_DURATION_MS = 7_000;
export const MAX_TOASTS = 3;
export interface CameraSeverityState {
  currentSeverity: AISeverity | null;
  previousSeverity: AISeverity | null;
  lastValidSeverity: Exclude<AISeverity, "GREY"> | null;
  lastDetectionId: string | null;
  lastCapturedAt: string | null;
  initialized: boolean;
  seenIds: string[];
}
export interface AIToast {
  id: string;
  cameraId: string;
  from: AISeverity | null;
  to: AISeverity;
  title: string;
  message: string;
  createdAt: number;
  capturedAt: string;
  confidence: number | null;
  type: "success" | "warning" | "error" | "info";
}
export function isFreshDetection(detection: Pick<Detection, "captured_at">, now: number): boolean {
  const captured = Date.parse(detection.captured_at);
  return Number.isFinite(captured) && captured <= now + 5_000 && now - captured <= DETECTION_FRESH_MS;
}

// Backend severity is authoritative; confidence and counts never determine severity.
export function severityTransition(from: AISeverity | null, to: AISeverity): Pick<AIToast, "title" | "message" | "type"> | null {
  if (from === to) return null;
  if (to === "GREY") return from === null ? null : { type: "info", title: "AI result unknown", message: "No usable detection. Check the camera and inference service." };
  if (to === "RED") return { type: "error", title: "Critical AI detection", message: "High-risk detection. Immediate inspection recommended." };
  if (to === "AMBER") return from === "RED"
    ? { type: "warning", title: "AI severity improving", message: "Severity is now Yellow. Possible contamination still requires inspection." }
    : { type: "warning", title: "Possible contamination", message: "AI reports Yellow. Possible contamination; inspection recommended." };
  // Unknown/initial GREEN is a baseline, never a claimed recovery.
  if (from === null || from === "GREY") return null;
  return { type: "success", title: "AI severity recovered", message: "No contamination observed in the latest valid detection. Continue monitoring." };
}

export function observeDetection(previous: CameraSeverityState | undefined, detection: Detection, now: number):
  { camera: CameraSeverityState; toast: AIToast | null } | null {
  if (!detection.id || !detection.camera_id || !isFreshDetection(detection, now)) return null;
  if (previous && (previous.seenIds.includes(detection.id) ||
      Date.parse(detection.captured_at) <= Date.parse(previous.lastCapturedAt ?? ""))) return null;
  const from = previous?.currentSeverity ?? null;
  const transition = severityTransition(from, detection.severity);
  const camera: CameraSeverityState = {
    currentSeverity: detection.severity,
    previousSeverity: previous?.lastValidSeverity ?? null,
    lastValidSeverity: detection.severity === "GREY" ? previous?.lastValidSeverity ?? null : detection.severity,
    lastDetectionId: detection.id,
    lastCapturedAt: detection.captured_at,
    initialized: true,
    seenIds: [...(previous?.seenIds ?? []), detection.id].slice(-64),
  };
  return { camera, toast: transition ? {
    ...transition, id: JSON.stringify([detection.camera_id, detection.id]), cameraId: detection.camera_id,
    from, to: detection.severity, createdAt: now, capturedAt: detection.captured_at,
    confidence: detection.severity === "AMBER" || detection.severity === "RED" ? detection.max_contaminated_conf : null,
  } : null };
}
