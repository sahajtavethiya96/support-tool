"use client";

import * as React from "react";
import { ALL_THEME_VARS } from "@/lib/theme-vars";

export interface ThemeContextType {
  appearanceMode: "light" | "dark" | "auto";
  cancelThemeSettings: () => void;
  currentTheme: string;
  savedAppearance: "light" | "dark" | "auto";
  savedTheme: string;
  saveThemeSettings: () => Promise<void>;
  setAppearance: (mode: "light" | "dark" | "auto") => void;
  setTheme: (theme: string) => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(
  undefined
);

interface ThemeProviderProps {
  children: React.ReactNode;
  initialAppearanceMode: "light" | "dark" | "auto";
  initialTheme: string;
}

type ThemeVars = Record<string, string>;

// Each preset defines brand palette vars + aligned shadcn tokens
const LIGHT_THEME_VARS: Record<string, ThemeVars> = {
  default: {
    "--brand-bark": "#384959",
    "--brand-sand": "#88BDF2",
    "--brand-stone": "#6A89A7",
    "--brand-cream": "#BDDDFC",
    "--primary": "#384959",
    "--primary-foreground": "#ffffff",
    "--sidebar": "#384959",
    "--sidebar-foreground": "#BDDDFC",
    "--sidebar-primary": "#BDDDFC",
    "--sidebar-primary-foreground": "#384959",
    "--sidebar-accent": "rgba(189,221,252,0.12)",
    "--sidebar-accent-foreground": "#BDDDFC",
    "--sidebar-border": "rgba(136,189,242,0.2)",
    "--sidebar-ring": "#88BDF2",
    "--accent": "#BDDDFC",
    "--accent-foreground": "#384959",
    "--secondary": "#BDDDFC",
    "--secondary-foreground": "#384959",
    "--border": "#88BDF2",
    "--input": "#88BDF2",
    "--ring": "#384959",
  },
  ocean: {
    "--brand-bark": "#1A4A5E",
    "--brand-sand": "#4AADCA",
    "--brand-stone": "#5B8EA6",
    "--brand-cream": "#C2E8F5",
    "--primary": "#1A4A5E",
    "--primary-foreground": "#ffffff",
    "--sidebar": "#1A4A5E",
    "--sidebar-foreground": "#C2E8F5",
    "--sidebar-primary": "#C2E8F5",
    "--sidebar-primary-foreground": "#1A4A5E",
    "--sidebar-accent": "rgba(194,232,245,0.12)",
    "--sidebar-accent-foreground": "#C2E8F5",
    "--sidebar-border": "rgba(74,173,202,0.2)",
    "--sidebar-ring": "#4AADCA",
    "--accent": "#C2E8F5",
    "--accent-foreground": "#1A4A5E",
    "--secondary": "#C2E8F5",
    "--secondary-foreground": "#1A4A5E",
    "--border": "#4AADCA",
    "--input": "#4AADCA",
    "--ring": "#1A4A5E",
  },
  forest: {
    "--brand-bark": "#1E4D35",
    "--brand-sand": "#4AAD78",
    "--brand-stone": "#5B8E70",
    "--brand-cream": "#C2F0D8",
    "--primary": "#1E4D35",
    "--primary-foreground": "#ffffff",
    "--sidebar": "#1E4D35",
    "--sidebar-foreground": "#C2F0D8",
    "--sidebar-primary": "#C2F0D8",
    "--sidebar-primary-foreground": "#1E4D35",
    "--sidebar-accent": "rgba(194,240,216,0.12)",
    "--sidebar-accent-foreground": "#C2F0D8",
    "--sidebar-border": "rgba(74,173,120,0.2)",
    "--sidebar-ring": "#4AAD78",
    "--accent": "#C2F0D8",
    "--accent-foreground": "#1E4D35",
    "--secondary": "#C2F0D8",
    "--secondary-foreground": "#1E4D35",
    "--border": "#4AAD78",
    "--input": "#4AAD78",
    "--ring": "#1E4D35",
  },
  sunset: {
    "--brand-bark": "#5E2D1A",
    "--brand-sand": "#CA6B4A",
    "--brand-stone": "#A6745B",
    "--brand-cream": "#F5D5C2",
    "--primary": "#5E2D1A",
    "--primary-foreground": "#ffffff",
    "--sidebar": "#5E2D1A",
    "--sidebar-foreground": "#F5D5C2",
    "--sidebar-primary": "#F5D5C2",
    "--sidebar-primary-foreground": "#5E2D1A",
    "--sidebar-accent": "rgba(245,213,194,0.12)",
    "--sidebar-accent-foreground": "#F5D5C2",
    "--sidebar-border": "rgba(202,107,74,0.2)",
    "--sidebar-ring": "#CA6B4A",
    "--accent": "#F5D5C2",
    "--accent-foreground": "#5E2D1A",
    "--secondary": "#F5D5C2",
    "--secondary-foreground": "#5E2D1A",
    "--border": "#CA6B4A",
    "--input": "#CA6B4A",
    "--ring": "#5E2D1A",
  },
  indigo: {
    "--brand-bark": "#2D1E5E",
    "--brand-sand": "#6B4ACA",
    "--brand-stone": "#745BB8",
    "--brand-cream": "#D8C2F5",
    "--primary": "#2D1E5E",
    "--primary-foreground": "#ffffff",
    "--sidebar": "#2D1E5E",
    "--sidebar-foreground": "#D8C2F5",
    "--sidebar-primary": "#D8C2F5",
    "--sidebar-primary-foreground": "#2D1E5E",
    "--sidebar-accent": "rgba(216,194,245,0.12)",
    "--sidebar-accent-foreground": "#D8C2F5",
    "--sidebar-border": "rgba(107,74,202,0.2)",
    "--sidebar-ring": "#6B4ACA",
    "--accent": "#D8C2F5",
    "--accent-foreground": "#2D1E5E",
    "--secondary": "#D8C2F5",
    "--secondary-foreground": "#2D1E5E",
    "--border": "#6B4ACA",
    "--input": "#6B4ACA",
    "--ring": "#2D1E5E",
  },
  slate: {
    "--brand-bark": "#263040",
    "--brand-sand": "#6B85A0",
    "--brand-stone": "#7A8FA6",
    "--brand-cream": "#C8D8E8",
    "--primary": "#263040",
    "--primary-foreground": "#ffffff",
    "--sidebar": "#263040",
    "--sidebar-foreground": "#C8D8E8",
    "--sidebar-primary": "#C8D8E8",
    "--sidebar-primary-foreground": "#263040",
    "--sidebar-accent": "rgba(200,216,232,0.12)",
    "--sidebar-accent-foreground": "#C8D8E8",
    "--sidebar-border": "rgba(107,133,160,0.2)",
    "--sidebar-ring": "#6B85A0",
    "--accent": "#C8D8E8",
    "--accent-foreground": "#263040",
    "--secondary": "#C8D8E8",
    "--secondary-foreground": "#263040",
    "--border": "#6B85A0",
    "--input": "#6B85A0",
    "--ring": "#263040",
  },
};

// Dark mode: neutral 3-layer surfaces come from the `.dark` block in globals.css.
// Per preset we only recolor the *accent* tokens (primary/ring/sidebar accent) to
// the preset's brighter brand tone, so the dark UI stays neutral but on-brand.
const DARK_THEME_VARS: Record<string, ThemeVars> = {
  default: {
    "--brand-bark": "#384959",
    "--brand-sand": "#88BDF2",
    "--brand-stone": "#6A89A7",
    "--brand-cream": "#BDDDFC",
    "--primary": "#88BDF2",
    "--primary-foreground": "#0D0F12",
    "--ring": "#88BDF2",
    "--sidebar-primary": "#88BDF2",
    "--sidebar-primary-foreground": "#0D0F12",
  },
  ocean: {
    "--brand-bark": "#1A4A5E",
    "--brand-sand": "#4AADCA",
    "--brand-stone": "#5B8EA6",
    "--brand-cream": "#C2E8F5",
    "--primary": "#4AADCA",
    "--primary-foreground": "#0D0F12",
    "--ring": "#4AADCA",
    "--sidebar-primary": "#4AADCA",
    "--sidebar-primary-foreground": "#0D0F12",
  },
  forest: {
    "--brand-bark": "#1E4D35",
    "--brand-sand": "#4AAD78",
    "--brand-stone": "#5B8E70",
    "--brand-cream": "#C2F0D8",
    "--primary": "#4AAD78",
    "--primary-foreground": "#0D0F12",
    "--ring": "#4AAD78",
    "--sidebar-primary": "#4AAD78",
    "--sidebar-primary-foreground": "#0D0F12",
  },
  sunset: {
    "--brand-bark": "#5E2D1A",
    "--brand-sand": "#CA6B4A",
    "--brand-stone": "#A6745B",
    "--brand-cream": "#F5D5C2",
    "--primary": "#CA6B4A",
    "--primary-foreground": "#0D0F12",
    "--ring": "#CA6B4A",
    "--sidebar-primary": "#CA6B4A",
    "--sidebar-primary-foreground": "#0D0F12",
  },
  indigo: {
    "--brand-bark": "#2D1E5E",
    "--brand-sand": "#6B4ACA",
    "--brand-stone": "#745BB8",
    "--brand-cream": "#D8C2F5",
    "--primary": "#6B4ACA",
    "--primary-foreground": "#F0F2F5",
    "--ring": "#6B4ACA",
    "--sidebar-primary": "#6B4ACA",
    "--sidebar-primary-foreground": "#F0F2F5",
  },
  slate: {
    "--brand-bark": "#263040",
    "--brand-sand": "#6B85A0",
    "--brand-stone": "#7A8FA6",
    "--brand-cream": "#C8D8E8",
    "--primary": "#6B85A0",
    "--primary-foreground": "#0D0F12",
    "--ring": "#6B85A0",
    "--sidebar-primary": "#6B85A0",
    "--sidebar-primary-foreground": "#0D0F12",
  },
};

const LS_THEME = "support_tool_theme";
const LS_APPEARANCE = "support_tool_appearance";

export function ThemeProvider({
  children,
  initialTheme,
  initialAppearanceMode,
}: ThemeProviderProps) {
  const [savedTheme, setSavedTheme] = React.useState(initialTheme);
  const [savedAppearance, setSavedAppearance] = React.useState<
    "light" | "dark" | "auto"
  >(initialAppearanceMode);
  const [currentTheme, setCurrentThemeState] = React.useState(initialTheme);
  const [appearanceMode, setAppearanceModeState] = React.useState<
    "light" | "dark" | "auto"
  >(initialAppearanceMode);

  React.useEffect(() => {
    const localTheme = localStorage.getItem(LS_THEME);
    const localAppearance = localStorage.getItem(LS_APPEARANCE) as
      | "light"
      | "dark"
      | "auto"
      | null;
    const resolvedTheme = localTheme ?? initialTheme;
    const resolvedAppearance = localAppearance ?? initialAppearanceMode;
    setSavedTheme(resolvedTheme);
    setSavedAppearance(resolvedAppearance);
    setCurrentThemeState(resolvedTheme);
    setAppearanceModeState(resolvedAppearance);
  }, [initialTheme, initialAppearanceMode]);

  const applyThemeToDOM = React.useCallback(
    (theme: string, appearance: "light" | "dark" | "auto") => {
      if (typeof window === "undefined") {
        return;
      }
      const root = document.documentElement;

      let isDark = false;
      if (appearance === "dark") {
        isDark = true;
      } else if (appearance === "light") {
        isDark = false;
      } else {
        isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      }

      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }

      for (const key of ALL_THEME_VARS) {
        root.style.removeProperty(key);
      }

      const vars = isDark
        ? (DARK_THEME_VARS[theme] ?? DARK_THEME_VARS.default)
        : (LIGHT_THEME_VARS[theme] ?? LIGHT_THEME_VARS.default);

      for (const [key, value] of Object.entries(vars)) {
        root.style.setProperty(key, value);
      }
    },
    []
  );

  React.useEffect(() => {
    applyThemeToDOM(currentTheme, appearanceMode);
    if (appearanceMode === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyThemeToDOM(currentTheme, "auto");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [currentTheme, appearanceMode, applyThemeToDOM]);

  const setTheme = React.useCallback(
    (theme: string) => setCurrentThemeState(theme),
    []
  );
  const setAppearance = React.useCallback(
    (mode: "light" | "dark" | "auto") => setAppearanceModeState(mode),
    []
  );

  const saveThemeSettings = React.useCallback(async () => {
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: currentTheme, appearanceMode }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "Failed to save");
    }
    setSavedTheme(currentTheme);
    setSavedAppearance(appearanceMode);
    localStorage.setItem(LS_THEME, currentTheme);
    localStorage.setItem(LS_APPEARANCE, appearanceMode);
  }, [currentTheme, appearanceMode]);

  const cancelThemeSettings = React.useCallback(() => {
    setCurrentThemeState(savedTheme);
    setAppearanceModeState(savedAppearance);
  }, [savedTheme, savedAppearance]);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        appearanceMode,
        setTheme,
        setAppearance,
        saveThemeSettings,
        cancelThemeSettings,
        savedTheme,
        savedAppearance,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
