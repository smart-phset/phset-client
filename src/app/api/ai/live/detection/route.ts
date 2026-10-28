import { monitoringApi } from "@/lib/monitoring-server";
import { currentUser } from "@/lib/session";
import { requestedSharedCamera } from "@/lib/shared-camera";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!await currentUser()) return Response.json({ message: "Sign in to view camera metadata." }, { status: 401 });
  const camera = requestedSharedCamera(request);
  if (camera === null) return Response.json({ message: "Unknown shared camera." }, { status: 400 });
  return monitoringApi(camera).detection();
}
