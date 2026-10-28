import { CameraLogoutBridge } from "@/components/CameraLogoutBridge";
import { redirect } from "next/navigation";
import { AIStoreProvider } from "@/store/StoreProvider";
import { MobileNav, Sidebar, Topbar } from "@/components/Shell";
import { currentUser } from "@/lib/session";
import { StoreProvider } from "@/lib/store";
import { PrototypeNotice } from "@/components/monitoring/PrototypeNotice";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/signin");
  return (
    <AIStoreProvider>
      <StoreProvider>
        <CameraLogoutBridge />
        <Sidebar user={user} />
        <div className="lg:pl-60">
          <Topbar user={user} />
          <main className="w-full pt-16 pb-24 lg:pb-0 bg-surface min-h-screen"><PrototypeNotice />{children}</main>
        </div>
        <MobileNav />
      </StoreProvider>
    </AIStoreProvider>
  );
}
