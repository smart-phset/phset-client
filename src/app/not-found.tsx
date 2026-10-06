import Link from "next/link";
import { getT } from "@/lib/i18n-server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-surface">
      <img alt="SmartPhset" className="h-14 w-14 object-contain" src="/brand/logo-mark.svg" />
      <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("Page not found")}</h1>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">{t("This page does not exist. Go back to the overview to see your grow rooms.")}</p>
      <Link href="/" className="px-5 py-2.5 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-semibold">{t("Go to overview")}</Link>
    </div>
  );
}
