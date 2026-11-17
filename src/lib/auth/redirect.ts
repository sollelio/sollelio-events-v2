/**
 * Post-authentication redirect targets.
 *
 * A `next` value comes from the URL or a form, so it is untrusted. Only a
 * same-origin path is accepted; anything else falls back. The check runs on
 * the normalised URL, so dot segments such as `/..//evil.example` cannot
 * become a protocol-relative `//evil.example` after resolution.
 */

const BASE = "http://redirect.invalid";
const MAX_LENGTH = 2048;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
/** Paths that must never be a post-authentication destination. */
const EXCLUDED_PREFIXES = ["/auth/"];

export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (value.length === 0 || value.length > MAX_LENGTH) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || CONTROL_CHARACTERS.test(value)) return fallback;

  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== BASE || url.pathname.startsWith("//")) return fallback;
  if (EXCLUDED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return fallback;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
