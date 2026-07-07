import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/app/(auth)/_components/forgot-password-form";
import { PRODUCT_NAME } from "@/config/platform";
import { getCurrentSession } from "@/lib/authz";
import { getPlatformSettings } from "@/lib/settings";

export const metadata = {
  title: `Forgot password · ${PRODUCT_NAME}`,
};

export default async function ForgotPasswordPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/post-auth");
  }

  const settings = await getPlatformSettings();
  if (!settings.passwordLoginEnabled) {
    redirect("/login");
  }

  return <ForgotPasswordForm />;
}
