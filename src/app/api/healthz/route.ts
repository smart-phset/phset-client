// Public liveness only; deliberately makes no upstream requests or config disclosures.
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
}
