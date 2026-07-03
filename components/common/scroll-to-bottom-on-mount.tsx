"use client";

import { useEffect, useRef } from "react";
import { CHAT_BOTTOM_MARKER_ID } from "@/lib/scroll-chat";

/**
 * Invisible marker that scrolls itself into view once, on mount. Place as the
 * last element in a long thread (chat, comments) so opening the page lands on
 * the latest message instead of the top — works regardless of which ancestor
 * is the actual scroll container (e.g. a fixed-height `overflow-y-auto` shell).
 * Carries a fixed id so `scrollChatToBottom()` (lib/scroll-chat.ts) can re-target
 * it later, e.g. after sending a reply.
 */
export function ScrollToBottomOnMount() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroll = () => ref.current?.scrollIntoView({ block: "end" });
    scroll();
    // Reply bodies render through Tiptap with `immediatelyRender: false`, so
    // they mount a tick after this effect and can grow taller once they swap
    // in for their plain-text fallback. Re-scroll once they've settled so we
    // land at the true bottom instead of wherever the page was mid-mount.
    const timeout = setTimeout(scroll, 200);
    return () => clearTimeout(timeout);
  }, []);

  return <div id={CHAT_BOTTOM_MARKER_ID} ref={ref} />;
}
