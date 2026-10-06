import type { Metadata, Viewport } from "next";
import "./fonts.css";
import "./globals.css";
import { LangProvider } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "SmartPhset",
  description: "AI contamination control for oyster-mushroom growers in Cambodia.",
  icons: { icon: "/brand/favicon.ico", apple: "/brand/apple-touch-icon.png" },
  openGraph: { title: "SmartPhset", description: "See mould early. Keep the harvest.", images: ["/brand/og-image.png"] },
};

export const viewport: Viewport = { themeColor: "#ffffff", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang}>
      <body className="bg-surface font-body-md text-on-surface antialiased">
        <LangProvider initial={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
