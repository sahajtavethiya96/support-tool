import { ResetPasswordForm } from "@/app/(auth)/_components/reset-password-form";
import {
  getPlatformSettings,
  resolveBrandName,
  resolveLogoUrl,
} from "@/lib/settings";

export const metadata = {
  title: "Set password",
};

// Brand name/logo are admin-configurable at runtime — read per request.
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const settings = await getPlatformSettings();
  return (
    <ResetPasswordForm
      brandName={resolveBrandName(settings.brandName)}
      logoUrl={resolveLogoUrl(settings.logoKey)}
    />
  );
}
