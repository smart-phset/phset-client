import "server-only";
import { currentUser } from "./session";
import { liveHandlers } from "./live-proxy";
import { requestedSharedCamera } from "./shared-camera.ts";
export function liveApi(request?: Request) {
  const selected = requestedSharedCamera(request);
  if (selected === null) return async () => {
    if (!await currentUser()) return Response.json({ message: "Sign in to view the live camera." }, { status: 401 });
    return Response.json({ message: "Unknown shared camera." }, { status: 400 });
  };
  const cameraId = selected ?? (process.env.SMARTPHSET_AI_CAMERA_ID || "");
  if (process.env.SMARTPHSET_AI_LIVE_ENABLED === "false" || !/^[A-Za-z0-9_-]{1,100}$/.test(cameraId)) return async () => {
    if (!await currentUser()) return Response.json({ message: "Sign in to view the live camera." }, { status: 401 });
    return Response.json({ status: "disabled", streaming: false, message: "The shared camera is disabled or not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  };
  return liveHandlers(process.env.SMARTPHSET_AI_LIVE_BASE_URL || "http://127.0.0.1:8001", currentUser, fetch, cameraId, process.env.SMARTPHSET_AI_RELAY_TOKEN || "");
}
