"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getPusherClient } from "@/lib/pusher-browser";

/**
 * Subscribes to `private-ticket-{ticketId}` while mounted and soft-refreshes
 * the current route on `comment.created` — any new reply or internal note,
 * from any author, live-updates whoever's viewing this ticket. No-op when
 * Pusher Channels isn't configured. Renders nothing.
 */
export function TicketDetailRealtime({ ticketId }: { ticketId: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    const channelName = `private-ticket-${ticketId}`;

    (async () => {
      const pusher = await getPusherClient();
      if (!pusher || cancelled) {
        return;
      }
      const channel = pusher.subscribe(channelName);
      channel.bind("comment.created", () => router.refresh());
      unsubscribe = () => {
        channel.unbind_all();
        pusher.unsubscribe(channelName);
      };
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router, ticketId]);

  return null;
}
