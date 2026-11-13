/**
 * Theme preference: "light", "dark" or "system" (follow the device). The effective theme is
 * written to <html data-theme="light|dark"> by an inline script before first paint (no flash)
 * and by the header toggle; CSS tokens, Tailwind's `dark:` variant and the charts read it.
 */
export type ThemePreference = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "agni-theme";
export const THEME_EVENT = "agni-theme-change";

export function parsePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(pref: ThemePreference, systemDark: boolean): Theme {
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}

/**
 * Inline <head> script: applies the saved preference before the page paints, follows OS changes
 * while the preference is "system", and exposes window.__agniTheme(pref) for the toggle.
 * Self-contained (no imports); storage access is guarded (private mode, blocked storage).
 */
export const THEME_SCRIPT = `(function(){
var K=${JSON.stringify(THEME_STORAGE_KEY)},E=${JSON.stringify(THEME_EVENT)},d=document.documentElement,m=window.matchMedia("(prefers-color-scheme: dark)");
function get(){try{var v=localStorage.getItem(K);return v==="light"||v==="dark"?v:"system"}catch(e){return "system"}}
function apply(p){var t=p==="system"?(m.matches?"dark":"light"):p;d.setAttribute("data-theme",t);d.setAttribute("data-theme-pref",p);d.style.colorScheme=t}
window.__agniTheme=function(p){try{if(p==="system")localStorage.removeItem(K);else localStorage.setItem(K,p)}catch(e){}apply(p);window.dispatchEvent(new Event(E))};
apply(get());
m.addEventListener("change",function(){apply(get());window.dispatchEvent(new Event(E))});
window.addEventListener("storage",function(e){if(e.key===K){apply(get());window.dispatchEvent(new Event(E))}});
})();`;
