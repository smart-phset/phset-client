import type { RootState } from "../../store/store";
export const selectAIToasts = (state: RootState) => state.aiAlerts.toasts;
export const selectCameraSeverity = (state: RootState, cameraId: string) => state.aiAlerts.cameras[cameraId];
export const selectAINotifications = (state: RootState) => state.aiAlerts.notifications;
export const selectAIUnreadCount = (state: RootState) => state.aiAlerts.notifications.filter(n => !n.read).length;
