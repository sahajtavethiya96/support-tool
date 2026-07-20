import {
  getPlatformSettings,
  resolveBrandName,
  resolveLogoUrl,
} from "@/lib/settings";
import { MyTicketsForm } from "./_components/my-tickets-form";

export default async function MyTicketsPage() {
  const settings = await getPlatformSettings();
  return (
    <MyTicketsForm
      brandName={resolveBrandName(settings.brandName)}
      logoUrl={resolveLogoUrl(settings.logoKey)}
    />
  );
}
