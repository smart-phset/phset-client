/** One frame request at a time. Cancellation invalidates late results and timers. */
export class FramePump {
  private controller: AbortController | null = null;
  start(capture: () => Promise<Blob | null>, send: (frame: Blob, signal: AbortSignal) => Promise<void>, fps = 2, failed: (error: unknown) => void = () => {}) {
    this.stop();
    const controller = new AbortController();
    this.controller = controller;
    const loop = async () => {
      try {
        const frame = await capture();
        if (controller.signal.aborted) return;
        if (frame && frame.size <= 524288) await send(frame, controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) { this.stop(); failed(error); }
      }
      if (!controller.signal.aborted) setTimeout(() => void loop(), 1000 / Math.max(.5, Math.min(5, fps)));
    };
    void loop();
  }
  stop() { this.controller?.abort(); this.controller = null; }
}
export type CameraResult = {
  session_id: string; source_id: string; analyzing: boolean; status: string;
  detection: null | { severity: string; message: string; max_conf: number; ms: number; shape: [number, number]; boxes: { label: string; conf: number; xyxy: number[] }[] };
};
