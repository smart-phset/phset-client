import { monitoringApi } from "@/lib/monitoring-server";
export const dynamic = "force-dynamic";
export async function GET() { return monitoringApi().detection(); }
