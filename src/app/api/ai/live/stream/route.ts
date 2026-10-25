import { liveApi } from "@/lib/live-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return liveApi()(request, true); }
