"use client";

import { useLayoutEffect } from "react";
import { ALL_THEME_VARS } from "@/lib/theme-vars";

// Agent/admin pages write theme colors as inline styles directly on <html>
// (see theme-provider.tsx's applyThemeToDOM) — those never get cleaned up
// when navigating away (e.g. logging out), since it's the same <html>
// element persisting across a client-side route change. This page has no
// ThemeProvider and must always show the static default brand palette.
//
// A beforeInteractive <Script> (the ThemeScript approach) doesn't work here:
// it only runs on a hard/full page load, never on the client-side route
// transition logout actually performs — exactly the case this needs to
// handle. useLayoutEffect re-runs on every mount (including soft
// navigations) and fires before the browser paints, so there's no flash.
export function ThemeResetScript() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const key of ALL_THEME_VARS) {
      root.style.removeProperty(key);
    }
    root.classList.remove("dark");
  }, []);

  return null;
}
