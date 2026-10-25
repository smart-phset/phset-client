import { GrowRoomDashboard } from "@/components/monitoring/GrowRoomDashboard";
import { currentUser } from "@/lib/session";

export default async function Overview() {
  const user = await currentUser();
  return <GrowRoomDashboard deviceId={process.env.SMARTPHSET_DEVICE_ID || "grow-room-1"}
    teamAccount={!!user && !user.guest} />;
}
