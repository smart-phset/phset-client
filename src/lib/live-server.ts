import "server-only";
import { currentUser } from "./session";
import { liveHandlers } from "./live-proxy";
export function liveApi() {
  return liveHandlers(process.env.SMARTPHSET_AI_LIVE_BASE_URL || "http://127.0.0.1:8001", currentUser, fetch, process.env.SMARTPHSET_AI_CAMERA_ID || "");
}
