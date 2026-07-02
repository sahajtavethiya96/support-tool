import { CheckCircleIcon, TicketIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/config/platform";

interface Props {
  searchParams: Promise<{ ticket?: string; email?: string }>;
}

export default async function SubmitSuccessPage({ searchParams }: Props) {
  const { ticket, email } = await searchParams;

  return (
    <div className="min-h-screen bg-public">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-sand sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link className="flex items-center gap-2.5" href="/">
            <div className="size-7 rounded-md bg-bark flex items-center justify-center">
              <TicketIcon className="size-4 text-cream" weight="fill" />
            </div>
            <span className="font-semibold text-bark text-sm">
              {PRODUCT_NAME}
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="flex justify-center mb-5">
          <CheckCircleIcon className="size-14 text-emerald-500" />
        </div>

        <h1 className="text-2xl font-semibold text-bark mb-2">
          {ticket ? `Ticket #${ticket} submitted!` : "Ticket submitted!"}
        </h1>

        <p className="text-stone text-sm leading-relaxed mb-8">
          {email ? (
            <>
              We've sent a confirmation email to{" "}
              <span className="font-medium text-bark">{email}</span> with a link
              to track your ticket. Check your inbox — it should arrive within a
              few minutes.
            </>
          ) : (
            "We've sent you a confirmation email with a link to track your ticket."
          )}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="bg-bark hover:bg-bark/90 text-white">
            <Link href="/submit">Submit Another Ticket</Link>
          </Button>
          <Button
            asChild
            className="border-sand text-bark hover:bg-cream"
            variant="outline"
          >
            <Link href="/my-tickets">View My Tickets</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
