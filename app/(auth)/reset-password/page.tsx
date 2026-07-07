import { ResetPasswordForm } from "@/app/(auth)/_components/reset-password-form";
import { PRODUCT_NAME } from "@/config/platform";

export const metadata = {
  title: `Set password · ${PRODUCT_NAME}`,
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
