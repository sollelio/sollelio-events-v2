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
  | "passwordTooLong";

export type CredentialsResult =
  | { ok: true; email: string; password: string }
  | {
      ok: false;
      email: string;
      fieldErrors: { email?: FieldErrorKey; password?: FieldErrorKey };
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
  const fieldErrors: { email?: FieldErrorKey; password?: FieldErrorKey } = {};

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

  if (fieldErrors.email || fieldErrors.password) {
    return { ok: false, email, fieldErrors };
  }
  return { ok: true, email, password };
}
