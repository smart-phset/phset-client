import { BACKEND_MODE, BACKEND_URL, backendHeaders, demo, unreachable } from "@/lib/backend";

export async function POST(req: Request) {
  if (!BACKEND_URL) return demo();
  const params = new URL(req.url).searchParams;
  const camera = params.get("camera") || "phone-1";
  const room = params.get("room") || "";
  const body = await req.arrayBuffer();
  try {
    if (BACKEND_MODE === "bridge") {
      const r = await fetch(`${BACKEND_URL}/image?camera=${encodeURIComponent(camera)}`, {
        method: "POST", headers: backendHeaders({ "Content-Type": "image/jpeg" }), body,
      });
      const j = await r.json();
      if (!r.ok) return Response.json({ error: "ai_error", message: j.error || "The AI could not check this photo." }, { status: r.status });
      // bridge.py reply -> contract shape (level is computed in the browser from max_contaminated_conf)
      return Response.json({
        camera, room, verdict: j.verdict, max_contaminated_conf: j.max_contaminated_conf ?? 0,
        n_contaminated: j.n_contaminated ?? 0, n_healthy: j.n_healthy ?? 0, width: j.width, height: j.height,
        boxes: j.boxes ?? [], ms: j.ms, model_version: "yolov8n-2026-06-20",
      });
    }
    const r = await fetch(`${BACKEND_URL}/api/images?camera=${encodeURIComponent(camera)}&room=${encodeURIComponent(room)}`, {
      method: "POST", headers: backendHeaders({ "Content-Type": "image/jpeg" }), body,
    });
    return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return unreachable(e);
  }
}
