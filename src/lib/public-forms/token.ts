import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/**
 * Server-side anti-abuse primitives for public forms (ADR 0009). Secrets are
 * passed in by the caller (see env.ts); nothing here reaches the browser.
 */

/**
 * Maximum age of a rendered form, in milliseconds (matches the database's
 * version window). There is deliberately no minimum: completion time never
 * decides alone whether a valid submission is refused.
 */
export const MAX_TOKEN_AGE_MS = 24 * 60 * 60 * 1000;

function subkey(secret: string, purpose: string): Buffer {
  return createHmac("sha256", secret).update(purpose).digest();
}

function signature(secret: string, payload: string): string {
  return createHmac("sha256", subkey(secret, "public-form-token"))
    .update(payload)
    .digest("base64url");
}

/**
 * Binds a rendered form to its link, version and render time, so the
 * version and its age cannot be forged by the client.
 */
export function signRenderToken(
  secret: string,
  input: { key: string; versionId: string; issuedAt: number },
): string {
  const payload = `${input.key}.${input.versionId}.${input.issuedAt}`;
  return `${input.issuedAt}.${signature(secret, payload)}`;
}

export type TokenCheck = "ok" | "invalid" | "expired";

export function verifyRenderToken(
  secret: string,
  token: unknown,
  expected: { key: string; versionId: string },
  now: number,
): TokenCheck {
  if (typeof token !== "string") return "invalid";
  const match = /^(\d{10,16})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return "invalid";
  const issuedAt = Number(match[1]);
  const given = Buffer.from(match[2] ?? "");
  const wanted = Buffer.from(
    signature(secret, `${expected.key}.${expected.versionId}.${issuedAt}`),
  );
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return "invalid";
  }
  const age = now - issuedAt;
  if (age < 0 || age > MAX_TOKEN_AGE_MS) return "expired";
  return "ok";
}

/**
 * A stable, non-reversible client identifier for rate limiting: an HMAC of
 * the client address. The address itself is never stored.
 */
export function clientFingerprint(
  secret: string,
  clientAddress: string,
): string {
  return createHmac("sha256", subkey(secret, "public-form-client"))
    .update(clientAddress)
    .digest("hex");
}

/**
 * PUBLIC_FORMS_TRUSTED_PROXY_HOPS: how many trusted proxies append to
 * X-Forwarded-For (1–5). Anything else means no trusted client address.
 */
export function parseTrustedProxyHops(
  value: string | undefined,
): number | null {
  const trimmed = value?.trim() ?? "";
  return /^[1-5]$/.test(trimmed) ? Number(trimmed) : null;
}

/**
 * The client address recorded by the trusted proxies, or null.
 *
 * Each trusted proxy appends the address it received the request from, so
 * the client is the entry `hops` places from the right; entries further left
 * were supplied by the client and are ignored. A platform that replaces the
 * header with the connecting address (one entry) is `hops = 1`. Without
 * configuration, or with fewer entries than expected, nothing is trusted.
 * X-Real-IP is never used: it is only trustworthy if a proxy sets it.
 */
export function trustedClientAddress(
  headers: { get(name: string): string | null },
  hops: number | null,
): string | null {
  if (hops === null) return null;
  const entries = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length < hops) return null;
  const address = entries[entries.length - hops] ?? "";
  return isIP(address) ? address : null;
}
