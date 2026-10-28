export type SharedCameraId = "esp32-cam" | "webcam-0";

/** Only known physical identities may be selected; URLs are always server config. */
export function requestedSharedCamera(request?: Request): SharedCameraId | undefined | null {
  const values = request ? new URL(request.url).searchParams.getAll("camera") : [];
  if (!values.length) return undefined; // Keep global monitoring/default callers compatible.
  return values.length === 1 && (values[0] === "esp32-cam" || values[0] === "webcam-0") ? values[0] : null;
}
