import PusherServer from "pusher";
import { env } from "@/lib/env";

let client: PusherServer | null = null;

function getClient(): PusherServer | null {
  if (client) {
    return client;
  }
  const {
    PUSHER_APP_ID,
    NEXT_PUBLIC_PUSHER_KEY,
    PUSHER_SECRET,
    NEXT_PUBLIC_PUSHER_CLUSTER,
  } = env;
  if (
    !(
      PUSHER_APP_ID &&
      NEXT_PUBLIC_PUSHER_KEY &&
      PUSHER_SECRET &&
      NEXT_PUBLIC_PUSHER_CLUSTER
    )
  ) {
    return null;
  }
  client = new PusherServer({
    appId: PUSHER_APP_ID,
    key: NEXT_PUBLIC_PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: NEXT_PUBLIC_PUSHER_CLUSTER,
    useTLS: true,
  });
  return client;
}

/** Whether Pusher Channels (real-time updates) is configured for this instance. */
export function isRealtimeConfigured(): boolean {
  return getClient() !== null;
}

/**
 * Authorize a client's private-channel subscription. Returns null when
 * Channels isn't configured — callers should respond 404 in that case.
 */
export function authorizeChannel(
  socketId: string,
  channel: string
): { auth: string } | null {
  const c = getClient();
  return c ? c.authorizeChannel(socketId, channel) : null;
}

/**
 * Notify agents viewing the ticket list that a new ticket was created.
 * No-op when Channels isn't configured. Payload is deliberately empty — the
 * client just triggers a refetch rather than rendering pushed data directly.
 */
export async function publishTicketCreated(): Promise<void> {
  await getClient()?.trigger("private-tickets", "ticket.created", {});
}

/**
 * Notify anyone viewing this ticket's detail page that a new comment (reply
 * or internal note, from any author) was added. No-op when Channels isn't
 * configured.
 */
export async function publishTicketCommentCreated(
  ticketId: string
): Promise<void> {
  await getClient()?.trigger(
    `private-ticket-${ticketId}`,
    "comment.created",
    {}
  );
}
