"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRODUCT_NAME } from "@/config/platform";
import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordFormInner />
    </Suspense>
  );
}

function ResetPasswordFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const result = await authClient.resetPassword({
      newPassword: password,
      token: token ?? undefined,
    });
    setSubmitting(false);
    if (result.error) {
      setError(
        result.error.message ??
          "This link has expired or has already been used."
      );
      return;
    }
    router.push("/login?passwordReset=1");
  }

  const invalidLink = !token || !!linkError;

  return (
    <main className="min-h-screen bg-public flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-bark text-cream font-bold text-lg mb-4">
            ST
          </div>
          <h1 className="text-2xl font-semibold text-bark">{PRODUCT_NAME}</h1>
          <p className="text-sm text-stone mt-1">Agent &amp; Admin Portal</p>
        </div>

        <div className="bg-white rounded-xl border border-sand shadow-soft shadow-sm p-8">
          {invalidLink ? (
            <div className="text-center space-y-4">
              <h2 className="text-lg font-semibold text-bark">Link expired</h2>
              <p className="text-sm text-stone">
                This link has expired or has already been used. Request a new
                one.
              </p>
              <Link
                className="inline-block text-sm text-bark underline underline-offset-4 hover:text-bark/80 transition-colors"
                href="/forgot-password"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-bark">
                  Set your password
                </h2>
                <p className="text-sm text-stone mt-1">
                  Choose a password to sign in with going forward.
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label
                    className="block text-sm font-medium text-bark mb-1.5"
                    htmlFor="password"
                  >
                    New password
                  </label>
                  <Input
                    autoComplete="new-password"
                    className="text-foreground"
                    id="password"
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    type="password"
                    value={password}
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-medium text-bark mb-1.5"
                    htmlFor="confirm-password"
                  >
                    Confirm password
                  </label>
                  <Input
                    autoComplete="new-password"
                    className="text-foreground"
                    id="confirm-password"
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    type="password"
                    value={confirmPassword}
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}

                <Button
                  className="w-full bg-bark hover:bg-bark/90 text-white"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                      Saving…
                    </span>
                  ) : (
                    "Set Password"
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
