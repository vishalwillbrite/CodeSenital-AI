"use client";

import { useEffect, useState, useCallback } from "react";

export type ThemeMode = "system" | "light" | "dark";
export type AccentColor = "green" | "blue" | "orange" | "red" | "violet";

export interface AccentDefinition {
  id: AccentColor;
  label: string;
  swatchHex: string;
  accentGreen: string;
  accentGreenLight: string;
  accentGreenStrong: string;
  accentTint: string;
  textOnAccent: string;
}

export const ACCENT_PALETTES: Record<AccentColor, AccentDefinition> = {
  green: {
    id: "green",
    label: "Emerald Green",
    swatchHex: "#10B981",
    accentGreen: "#10B981",
    accentGreenLight: "#34D399",
    accentGreenStrong: "#059669",
    accentTint: "rgba(16, 185, 129, 0.12)",
    textOnAccent: "#04130D",
  },
  blue: {
    id: "blue",
    label: "Ocean Blue",
    swatchHex: "#3B82F6",
    accentGreen: "#3B82F6",
    accentGreenLight: "#60A5FA",
    accentGreenStrong: "#2563EB",
    accentTint: "rgba(59, 130, 246, 0.14)",
    textOnAccent: "#FFFFFF",
  },
  orange: {
    id: "orange",
    label: "Sunset Orange",
    swatchHex: "#F97316",
    accentGreen: "#F97316",
    accentGreenLight: "#FB923C",
    accentGreenStrong: "#EA580C",
    accentTint: "rgba(249, 115, 22, 0.14)",
    textOnAccent: "#FFFFFF",
  },
  red: {
    id: "red",
    label: "Crimson Red",
    swatchHex: "#EF4444",
    accentGreen: "#EF4444",
    accentGreenLight: "#F87171",
    accentGreenStrong: "#DC2626",
    accentTint: "rgba(239, 68, 68, 0.14)",
    textOnAccent: "#FFFFFF",
  },
  violet: {
    id: "violet",
    label: "Royal Violet",
    swatchHex: "#8B5CF6",
    accentGreen: "#8B5CF6",
    accentGreenLight: "#A78BFA",
    accentGreenStrong: "#7C3AED",
    accentTint: "rgba(139, 92, 246, 0.14)",
    textOnAccent: "#FFFFFF",
  },
};

const THEME_STORAGE_KEY = "codesentinel_theme_mode";
const ACCENT_STORAGE_KEY = "codesentinel_accent_color";

export function useThemePreferences() {
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [accentColor, setAccentColorState] = useState<AccentColor>("green");
  const [isMounted, setIsMounted] = useState(false);

  // Apply theme and accent variables to DOM
  const applyThemeToDOM = useCallback((mode: ThemeMode, accent: AccentColor) => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;

    // 1. Resolve Theme Mode
    let resolvedTheme: "dark" | "light" = "dark";
    if (mode === "light") {
      resolvedTheme = "light";
    } else if (mode === "dark") {
      resolvedTheme = "dark";
    } else {
      // System
      resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    root.setAttribute("data-theme", resolvedTheme);
    root.setAttribute("data-theme-setting", mode);
    root.setAttribute("data-accent", accent);

    // 2. Apply Accent Colors as direct CSS custom properties for instant reactivity
    const palette = ACCENT_PALETTES[accent] || ACCENT_PALETTES.green;
    root.style.setProperty("--accent-green", palette.accentGreen);
    root.style.setProperty("--accent-green-light", palette.accentGreenLight);
    root.style.setProperty("--accent-green-strong", palette.accentGreenStrong);
    root.style.setProperty("--accent-tint", palette.accentTint);
    root.style.setProperty("--text-on-green", palette.textOnAccent);
  }, []);

  // Initialize from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    let initialMode: ThemeMode = "system";
    let initialAccent: AccentColor = "green";

    try {
      const savedMode = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (savedMode && ["system", "light", "dark"].includes(savedMode)) {
        initialMode = savedMode;
      }

      const savedAccent = localStorage.getItem(ACCENT_STORAGE_KEY) as AccentColor | null;
      if (savedAccent && Object.keys(ACCENT_PALETTES).includes(savedAccent)) {
        initialAccent = savedAccent;
      }
    } catch {
      // Ignore localStorage read errors in restricted contexts
    }

    setThemeModeState(initialMode);
    setAccentColorState(initialAccent);
    applyThemeToDOM(initialMode, initialAccent);

    // Listen for OS color scheme changes if mode is 'system'
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      const currentMode = (localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode) || "system";
      if (currentMode === "system") {
        const currentAccent = (localStorage.getItem(ACCENT_STORAGE_KEY) as AccentColor) || "green";
        applyThemeToDOM("system", currentAccent);
      }
    };

    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [applyThemeToDOM]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore write errors
    }
    applyThemeToDOM(mode, accentColor);
  };

  const setAccentColor = (accent: AccentColor) => {
    setAccentColorState(accent);
    try {
      localStorage.setItem(ACCENT_STORAGE_KEY, accent);
    } catch {
      // Ignore write errors
    }
    applyThemeToDOM(themeMode, accent);
  };

  return {
    themeMode,
    setThemeMode,
    accentColor,
    setAccentColor,
    isMounted,
  };
}
