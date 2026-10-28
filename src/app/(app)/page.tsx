import { GrowRoomDashboard } from "@/components/monitoring/GrowRoomDashboard";
import Link from "next/link";
import { currentUser } from "@/lib/session";

export default async function Overview() {
  const user = await currentUser();
  return <><div className="px-4 md:px-space-lg pt-4"><Link className="text-primary underline" href="/scan">Open Camera Manager · choose this device or shared grow-room camera</Link></div><GrowRoomDashboard deviceId={process.env.SMARTPHSET_DEVICE_ID || "grow-room-1"}
    teamAccount={!!user && !user.guest} /></>;
}
