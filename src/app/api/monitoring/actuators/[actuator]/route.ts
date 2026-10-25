import { monitoringApi } from "@/lib/monitoring-server";
export async function POST(req: Request, context: { params: Promise<{ actuator: string }> }) {
  const { actuator } = await context.params;
  return monitoringApi().command(req, actuator);
}
