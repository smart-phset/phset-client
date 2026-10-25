"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";

export function PrototypeNotice() {
  const path = usePathname();
  const t = useT();
  if (["/", "/climate", "/history", "/setup", "/scan"].includes(path)) return null;
  return <aside className="mx-4 md:mx-6 mt-4 p-3 rounded-lg bg-secondary-fixed text-on-secondary-fixed">
    {t("Prototype preview: sample data and simulated controls.")} {" "}
    <Link href="/" className="underline font-semibold">{t("Open real monitoring and equipment controls")}</Link>
  </aside>;
}
