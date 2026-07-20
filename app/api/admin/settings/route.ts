import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { platformSettings } from "@/db/schema/settings";
import { requireAdminFromRequest } from "@/lib/authz";
import { db } from "@/lib/db";

const VALID_THEMES = new Set([
  "default",
  "ocean",
  "forest",
  "sunset",
  "indigo",
  "slate",
]);
const VALID_APPEARANCES = new Set(["light", "dark", "auto"]);

interface SettingsBody {
  appearanceMode?: string;
  brandName?: string | null;
  googleLoginEnabled?: boolean;
  magicLinkEnabled?: boolean;
  passwordLoginEnabled?: boolean;
  theme?: string;
}

// GET — agent/admin can read (middleware already enforced access)
export async function GET(_request: NextRequest) {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, "default"))
    .limit(1);

  return NextResponse.json({
    theme: row?.theme ?? "default",
    appearanceMode: row?.appearanceMode ?? "auto",
    passwordLoginEnabled: row?.passwordLoginEnabled ?? true,
    magicLinkEnabled: row?.magicLinkEnabled ?? false,
    googleLoginEnabled: row?.googleLoginEnabled ?? false,
    brandName: row?.brandName ?? null,
    logoKey: row?.logoKey ?? null,
  });
}

// PATCH — admin only. Partial update: only fields present in the body are
// changed, everything else keeps its current stored value.
export async function PATCH(request: NextRequest) {
  try {
    requireAdminFromRequest(request);
  } catch (e) {
    return e as Response;
  }

  let body: SettingsBody;
  try {
    body = (await request.json()) as SettingsBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, "default"))
    .limit(1);

  const theme = body.theme ?? existing?.theme ?? "default";
  const appearanceMode =
    body.appearanceMode ?? existing?.appearanceMode ?? "auto";
  const passwordLoginEnabled =
    body.passwordLoginEnabled ?? existing?.passwordLoginEnabled ?? true;
  const magicLinkEnabled =
    body.magicLinkEnabled ?? existing?.magicLinkEnabled ?? false;
  const googleLoginEnabled =
    body.googleLoginEnabled ?? existing?.googleLoginEnabled ?? false;
  const brandName =
    body.brandName === undefined
      ? (existing?.brandName ?? null)
      : (body.brandName?.trim() ?? "") || null;

  if (body.theme !== undefined && !VALID_THEMES.has(theme)) {
    return NextResponse.json({ error: "Invalid theme." }, { status: 400 });
  }
  if (
    body.appearanceMode !== undefined &&
    !VALID_APPEARANCES.has(appearanceMode)
  ) {
    return NextResponse.json(
      { error: "Invalid appearance mode." },
      { status: 400 }
    );
  }
  if (!(passwordLoginEnabled || magicLinkEnabled || googleLoginEnabled)) {
    return NextResponse.json(
      { error: "At least one sign-in method must stay enabled." },
      { status: 400 }
    );
  }
  if (brandName !== null && brandName.length > 60) {
    return NextResponse.json(
      { error: "Brand name must be 60 characters or fewer." },
      { status: 400 }
    );
  }

  const now = new Date();

  await db
    .insert(platformSettings)
    .values({
      id: "default",
      theme,
      appearanceMode,
      passwordLoginEnabled,
      magicLinkEnabled,
      googleLoginEnabled,
      brandName,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: platformSettings.id,
      set: {
        theme,
        appearanceMode,
        passwordLoginEnabled,
        magicLinkEnabled,
        googleLoginEnabled,
        brandName,
        updatedAt: now,
      },
    });

  return NextResponse.json({
    theme,
    appearanceMode,
    passwordLoginEnabled,
    magicLinkEnabled,
    googleLoginEnabled,
    brandName,
  });
}
