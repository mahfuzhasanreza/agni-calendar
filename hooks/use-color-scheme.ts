"use client";

import { useSyncExternalStore } from "react";
import type { ColorScheme } from "@/lib/colors";

const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** The operating system color scheme (charts use their own validated steps per mode). */
export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(
    subscribe,
    () => (window.matchMedia(QUERY).matches ? "dark" : "light"),
    () => "light",
  );
}
