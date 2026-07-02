"use client";

import { useEffect, useRef } from "react";

/**
 * Invisible marker that scrolls itself into view once, on mount. Place as the
 * last element in a long thread (chat, comments) so opening the page lands on
 * the latest message instead of the top — works regardless of which ancestor
 * is the actual scroll container (e.g. a fixed-height `overflow-y-auto` shell).
 */
export function ScrollToBottomOnMount() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "end" });
  }, []);

  return <div ref={ref} />;
}
