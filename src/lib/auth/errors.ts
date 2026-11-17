/**
 * Maps Supabase Auth errors to message keys. Users never see raw Auth error
 * text, and responses do not reveal whether an email address has an account.
 */

export type FormErrorKey =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "weakPassword"
  | "emailInvalid"
  | "rateLimited"
  | "signUpUnavailable"
  | "generic";

type AuthErrorLike = { code?: string | undefined; status?: number | undefined };

function isRateLimit(error: AuthErrorLike): boolean {
  return (
    error.status === 429 ||
    error.code === "over_request_rate_limit" ||
    error.code === "over_email_send_rate_limit"
  );
}

export function signInErrorKey(error: AuthErrorLike): FormErrorKey {
  if (isRateLimit(error)) return "rateLimited";
  switch (error.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    default:
      return "generic";
  }
}

/**
 * "accepted" means: show the check-your-email screen. An already registered
 * address is reported exactly like a new one, so sign-up cannot be used to
 * discover accounts.
 */
export function signUpOutcome(error: AuthErrorLike): FormErrorKey | "accepted" {
  if (isRateLimit(error)) return "rateLimited";
  switch (error.code) {
    case "user_already_exists":
    case "email_exists":
      return "accepted";
    case "weak_password":
      return "weakPassword";
    case "email_address_invalid":
      return "emailInvalid";
    case "signup_disabled":
    case "email_provider_disabled":
      return "signUpUnavailable";
    default:
      return "generic";
  }
}
