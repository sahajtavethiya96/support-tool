import { env } from "@/lib/env";
import { getPlatformSettings, resolveLogoUrl } from "@/lib/settings";
import { AppearanceSettingsForm } from "./_components/appearance-settings-form";
import { BrandingSettingsForm } from "./_components/branding-settings-form";
import { LoginMethodsSettingsForm } from "./_components/login-methods-settings-form";

export const metadata = { title: "Appearance" };

export default async function AppearancePage() {
  const settings = await getPlatformSettings();
  const googleConfigured = !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="bg-card rounded-xl border border-border shadow-soft p-6">
        <BrandingSettingsForm
          initialBrandName={settings.brandName}
          initialLogoUrl={resolveLogoUrl(settings.logoKey)}
        />
      </div>
      <div className="bg-card rounded-xl border border-border shadow-soft p-6">
        <AppearanceSettingsForm />
      </div>
      <div className="bg-card rounded-xl border border-border shadow-soft p-6">
        <LoginMethodsSettingsForm
          googleConfigured={googleConfigured}
          initialSettings={{
            passwordLoginEnabled: settings.passwordLoginEnabled,
            magicLinkEnabled: settings.magicLinkEnabled,
            googleLoginEnabled: settings.googleLoginEnabled,
          }}
        />
      </div>
    </div>
  );
}
