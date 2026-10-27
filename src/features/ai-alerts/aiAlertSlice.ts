import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Detection } from "../../lib/monitoring.ts";
import { MAX_TOASTS, TOAST_DURATION_MS, observeDetection, type AIToast, type CameraSeverityState } from "./aiAlertTransitions.ts";

export interface AINotification extends AIToast { read: boolean }
const MAX_NOTIFICATIONS = 100;

export interface AIAlertState {
  cameras: Record<string, CameraSeverityState>;
  toasts: AIToast[];
  notifications: AINotification[];
}
const initialState: AIAlertState = { cameras: {}, toasts: [], notifications: [] };
export const aiAlertSlice = createSlice({
  name: "aiAlerts",
  initialState,
  reducers: {
    detectionObserved(state, { payload }: PayloadAction<{ detection: Detection; observedAt: number }>) {
      const { detection, observedAt } = payload;
      const next = observeDetection(state.cameras[detection.camera_id], detection, observedAt);
      if (!next) return;
      state.cameras[detection.camera_id] = next.camera;
      if (next.toast) {
        state.toasts = [...state.toasts.filter(t => observedAt - t.createdAt < TOAST_DURATION_MS), next.toast].slice(-MAX_TOASTS);
        // Bounded tab history, independent of dismissing/expiring transient toasts.
        state.notifications = [{ ...next.toast, read: false }, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      }
    },
    toastDismissed(state, { payload }: PayloadAction<string>) {
      state.toasts = state.toasts.filter(t => t.id !== payload);
    },
    toastExpired(state, { payload }: PayloadAction<{ id: string; now: number }>) {
      state.toasts = state.toasts.filter(t => t.id !== payload.id || payload.now - t.createdAt < TOAST_DURATION_MS);
    },
    notificationsRead(state) {
      for (const notification of state.notifications) notification.read = true;
    },
    notificationsCleared(state) { state.notifications = []; },
    // Clearing visible alerts must not reset baselines or replay a detection.
    alertsCleared(state) { state.toasts = []; },
  },
});
export const { detectionObserved, toastDismissed, toastExpired, alertsCleared, notificationsRead, notificationsCleared } = aiAlertSlice.actions;
export default aiAlertSlice.reducer;
