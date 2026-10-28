import "server-only";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { COOKIE, verify, sameOrigin } from "./auth";

const idPattern = /^[A-Za-z0-9_-]{1,100}$/;
const headers = { "Cache-Control": "no-store" };
export async function cameraService(request: Request, path: string[]) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!await verify(token)) return Response.json({ error: "unauthorized" }, { status: 401, headers });
  if (request.method !== "GET" && !sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403, headers });
  const base = process.env.SMARTPHSET_AI_SERVICE_URL || "http://127.0.0.1:8002";
  const key = process.env.SMARTPHSET_AI_SERVICE_KEY;
  const registryBase = (process.env.SMARTPHSET_API_BASE_URL || process.env.BACKEND_URL || "http://127.0.0.1:9090").replace(/\/$/, "");
  if (!key) return Response.json({ error: "camera_service_not_configured" }, { status: 503, headers });
  const owner = createHash("sha256").update(token!).digest("hex");
  try {
    if (!path.length && request.method === "GET") {
      const registry = await fetch(`${registryBase}/api/cameras`, { headers: { "X-SmartPhset-Camera-Key": process.env.SMARTPHSET_CAMERA_API_KEY || "" }, signal: AbortSignal.timeout(5000), cache: "no-store", redirect: "error" });
      if (!registry.ok) throw new Error();
      const list = await registry.json();
      if (!Array.isArray(list)) throw new Error();
      const states: Record<string, { status?: string }> = await fetch(`${base}/sources`, { headers: { Authorization: `Bearer ${key}`, "X-Camera-Owner": owner }, signal: AbortSignal.timeout(5000), cache: "no-store", redirect: "error" }).then(r => r.ok ? r.json() : {}).catch(() => ({}));
      return Response.json(list.map(c => ({ id: c.id, label: c.label, availability: states[c.id]?.status || "unknown" })), { headers });
    }
    if (path[0] !== "sessions" || path.length > 3 || path.slice(1).some(p => !idPattern.test(p)) ||
      path.length === 3 && !["start", "stop", "frames", "stream"].includes(path[2])) return Response.json({ error: "not_found" }, { status: 404, headers });
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 524288) return Response.json({ error: "frame_too_large" }, { status: 413, headers });
    // Bound chunked bodies too, before buffering or contacting the worker.
    let body: Uint8Array | undefined;
    if (request.method === "POST") {
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 524288) { await reader.cancel(); return Response.json({ error: "frame_too_large" }, { status: 413, headers }); }
          chunks.push(value);
        }
      }
      body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
      if (path.length === 1) {
        const data = JSON.parse(new TextDecoder().decode(body));
        if (data.source_id !== "browser") {
          // A shared identity must exist in Spring's registry as well as the worker allowlist.
          if (!idPattern.test(data.source_id)) throw new Error();
          const registered = await fetch(`${registryBase}/api/cameras/${data.source_id}/availability`, { headers: { "X-SmartPhset-Camera-Key": process.env.SMARTPHSET_CAMERA_API_KEY || "" }, signal: AbortSignal.timeout(5000), redirect: "error" });
          if (!registered.ok) return Response.json({ error: "unknown_source" }, { status: 404, headers });
        }
      }
    }
    const stream = path[2] === "stream";
    const upstream = await fetch(`${base}/${path.join("/")}`, {
      method: request.method, body: body as BodyInit | undefined,
      headers: { Authorization: `Bearer ${key}`, "X-Camera-Owner": owner, "X-Camera-Revision": request.headers.get("x-camera-revision") || "", "Content-Type": path[2] === "frames" ? request.headers.get("content-type") || "" : "application/json" },
      signal: stream ? request.signal : AbortSignal.any([request.signal, AbortSignal.timeout(20000)]), cache: "no-store", redirect: "error",
    });
    if (stream && upstream.ok) return new Response(upstream.body, { headers: { ...headers, "Content-Type": "multipart/x-mixed-replace; boundary=frame", "X-Accel-Buffering": "no" } });
    // Only structured worker responses, never transport exceptions or private addresses.
    return Response.json(await upstream.json(), { status: upstream.status, headers });
  } catch { return Response.json({ error: "camera_service_unavailable" }, { status: 503, headers }); }
}
