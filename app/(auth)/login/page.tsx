import { redirect } from "next/navigation";
import { AuthForm } from "@/app/(auth)/_components/auth-form";
import { PRODUCT_NAME } from "@/config/platform";
import { getCurrentSession } from "@/lib/authz";
import { getPlatformSettings } from "@/lib/settings";
import { isSetupComplete } from "@/lib/setup";

export const metadata = {
  title: `Sign in · ${PRODUCT_NAME}`,
};

export default async function LoginPage() {
  // Fresh install with no admin yet — there's nothing to sign into. Send them
  // through the first-run wizard instead.
  if (!(await isSetupComplete())) {
    redirect("/setup");
  }

  const session = await getCurrentSession();
  if (session) {
    redirect("/post-auth");
  }

  const settings = await getPlatformSettings();

  const googleConfigured = !!(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );

  return (
    <AuthForm
      googleEnabled={googleConfigured && settings.googleLoginEnabled}
      magicLinkEnabled={settings.magicLinkEnabled}
      passwordLoginEnabled={settings.passwordLoginEnabled}
    />
  );
}
