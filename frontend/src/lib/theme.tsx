"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Theme scope:
 *   - `light` | `dark`        → explicit user preference, persisted.
 *   - `system`                → follow OS; not persisted beyond session.
 *
 * Implementation: the *active* resolved theme is mirrored onto
 * `<html class="dark">` / no class. A small inline script in the root
 * layout applies the correct class before React hydrates to prevent FOUC.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
  toggle: () => void;
};

const STORAGE_KEY = "blogify.theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveSystem(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyClass(theme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start with light so SSR output is stable; the inline script in layout.tsx
  // has already set the real class on <html> before hydration.
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  // Read stored preference on mount.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const next: ThemePreference =
      stored === "light" || stored === "dark" ? stored : "system";
    setPreferenceState(next);
    const active = next === "system" ? resolveSystem() : next;
    setResolved(active);
    applyClass(active);
  }, []);

  // Follow system changes when preference is `system`.
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = mq.matches ? "dark" : "light";
      setResolved(next);
      applyClass(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    if (next === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
      const active = resolveSystem();
      setResolved(active);
      applyClass(active);
    } else {
      window.localStorage.setItem(STORAGE_KEY, next);
      setResolved(next);
      applyClass(next);
    }
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within <ThemeProvider>");
  }
  return ctx;
}

/**
 * Inline script injected into <head> before hydration. Must stay small and
 * self-contained — no imports, no TypeScript syntax.
 */
export const themeBootstrapScript = `
(function(){
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var isDark = stored === 'dark' ||
      (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var root = document.documentElement;
    if (isDark) root.classList.add('dark');
    root.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (_) {}
})();
`;
