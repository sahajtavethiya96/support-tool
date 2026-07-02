"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getPusherClientForCustomer } from "@/lib/pusher-browser";

/**
 * Subscribes to `private-ticket-{ticketId}` (authorized via the customer's
 * own ticket token, not a session) and soft-refreshes the page on
 * `comment.created` — so a customer sees an agent's reply live, no manual
 * refresh. No-op when Pusher Channels isn't configured. Renders nothing.
 */
export function TicketRealtime({
  ticketId,
  token,
}: {
  ticketId: string;
  token: string;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const channelName = `private-ticket-${ticketId}`;

    (async () => {
      const pusher = await getPusherClientForCustomer(token);
      if (!pusher || cancelled) {
        return;
      }
      const channel = pusher.subscribe(channelName);
      channel.bind("comment.created", () => router.refresh());
      unsubscribe = () => {
        channel.unbind_all();
        pusher.unsubscribe(channelName);
        pusher.disconnect();
      };
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router, ticketId, token]);

  return null;
}
