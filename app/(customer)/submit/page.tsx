import {
  getPlatformSettings,
  resolveBrandName,
  resolveLogoUrl,
} from "@/lib/settings";
import { SubmitForm } from "./_components/submit-form";

export default async function SubmitPage() {
  const settings = await getPlatformSettings();
  return (
    <SubmitForm
      brandName={resolveBrandName(settings.brandName)}
      logoUrl={resolveLogoUrl(settings.logoKey)}
    />
  );
}
