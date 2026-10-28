export type CameraSource = "disabled" | "local" | "shared" | "laptop-ai";
export const CAMERA_PREFERENCE_KEY = "smartphset.camera.source.v1";
export function cameraSource(value: string | null): CameraSource {
  return value === null ? "shared" : value === "local" || value === "shared" || value === "laptop-ai" ? value : "disabled";
}
export function cameraError(error: unknown): string {
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera permission denied. Allow camera access in your browser settings, then retry.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Camera not found. Reconnect it or select another camera.";
  if (name === "NotReadableError") return "Camera already in use or unavailable. If Python YOLO is using this laptop webcam, select Laptop Webcam — AI Stream. For browser preview, stop Python/OpenCV or close competing camera apps, then retry.";
  if (name === "AbortError") return "Camera start was interrupted. Close competing camera apps and retry.";
  return "Could not start the camera. Check browser and operating system camera settings.";
}
export function cameraConstraints(choice: string): MediaStreamConstraints {
  return { audio: false, video: choice === "user" || choice === "environment"
    ? { facingMode: { ideal: choice } } : choice ? { deviceId: { exact: choice } } : true };
}
/** Owns only this viewer's tracks. Invalidates permission requests on stop/unmount. */
export class BrowserCamera {
  private generation = 0;
  private stream: MediaStream | null = null;
  stop() {
    this.generation++;
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
  }
  async start(devices: MediaDevices, choice: string): Promise<MediaStream | null> {
    this.stop();
    const generation = this.generation;
    const stream = await devices.getUserMedia(cameraConstraints(choice));
    if (generation !== this.generation) {
      stream.getTracks().forEach(track => track.stop());
      return null;
    }
    this.stream = stream;
    return stream;
  }
}
