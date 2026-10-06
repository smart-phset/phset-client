import { BACKEND_MODE, BACKEND_URL, backendHeaders, demo, unreachable } from "@/lib/backend";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const device = new URL(req.url).searchParams.get("device") || "esp32-1";
  if (!BACKEND_URL || BACKEND_MODE === "bridge") return demo(); // bridge.py has no readings yet
  try {
    const r = await fetch(`${BACKEND_URL}/api/readings/latest?device=${encodeURIComponent(device)}`, { headers: backendHeaders(), cache: "no-store" });
    return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return unreachable(e);
  }
}
