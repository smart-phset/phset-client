// Configuration and authentication are injected by the server-only adapter.
export function liveHandlers(baseUrl: string, session: () => Promise<unknown>, transport: typeof fetch = fetch) {
  const offline = () => Response.json({ status: "offline", message: "Live AI service is offline." },
    { status: 503, headers: { "Cache-Control": "no-store" } });
  return async (request: Request, stream: boolean) => {
    if (!await session()) return Response.json({ message: "Sign in to view the live camera." }, { status: 401 });
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
    const timeout = setTimeout(abort, 5000);
    let streaming = false;
    try {
      const base = new URL(baseUrl);
      if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) return offline();
      const upstream = await transport(base.href.replace(/\/$/, "") + (stream ? "/stream.mjpg" : "/health"),
        { cache: "no-store", redirect: "error", signal: controller.signal });
      if (!upstream.ok) { await upstream.body?.cancel(); return offline(); }
      if (!stream) {
        const health = await upstream.json();
        return Response.json({ status: ["ok", "starting", "camera_unavailable", "inference_unavailable", "stalled"].includes(health.status) ? health.status : "offline",
          camera: "webcam-0", streaming: health.streaming === true }, { headers: { "Cache-Control": "no-store" } });
      }
      const contentType = upstream.headers.get("content-type") || "";
      if (!/^multipart\/x-mixed-replace;\s*boundary=frame$/i.test(contentType) || !upstream.body) {
        await upstream.body?.cancel(); return offline();
      }
      // Pull one chunk at a time; cancel the upstream on navigation/disconnect.
      const reader = upstream.body.getReader();
      const cleanup = () => request.signal.removeEventListener("abort", abort);
      const body = new ReadableStream<Uint8Array>({
        async pull(destination) {
          try {
            const { done, value } = await reader.read();
            if (done) { cleanup(); reader.releaseLock(); destination.close(); }
            else destination.enqueue(value);
          } catch {
            cleanup(); destination.error(new Error("Live stream disconnected."));
          }
        },
        async cancel() {
          abort(); cleanup();
          try { await reader.cancel(); } finally { reader.releaseLock(); }
        },
      }, { highWaterMark: 0 });
      streaming = true;
      return new Response(body, { headers: { "Content-Type": contentType,
        "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
    } catch { return offline(); }
    finally {
      clearTimeout(timeout);
      if (!streaming) request.signal.removeEventListener("abort", abort);
    }
  };
}
