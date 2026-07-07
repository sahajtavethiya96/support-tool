import { eq } from "drizzle-orm";
import { platformSettings } from "@/db/schema/settings";
import { db } from "@/lib/db";

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
    }
  );
}
