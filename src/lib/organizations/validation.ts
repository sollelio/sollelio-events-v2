import { isCountryCode, type CountryCode } from "./countries.ts";

/**
 * Server-side validation of the organization form. It mirrors
 * `public.create_organization()`, which stays authoritative: name trimmed,
 * 1–120 characters; country an ISO 3166-1 alpha-2 code; a request id.
 */

export type OrganizationFieldErrorKey =
  | "nameRequired"
  | "nameTooLong"
  | "nameInvalid"
  | "countryRequired"
  | "countryInvalid";

export type OrganizationFieldErrors = {
  name?: OrganizationFieldErrorKey;
  country?: OrganizationFieldErrorKey;
};

export type OrganizationInput =
  | {
      ok: true;
      name: string;
      countryCode: CountryCode;
      requestId: string | undefined;
    }
  | {
      ok: false;
      name: string;
      countryCode: string;
      requestId: string | undefined;
      fieldErrors: OrganizationFieldErrors;
    };

/** Matches the database limit, which counts characters (code points). */
export const ORGANIZATION_NAME_MAX_LENGTH = 120;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/** A well-formed idempotency key, or undefined. */
export function parseRequestId(value: unknown): string | undefined {
  return typeof value === "string" && UUID_PATTERN.test(value)
    ? value.toLowerCase()
    : undefined;
}

export function parseOrganizationForm(form: FormData): OrganizationInput {
  const name = text(form.get("name")).normalize("NFC").trim();
  const countryCode = text(form.get("country")).trim().toUpperCase();
  const requestId = parseRequestId(form.get("requestId"));
  const fieldErrors: OrganizationFieldErrors = {};

  if (name === "") fieldErrors.name = "nameRequired";
  else if (Array.from(name).length > ORGANIZATION_NAME_MAX_LENGTH) {
    fieldErrors.name = "nameTooLong";
  } else if (CONTROL_CHARACTERS.test(name)) {
    fieldErrors.name = "nameInvalid";
  }

  if (countryCode === "") fieldErrors.country = "countryRequired";
  else if (!isCountryCode(countryCode)) fieldErrors.country = "countryInvalid";

  if (fieldErrors.name || fieldErrors.country || !isCountryCode(countryCode)) {
    return { ok: false, name, countryCode, requestId, fieldErrors };
  }
  return { ok: true, name, countryCode, requestId };
}
