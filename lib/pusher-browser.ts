"use client";

const KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

let clientPromise: Promise<import("pusher-js").default | null> | null = null;

/**
 * Lazily creates (and reuses) a single Pusher Channels client for the whole
 * tab. Dynamic-imports `pusher-js` so it stays out of the main bundle for
 * self-hosters who never configure this. Resolves to null when
 * NEXT_PUBLIC_PUSHER_KEY / NEXT_PUBLIC_PUSHER_CLUSTER aren't set.
 */
export function getPusherClient(): Promise<import("pusher-js").default | null> {
  if (clientPromise) {
    return clientPromise;
  }
  if (!(KEY && CLUSTER)) {
    clientPromise = Promise.resolve(null);
    return clientPromise;
  }

  clientPromise = import("pusher-js").then(
    ({ default: Pusher }) =>
      new Pusher(KEY, {
        cluster: CLUSTER,
        channelAuthorization: {
          endpoint: "/api/pusher/auth",
          transport: "ajax",
        },
      })
  );
  return clientPromise;
}

/**
 * Creates a fresh (never cached/shared) Pusher client authorized as a
 * customer for one specific ticket — sends `token` alongside the standard
 * socket_id/channel_name auth fields so the server can verify it matches
 * that ticket's customerToken (see app/api/pusher/auth/route.ts). Not
 * cached like `getPusherClient()` because the customer portal lets a
 * customer navigate between sibling tickets, each with a different token.
 */
export function getPusherClientForCustomer(
  token: string
): Promise<import("pusher-js").default | null> {
  if (!(KEY && CLUSTER)) {
    return Promise.resolve(null);
  }

  return import("pusher-js").then(
    ({ default: Pusher }) =>
      new Pusher(KEY, {
        cluster: CLUSTER,
        channelAuthorization: {
          endpoint: "/api/pusher/auth",
          transport: "ajax",
          params: { token },
        },
      })
  );
}
