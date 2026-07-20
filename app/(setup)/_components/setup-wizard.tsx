"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleNotchIcon,
  EyeIcon,
  EyeSlashIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  TicketIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ThemeProvider, useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME } from "@/config/platform";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const THEME_OPTIONS = [
  { id: "default", name: "Default", color: "#384959" },
  { id: "ocean", name: "Ocean", color: "#1A4A5E" },
  { id: "forest", name: "Forest", color: "#1E4D35" },
  { id: "sunset", name: "Sunset", color: "#5E2D1A" },
  { id: "indigo", name: "Indigo", color: "#2D1E5E" },
  { id: "slate", name: "Slate", color: "#263040" },
];

const APPEARANCE_OPTIONS = [
  { id: "light" as const, label: "Light", icon: SunIcon },
  { id: "dark" as const, label: "Dark", icon: MoonIcon },
  { id: "auto" as const, label: "System", icon: MonitorIcon },
];

const STEPS = ["Welcome", "Account", "Finish"];

export function SetupWizard() {
  // The wizard renders its own ThemeProvider so the appearance step is a live
  // preview — the whole card recolors as you pick a theme / light-dark mode.
  return (
    <ThemeProvider initialAppearanceMode="light" initialTheme="default">
      <WizardInner />
    </ThemeProvider>
  );
}

