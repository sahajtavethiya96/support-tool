import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/app/(auth)/_components/forgot-password-form";
import { getCurrentSession } from "@/lib/authz";
import {
  getPlatformSettings,
  resolveBrandName,
  resolveLogoUrl,
} from "@/lib/settings";

export const metadata = {
  title: "Forgot password",
};

// Reads admin-toggleable settings from the database — per request only, never
// at build time (currently protected only by getCurrentSession() happening to
// run first; this makes it explicit and refactor-proof).
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/post-auth");
  }

  const settings = await getPlatformSettings();
  if (!settings.passwordLoginEnabled) {
    redirect("/login");
  }

  return (
    <ForgotPasswordForm
      brandName={resolveBrandName(settings.brandName)}
      logoUrl={resolveLogoUrl(settings.logoKey)}
    />
  );
}
