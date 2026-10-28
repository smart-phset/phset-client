import { COOKIE, sameOrigin, verify } from "@/lib/auth";

import { createHash } from "node:crypto";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const token = req.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (process.env.SMARTPHSET_AI_SERVICE_KEY && await verify(token)) {
    try {
      await fetch(`${process.env.SMARTPHSET_AI_SERVICE_URL || "http://127.0.0.1:8002"}/sessions`, {
        method: "DELETE", signal: AbortSignal.timeout(2000), redirect: "error",
        headers: { Authorization: `Bearer ${process.env.SMARTPHSET_AI_SERVICE_KEY}`, "X-Camera-Owner": createHash("sha256").update(token!).digest("hex") },
      });
    } catch { /* Unreachable workers expire sessions within 60 seconds. */ }
  }
  return new Response(null, {
    status: 303,
    headers: { Location: "/signin", "Cache-Control": "no-store", "Set-Cookie": `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` },
  });
}
