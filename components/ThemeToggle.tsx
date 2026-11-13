"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { parsePreference, THEME_EVENT, type ThemePreference } from "@/lib/theme";

declare global {
  interface Window {
    __agniTheme?: (pref: ThemePreference) => void;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light theme", Icon: Sun },
  { value: "dark", label: "Dark theme", Icon: Moon },
  { value: "system", label: "Device theme", Icon: Monitor },
];

/** Light / Dark / Device switch. The choice is remembered in this browser. */
export function ThemeToggle() {
  const pref = useSyncExternalStore(
    subscribe,
    () => parsePreference(document.documentElement.getAttribute("data-theme-pref")),
    () => "system" as ThemePreference,
  );
  return (
    <ToggleGroup
      aria-label="Colour theme"
      value={[pref]}
      onValueChange={(v) => {
        const next = v[0] as ThemePreference | undefined;
        if (next) window.__agniTheme?.(next); // empty = re-click of the active item: keep it
      }}
      variant="outline"
      size="sm"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <ToggleGroupItem key={value} value={value} aria-label={label} title={label}>
          <Icon className="size-4" aria-hidden />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
