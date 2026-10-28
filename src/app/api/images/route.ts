import { sameOrigin } from "@/lib/auth";
import { BACKEND_MODE, BACKEND_URL, backendHeaders, demo, unreachable } from "@/lib/backend";

export async function POST(req: Request) {
  if (process.env.SMARTPHSET_AI_UPLOAD_ENABLED === "false") return Response.json({ error: "analysis_disabled", message: "Photo analysis is disabled until a secure AI service is configured." }, { status: 503 });
  if (!sameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!BACKEND_URL) return process.env.NODE_ENV === "production"
    ? Response.json({ error: "analysis_unconfigured", message: "Photo analysis is not configured." }, { status: 503 }) : demo();
  const params = new URL(req.url).searchParams;
  const camera = params.get("camera") || "phone-1";
  const room = params.get("room") || "";
  if (req.headers.get("content-type")?.split(";")[0].trim() !== "image/jpeg")
    return Response.json({ error: "invalid_image", message: "Send a JPEG image." }, { status: 415 });
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2 * 1024 * 1024) {
          await reader.cancel();
          return Response.json({ error: "image_too_large", message: "Photo must be under 2 MB." }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  if (!size) return Response.json({ error: "invalid_image", message: "Send a JPEG image." }, { status: 400 });
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(30000)]);
  try {
    if (BACKEND_MODE === "bridge") {
      const r = await fetch(`${BACKEND_URL}/image?camera=${encodeURIComponent(camera)}`, {
        method: "POST", signal, redirect: "error", cache: "no-store", headers: backendHeaders({ "Content-Type": "image/jpeg" }), body,
      });
      const j = await r.json();
      if (!r.ok) return Response.json({ error: "ai_error", message: "The AI could not check this photo." }, { status: r.status });
      // bridge.py reply -> contract shape (level is computed in the browser from max_contaminated_conf)
      return Response.json({
        camera, room, verdict: j.verdict, max_contaminated_conf: j.max_contaminated_conf ?? 0,
        n_contaminated: j.n_contaminated ?? 0, n_healthy: j.n_healthy ?? 0, width: j.width, height: j.height,
        boxes: j.boxes ?? [], ms: j.ms, model_version: "yolov8n-2026-06-20",
      });
    }
    const r = await fetch(`${BACKEND_URL}/api/images?camera=${encodeURIComponent(camera)}&room=${encodeURIComponent(room)}`, {
      method: "POST", signal, redirect: "error", cache: "no-store", headers: backendHeaders({ "Content-Type": "image/jpeg" }), body,
    });
    return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return unreachable(e);
  }
}
