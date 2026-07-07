import { LockIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ThemeResetScript } from "@/components/theme/theme-reset-script";
import { PRODUCT_NAME } from "@/config/platform";

export const metadata = { title: "Access Pending" };

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen bg-public flex items-center justify-center px-4">
      <ThemeResetScript />
      <div className="bg-white rounded-xl border border-sand shadow-soft shadow-sm p-10 max-w-sm w-full text-center">
        <div className="inline-flex items-center justify-center size-12 rounded-full bg-sand/30 mb-4">
          <LockIcon className="size-6 text-bark" />
        </div>
        <h1 className="text-lg font-semibold text-bark">Access Pending</h1>
        <p className="text-sm text-stone mt-2 leading-relaxed">
          Your account is awaiting role assignment. Ask an admin to grant you
          Agent or Admin access in {PRODUCT_NAME}.
        </p>
        <Link
          className="mt-6 inline-block text-sm text-stone underline underline-offset-4 hover:text-bark transition-colors"
          href="/login"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
