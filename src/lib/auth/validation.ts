/**
 * Server-side validation of credential forms. The browser's own constraints
 * are a convenience; these checks are authoritative. Supabase Auth applies
 * its own password policy on top.
 */

export type FieldErrorKey =
  | "emailRequired"
  | "emailInvalid"
  | "passwordRequired"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordMismatch";

type CredentialFieldErrors = {
  email?: FieldErrorKey;
  password?: FieldErrorKey;
  confirmPassword?: FieldErrorKey;
};

export type CredentialsResult =
  | { ok: true; email: string; password: string }
  | {
      ok: false;
      email: string;
      fieldErrors: CredentialFieldErrors;
    };

export const PASSWORD_MIN_LENGTH = 8;
/** Supabase Auth hashes passwords with bcrypt, which reads at most 72 bytes. */
export const PASSWORD_MAX_BYTES = 72;
const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export function parseCredentials(
  form: FormData,
  mode: "sign-in" | "sign-up",
): CredentialsResult {
  const email = text(form.get("email")).trim();
  const password = text(form.get("password"));
  const fieldErrors: CredentialFieldErrors = {};

  if (email === "") fieldErrors.email = "emailRequired";
  else if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    fieldErrors.email = "emailInvalid";
  }

  if (password === "") fieldErrors.password = "passwordRequired";
  else if (mode === "sign-up") {
    if (password.length < PASSWORD_MIN_LENGTH) {
      fieldErrors.password = "passwordTooShort";
    } else if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
      fieldErrors.password = "passwordTooLong";
    }
  }

  // Sign-up only: the confirmation must match, checked once the password
  // itself is valid so the person fixes one problem at a time.
  if (mode === "sign-up" && !fieldErrors.password) {
    const confirm = text(form.get("confirmPassword"));
    if (confirm !== password) fieldErrors.confirmPassword = "passwordMismatch";
  }

  if (fieldErrors.email || fieldErrors.password || fieldErrors.confirmPassword) {
    return { ok: false, email, fieldErrors };
  }
  return { ok: true, email, password };
}