import "server-only";
import { currentUser } from "./session";
import { monitoringHandlers } from "./monitoring-proxy";

export function monitoringApi() {
  return monitoringHandlers({
    baseUrl: process.env.SMARTPHSET_API_BASE_URL || "",
    iotKey: process.env.SMARTPHSET_IOT_API_KEY || "",
    deviceId: process.env.SMARTPHSET_DEVICE_ID || "grow-room-1",
    cameraId: process.env.SMARTPHSET_AI_CAMERA_ID || "",
  }, currentUser);
}
