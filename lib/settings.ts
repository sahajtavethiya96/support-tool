import { eq } from "drizzle-orm";
import { PRODUCT_NAME } from "@/config/platform";
import { platformSettings } from "@/db/schema/settings";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";

export async function getPlatformSettings() {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, "default"))
    .limit(1);
  return (
    row ?? {
      theme: "default",
      appearanceMode: "auto" as const,
      // Fresh install: only password is on until an admin explicitly enables
      // magic link/Google from /admin/appearance — matches pnpm create:admin
      // being the zero-dependency bootstrap path (no SMTP/OAuth required).
      passwordLoginEnabled: true,
      magicLinkEnabled: false,
      googleLoginEnabled: false,
      brandName: null as string | null,
      logoKey: null as string | null,
    }
  );
}

/** The configured brand name, or the PRODUCT_NAME default when unset. */
export function resolveBrandName(brandName: string | null | undefined): string {
  return brandName?.trim() ? brandName.trim() : PRODUCT_NAME;
}

/**
 * The configured logo's serving URL, or null when no logo is set (callers
 * fall back to a text wordmark). `absolute` prefixes the app's base URL —
 * required for email (mirrors how ticketUrl/portalUrl are built in
 * lib/tickets/create-ticket.ts) — omit it for in-app <img> tags, which only
 * need the relative /api/files/... path.
 */
export function resolveLogoUrl(
  logoKey: string | null | undefined,
  absolute = false
): string | null {
  if (!logoKey) {
    return null;
  }
  const path = storage.url(logoKey);
  return absolute ? `${env.NEXT_PUBLIC_APP_URL}${path}` : path;
}

/** Brand name + absolute logo URL for outgoing emails. */
export async function getEmailBranding(): Promise<{
  productName: string;
  logoUrl: string | null;
}> {
  const settings = await getPlatformSettings();
  return {
    productName: resolveBrandName(settings.brandName),
    logoUrl: resolveLogoUrl(settings.logoKey, true),
  };
}
