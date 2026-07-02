"use client";

import { useEffect } from "react";

const INSTANCE_ID = process.env.NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID;

/**
 * Registers the current agent's browser with Pusher Beams so they receive OS-level
 * push notifications. No-op when Beams isn't configured (`NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID`
 * unset) or the browser can't support web push. Renders nothing.
 */
export function PushInit({ userId }: { userId: string }) {
  useEffect(() => {
    if (!INSTANCE_ID) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    let cancelled = false;

    (async () => {
      try {
        const PusherPushNotifications = await import("@pusher/push-notifications-web");
        const beamsClient = new PusherPushNotifications.Client({
          instanceId: INSTANCE_ID as string,
        });
        const tokenProvider = new PusherPushNotifications.TokenProvider({
          url: "/api/notifications/beams-auth",
        });

        await beamsClient.start();
        if (cancelled) return;
        // Associate this device with the signed-in agent. Re-running with a
        // different user reassigns the device, so sign-out/in "just works".
        await beamsClient.setUserId(userId, tokenProvider);
      } catch (err) {
        // Permission denied / unsupported browser / token endpoint unavailable —
        // all non-fatal (OS push simply won't work; in-app + email still do).
        console.warn(
          "[beams] push registration skipped:",
          err instanceof Error ? err.message : err
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return null;
}
