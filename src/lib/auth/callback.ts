/**
 * Parses the query string Supabase Auth sends to /auth/callback after an
 * email confirmation link is opened.
 *
 * - `code`: PKCE flow (the default confirmation email). Exchanging it needs
 *   the code verifier cookie, so it only completes in the browser that signed
 *   up; the email address is confirmed by Supabase either way.
 * - `token_hash` + `type`: an email template that links straight to the app.
 *   Only confirmation types are accepted; recovery is not implemented.
 * - `error` / `error_code`: Supabase reports a failed or expired link.
 */

export type CallbackParams =
  | { kind: "code"; code: string }
  | { kind: "token_hash"; tokenHash: string; type: "email" | "signup" }
  | { kind: "error"; reason: "expired" | "failed" }
  | { kind: "invalid" };

const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{1,512}$/;
const CONFIRMATION_TYPES = new Set(["email", "signup"]);

export function parseCallbackParams(params: URLSearchParams): CallbackParams {
  if (params.has("error") || params.has("error_code")) {
    return {
      kind: "error",
      reason: params.get("error_code") === "otp_expired" ? "expired" : "failed",
    };
  }

  const code = params.get("code");
  if (code !== null) {
    return TOKEN_PATTERN.test(code)
      ? { kind: "code", code }
      : { kind: "invalid" };
  }

  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (tokenHash !== null || type !== null) {
    if (
      tokenHash !== null &&
      TOKEN_PATTERN.test(tokenHash) &&
      type !== null &&
      CONFIRMATION_TYPES.has(type)
    ) {
      return {
        kind: "token_hash",
        tokenHash,
        type: type as "email" | "signup",
      };
    }
    return { kind: "invalid" };
  }

  return { kind: "invalid" };
}
