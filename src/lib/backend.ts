// Server-only: forwards website calls to the laptop through the tunnel (docs/api-contract.md).
//   BACKEND_URL   tunnel address of the laptop. Empty = demo mode.
//   BACKEND_MODE  "api" (the engineer's Node REST API, default) or "bridge" (bridge.py directly).
//   API_KEY       sent as "Authorization: Bearer <key>".

export const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "");
export const BACKEND_MODE = process.env.BACKEND_MODE === "bridge" ? "bridge" : "api";

export function backendHeaders(extra: Record<string, string> = {}) {
  return { ...(process.env.API_KEY ? { Authorization: `Bearer ${process.env.API_KEY}` } : {}), ...extra };
}

export function demo() {
  return Response.json({ demo: true });
}

export function unreachable(_e: unknown) {
  // Never forward transport exception details or internal URLs to a browser.
  void _e;
  return Response.json({ error: "backend_unreachable", message: "Can't reach the grow box server. Check the laptop and the tunnel." }, { status: 503 });
}
