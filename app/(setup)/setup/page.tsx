import { redirect } from "next/navigation";
import { SetupWizard } from "@/app/(setup)/_components/setup-wizard";
import { PRODUCT_NAME } from "@/config/platform";
import { isSetupComplete } from "@/lib/setup";

export const metadata = {
  title: `Set up · ${PRODUCT_NAME}`,
};

// The setup check queries the database, which must happen per request — a
// build-time prerender either fails (no database in the Docker builder) or
// bakes a stale answer into static HTML.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Once the first admin exists this wizard is done for good — send anyone who
  // lands here to the normal sign-in page.
  if (await isSetupComplete()) {
    redirect("/login");
  }

  return <SetupWizard />;
}
