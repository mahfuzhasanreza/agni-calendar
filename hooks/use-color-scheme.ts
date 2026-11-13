"use client";

import { useSyncExternalStore } from "react";
import type { ColorScheme } from "@/lib/colors";
import { THEME_EVENT } from "@/lib/theme";

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

/**
 * The effective colour scheme (header toggle: light / dark / device), as set on
 * <html data-theme> by lib/theme.ts. Charts use their own validated colour steps per scheme.
 */
export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"),
    () => "light",
  );
}