function WizardInner() {
  const router = useRouter();
  const { currentTheme, appearanceMode, setTheme, setAppearance } = useTheme();

  const [step, setStep] = React.useState(0);
  const [brandName, setBrandName] = React.useState("");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function handleAccountSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    void submitSetup();
  }

  async function submitSetup() {
    setSubmitting(true);
    setStep(2);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          theme: currentTheme,
          appearanceMode,
          brandName: brandName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        setStep(1);
        return;
      }

      // Persist the chosen theme locally so the dashboard renders it instantly,
      // before the server settings round-trip.
      try {
        localStorage.setItem("support_tool_theme", currentTheme);
        localStorage.setItem("support_tool_appearance", appearanceMode);
      } catch {
        // localStorage may be unavailable (private mode) — non-fatal.
      }

      // Auto sign-in with the credentials just created, then land on the
      // dashboard — no separate login step needed.
      const signIn = await authClient.signIn.email({
        email: email.trim(),
        password,
        callbackURL: "/post-auth",
      });
      if (signIn.error) {
        router.push("/login");
        return;
      }
      router.push("/post-auth");
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      setStep(1);
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      {/* Stepper dots */}
      <div className="flex items-center gap-2.5 mb-8">
        {STEPS.map((label, i) => (
          <div className="flex items-center gap-2.5" key={label}>
            <span
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "flex items-center justify-center size-6 rounded-full text-2xs font-semibold transition-colors",
                i < step && "bg-primary text-primary-foreground",
                i === step &&
                  "bg-primary/10 text-primary ring-2 ring-primary/40",
                i > step && "bg-muted text-muted-foreground"
              )}
            >
              {i < step ? (
                <CheckIcon className="size-3.5" weight="bold" />
              ) : (
                i + 1
              )}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "h-px w-6 sm:w-10",
                  i < step ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-sm p-6 sm:p-8">
        {step === 0 && (
          <WelcomeStep
            appearanceMode={appearanceMode}
            brandName={brandName}
            currentTheme={currentTheme}
            onNext={() => setStep(1)}
            setAppearance={setAppearance}
            setBrandName={setBrandName}
            setTheme={setTheme}
          />
        )}

        {step === 1 && (
          <form className="space-y-5" onSubmit={handleAccountSubmit}>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground">
                Let&apos;s set up your account
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                This is the administrator account for {PRODUCT_NAME}.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                autoComplete="name"
                autoFocus
                id="name"
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                value={name}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">
                Email Address{" "}
                <span className="text-muted-foreground font-normal">
                  (will be your login ID)
                </span>{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                autoComplete="username"
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">
                Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  autoComplete="new-password"
                  className="pr-10"
                  id="password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                  type="button"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">
                Confirm Password <span className="text-destructive">*</span>
              </Label>
              <Input
                autoComplete="new-password"
                id="confirm"
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter your password"
                type={showPassword ? "text" : "password"}
                value={confirm}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                className="gap-1.5"
                onClick={() => {
                  setError(null);
                  setStep(0);
                }}
                type="button"
                variant="ghost"
              >
                <ArrowLeftIcon className="size-4" />
                Previous
              </Button>
              <Button className="gap-1.5" disabled={submitting} type="submit">
                Create account
                <ArrowRightIcon className="size-4" />
              </Button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center text-center py-6">
            {error ? (
              <>
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  {error}
                </p>
                <Button
                  className="mt-4"
                  onClick={() => {
                    setError(null);
                    setStep(1);
                  }}
                  variant="outline"
                >
                  Go back
                </Button>
              </>
            ) : (
              <>
                <CircleNotchIcon className="size-8 text-primary animate-spin" />
                <h1 className="text-lg font-semibold text-foreground mt-4">
                  Setting up your workspace…
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Creating your admin account and signing you in.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-6 flex items-center gap-1.5">
        <CheckCircleIcon className="size-3.5" weight="fill" />
        Runs once — this page disappears after your first admin is created.
      </p>
    </main>
  );
}

function WelcomeStep({
  currentTheme,
  appearanceMode,
  brandName,
  setTheme,
  setAppearance,
  setBrandName,
  onNext,
}: {
  currentTheme: string;
  appearanceMode: "light" | "dark" | "auto";
  brandName: string;
  setTheme: (t: string) => void;
  setAppearance: (m: "light" | "dark" | "auto") => void;
  setBrandName: (n: string) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary text-primary-foreground mb-3">
          <TicketIcon className="size-6" weight="fill" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          Welcome to {PRODUCT_NAME}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Let&apos;s get your instance set up. Pick a look — you can change it
          later in Appearance settings.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="setup-brand-name">
          Brand name{" "}
          <span className="text-muted-foreground font-normal">
            (optional)
          </span>
        </Label>
        <Input
          id="setup-brand-name"
          onChange={(e) => setBrandName(e.target.value)}
          placeholder={PRODUCT_NAME}
          value={brandName}
        />
        <p className="text-xs text-muted-foreground">
          Shown instead of "{PRODUCT_NAME}" in emails and across the app. You
          can add a logo afterward from Appearance settings.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-medium text-foreground mb-2.5">
          Color theme
        </h2>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
          {THEME_OPTIONS.map((theme) => {
            const selected = currentTheme === theme.id;
            return (
              <button
                className={cn(
                  "flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-center transition-all cursor-pointer",
                  selected
                    ? "border-primary ring-2 ring-ring/20 bg-primary/5"
                    : "border-border bg-card hover:bg-accent/60"
                )}
                key={theme.id}
                onClick={() => setTheme(theme.id)}
                title={theme.name}
                type="button"
              >
                <span
                  className="size-7 rounded-full flex items-center justify-center border border-black/5 shadow-sm"
                  style={{ backgroundColor: theme.color }}
                >
                  {selected && (
                    <CheckIcon
                      className="size-3.5 text-white drop-shadow"
                      weight="bold"
                    />
                  )}
                </span>
                <span className="text-2xs font-medium text-foreground">
                  {theme.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-foreground mb-2.5">
          Appearance
        </h2>
        <div className="grid grid-cols-3 gap-2.5">
          {APPEARANCE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = appearanceMode === opt.id;
            return (
              <button
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all cursor-pointer",
                  selected
                    ? "border-primary ring-2 ring-ring/20 bg-primary/5"
                    : "border-border bg-card hover:bg-accent/60"
                )}
                key={opt.id}
                onClick={() => setAppearance(opt.id)}
                type="button"
              >
                <Icon className="size-4 text-foreground" />
                <span className="text-2xs font-medium text-foreground">
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button className="gap-1.5" onClick={onNext} type="button">
          Next
          <ArrowRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
