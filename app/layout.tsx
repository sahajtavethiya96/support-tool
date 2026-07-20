import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { PRODUCT_DESCRIPTION } from "@/config/platform";
import { getPlatformSettings, resolveBrandName } from "@/lib/settings";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

// The brand name is admin-configurable at runtime (platform_settings), so the
// title template can't be a static build-time constant — it must be read per
// request, same reasoning as every other DB-driven page in this app (a
// Docker build has no database, and a baked answer would go stale anyway).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPlatformSettings();
  const name = resolveBrandName(settings.brandName);
  return {
    title: {
      default: name,
      template: `%s | ${name}`,
    },
    description: PRODUCT_DESCRIPTION,
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      className={cn("font-sans", inter.variable)}
      lang="en"
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
