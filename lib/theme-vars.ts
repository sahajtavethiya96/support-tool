// Plain (non-"use client") module so both theme-provider.tsx (client) and
// theme-reset-script.tsx (server) can import this list — a server component
// importing a data export from a "use client" module gets an opaque client
// reference instead of the real array.
export const ALL_THEME_VARS = [
  "--brand-bark",
  "--brand-sand",
  "--brand-stone",
  "--brand-cream",
  "--primary",
  "--primary-foreground",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--accent",
  "--accent-foreground",
  "--secondary",
  "--secondary-foreground",
  "--border",
  "--input",
  "--ring",
];
