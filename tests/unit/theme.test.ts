import { describe, expect, it } from "vitest";
import { parsePreference, resolveTheme, THEME_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

describe("theme preference", () => {
  it("accepts light and dark, everything else means follow the device", () => {
    expect(parsePreference("light")).toBe("light");
    expect(parsePreference("dark")).toBe("dark");
    expect(parsePreference("system")).toBe("system");
    expect(parsePreference(null)).toBe("system");
    expect(parsePreference("purple")).toBe("system");
  });

  it("resolves the effective theme", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("ships a self-contained head script that parses and uses the storage key", () => {
    expect(() => new Function(THEME_SCRIPT)).not.toThrow();
    expect(THEME_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_SCRIPT).toContain("data-theme");
  });
});
