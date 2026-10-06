import { BACKEND_MODE, BACKEND_URL, backendHeaders } from "@/lib/backend";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!BACKEND_URL) return Response.json({ demo: true, backend: "not connected" });
  const path = BACKEND_MODE === "bridge" ? "/status" : "/api/health";
  try {
    const r = await fetch(`${BACKEND_URL}${path}`, { headers: backendHeaders(), cache: "no-store" });
    return Response.json({ demo: false, backend: r.ok ? "online" : `error ${r.status}`, mode: BACKEND_MODE });
  } catch {
    return Response.json({ demo: false, backend: "unreachable", mode: BACKEND_MODE });
  }
}
