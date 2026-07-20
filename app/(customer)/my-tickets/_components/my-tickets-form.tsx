"use client";

import {
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  TicketIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "@/components/common/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  brandName: string;
  logoUrl: string | null;
}

export function MyTicketsForm({ brandName, logoUrl }: Props) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await fetch("/api/tickets/mine/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Always show the same message to prevent email enumeration
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-public">
      <header className="bg-white/80 backdrop-blur-sm border-b border-sand sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link className="flex items-center gap-2 sm:gap-2.5 min-w-0" href="/">
            <BrandMark
              fallbackIcon={
                <div className="size-7 rounded-md bg-bark flex items-center justify-center shrink-0">
                  <TicketIcon className="size-4 text-cream" weight="fill" />
                </div>
              }
              imgClassName="h-7 w-auto max-w-40 object-contain"
              logoUrl={logoUrl}
              name={brandName}
              textClassName="font-semibold text-bark text-sm truncate"
            />
          </Link>
          <Link
            className="text-sm text-stone hover:text-bark transition-colors shrink-0"
            href="/submit"
          >
            Submit a Ticket
          </Link>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-12 sm:py-20">
        {done ? (
          <div className="text-center">
            <CheckCircleIcon className="size-12 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-bark mb-2">
              Check your inbox
            </h1>
            <p className="text-sm text-stone leading-relaxed">
              If any tickets exist for{" "}
              <span className="font-medium text-bark">{email}</span>, we've sent
              you a list with links to each one.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Button
                className="border-sand text-bark hover:bg-cream w-full"
                onClick={() => {
                  setDone(false);
                  setEmail("");
                }}
                variant="outline"
              >
                Try another email
              </Button>
              <Button
                asChild
                className="bg-bark hover:bg-bark/90 text-white w-full"
              >
                <Link href="/submit">Submit a New Ticket</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <EnvelopeSimpleIcon className="size-10 text-stone mx-auto mb-3" />
              <h1 className="text-2xl font-semibold text-bark">
                Find My Tickets
              </h1>
              <p className="text-sm text-stone mt-2 leading-relaxed">
                Enter the email address you used when submitting a ticket. We'll
                send you links to all your open tickets.
              </p>
            </div>

            <form
              className="bg-white rounded-xl border border-sand shadow-soft p-6 space-y-4"
              onSubmit={handleSubmit}
            >
              <div className="space-y-1.5">
                <Label
                  className="text-bark text-sm font-medium"
                  htmlFor="email"
                >
                  Email Address
                </Label>
                <Input
                  className=""
                  disabled={submitting}
                  id="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  type="email"
                  value={email}
                />
                {error && <p className="text-xs text-red-600">{error}</p>}
              </div>

              <Button
                className="w-full bg-bark hover:bg-bark/90 text-white"
                disabled={submitting}
                type="submit"
              >
                {submitting ? "Sending…" : "Send My Tickets"}
              </Button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
