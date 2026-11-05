/*
 * User appearance preference: light, dark or follow the system.
 *
 * A personal, per-device preference stored in localStorage. It never changes
 * organization branding. <html data-theme> holds the resolved theme
 * ("light" | "dark"), which drives `color-scheme` and therefore every token.
 */

export type Appearance = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export const APPEARANCE_STORAGE_KEY = "sollelio.appearance";
export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** Inline-script expression for the stored preference; mirrors readAppearance(). */
const readPreferenceJs = `(function(){try{var s=localStorage.getItem(${JSON.stringify(
  APPEARANCE_STORAGE_KEY,
)});return s==="light"||s==="dark"?s:"system"}catch(e){return "system"}})()`;

/**
 * Runs in <head> during HTML parsing, before first paint, so a stored
 * preference never flashes the wrong theme. Mirrors resolveTheme() below.
 */
export const appearancePrePaintScript = `(function(){var p=${readPreferenceJs};var t=p==="system"?(window.matchMedia(${JSON.stringify(
  DARK_SCHEME_QUERY,
)}).matches?"dark":"light"):p;document.documentElement.setAttribute("data-theme",t)})()`;

/**
 * Runs right after a switcher's radios are parsed and checks the stored option
 * before first paint. React hydration keeps a radio's live `checked` state, and
 * its first client render reads the same preference, so the two agree.
 */
export function switcherPrePaintScript(groupId: string) {
  return `(function(){var g=document.getElementById(${JSON.stringify(
    groupId,
  )});var i=g&&g.querySelector('input[value="'+${readPreferenceJs}+'"]');if(i)i.checked=true})()`;
}

const listeners = new Set<() => void>();
/** Used only when storage is unavailable (private mode, blocked site data). */
let memoryFallback: Appearance = "system";

export function readAppearance(): Appearance {
  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return memoryFallback;
  }
}

export function resolveTheme(appearance: Appearance): Theme {
  if (appearance !== "system") return appearance;
  return window.matchMedia(DARK_SCHEME_QUERY).matches ? "dark" : "light";
}

export function applyAppearance(appearance: Appearance) {
  document.documentElement.setAttribute("data-theme", resolveTheme(appearance));
}

export function setAppearance(appearance: Appearance) {
  memoryFallback = appearance;
  try {
    if (appearance === "system") {
      window.localStorage.removeItem(APPEARANCE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
    }
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
  applyAppearance(appearance);
  listeners.forEach((notify) => notify());
}

/** Notifies on changes from this tab and from other tabs. */
export function subscribeAppearance(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === APPEARANCE_STORAGE_KEY || event.key === null) notify();
  };
  listeners.add(notify);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}
