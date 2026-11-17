import type { MembershipRole } from "../organizations/active-organization.ts";
import { parseRequestId } from "../organizations/validation.ts";

/**
 * Inquiries (ADR 0008): the original intake of a client request, kept as
 * given. Free of framework and Supabase imports so it can be tested directly;
 * the database (migration 20261117190000) enforces the same rules again.
 */

export const INQUIRY_SOURCES = [
  "phone",
  "whatsapp",
  "email",
  "social_media",
  "in_person",
  "website",
  "referral",
  "other",
] as const;
export type InquirySource = (typeof INQUIRY_SOURCES)[number];

export const CLOSE_REASONS = [
  "spam",
  "duplicate",
  "not_pursued",
  "registered_in_error",
] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

export type InquiryStatus = "open" | "closed";

export function isInquirySource(value: unknown): value is InquirySource {
  return INQUIRY_SOURCES.some((source) => source === value);
}

export function isCloseReason(value: unknown): value is CloseReason {
  return CLOSE_REASONS.some((reason) => reason === value);
}

/** Owners and Managers; Members need a future assignment mechanism. */
export function canAccessInquiries(role: MembershipRole): boolean {
  return role === "owner" || role === "manager";
}

// ---------------------------------------------------------------------------
// Limits (same as the database)
// ---------------------------------------------------------------------------

export const CLIENT_MESSAGE_MAX = 10000;
export const STAFF_SUMMARY_MAX = 5000;
const NAME_MAX = 200;
const PHONE_MAX = 40;
const EMAIL_MAX = 320;
const GUESTS_MAX = 100000;
const EARLIEST_RECEIVED = Date.UTC(2000, 0, 1);
/** Allowed clock difference between the device and the server. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

// ---------------------------------------------------------------------------
// Time: instants in UTC, event dates date-only (ADR 0008)
// ---------------------------------------------------------------------------

function offsetMinutes(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - instant) / 60000);
}

/**
 * The UTC instant of a wall-clock time ("YYYY-MM-DDTHH:mm") in an IANA time
 * zone, or undefined. Within the hour of a DST change, a skipped time
 * resolves forward and a repeated time to its later occurrence.
 */
export function zonedLocalToUtc(
  local: string,
  timeZone: string,
): Date | undefined {
  const match = LOCAL_DATE_TIME_PATTERN.exec(local);
  if (!match) return undefined;
  const [, y, mo, d, h, mi] = match.map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(wall);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== mo - 1 ||
    check.getUTCDate() !== d ||
    h > 23 ||
    mi > 59
  ) {
    return undefined;
  }
  try {
    const first = wall - offsetMinutes(wall, timeZone) * 60000;
    return new Date(wall - offsetMinutes(first, timeZone) * 60000);
  } catch {
    return undefined; // Unknown time zone.
  }
}

/** A real calendar date "YYYY-MM-DD" between 2000 and 2100. */
export function parseEventDate(value: string): string | undefined {
  const match = DATE_PATTERN.exec(value);
  if (!match) return undefined;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const real =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d;
  return real && y >= 2000 && y <= 2100 ? value : undefined;
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export type InquiryFieldErrorKey =
  | "sourceRequired"
  | "descriptionRequired"
  | "clientMessageTooLong"
  | "staffSummaryTooLong"
  | "receivedRequired"
  | "receivedInvalid"
  | "receivedInFuture"
  | "receivedTimeZoneMissing"
  | "nameTooLong"
  | "phoneInvalid"
  | "emailInvalid"
  | "eventDateInvalid"
  | "guestsInvalid";

export type InquiryField =
  | "source"
  | "description"
  | "clientMessage"
  | "staffSummary"
  | "received"
  | "requesterName"
  | "requesterPhone"
  | "requesterEmail"
  | "eventDate"
  | "guests";

export type InquiryFieldErrors = Partial<
  Record<InquiryField, InquiryFieldErrorKey>
>;

/** Values echoed back to the form after an error (never transformed). */
export type InquiryFormValues = {
  source: string;
  clientMessage: string;
  staffSummary: string;
  receivedMode: "now" | "other";
  receivedLocal: string;
  requesterName: string;
  requesterPhone: string;
  requesterEmail: string;
  eventDate: string;
  guests: string;
};

export type CreateInquiryArgs = {
  p_organization_id: string;
  p_request_id: string;
  p_source: InquirySource;
  p_client_message: string | null;
  p_staff_summary: string | null;
  p_received_at: string | null;
  p_requester_name: string | null;
  p_requester_phone: string | null;
  p_requester_email: string | null;
  p_requested_event_date: string | null;
  p_estimated_guests: number | null;
};

export type ParsedInquiry =
  | {
      ok: true;
      values: InquiryFormValues;
      requestId: string | undefined;
      args: Omit<CreateInquiryArgs, "p_organization_id" | "p_request_id">;
    }
  | {
      ok: false;
      values: InquiryFormValues;
      requestId: string | undefined;
      fieldErrors: InquiryFieldErrors;
    };

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Outer blank lines and spaces go; the message itself is kept as written. */
function description(value: string): string | null {
  const trimmed = value.replace(/^\s+|\s+$/g, "");
  return trimmed === "" ? null : trimmed;
}

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function parseInquiryForm(form: FormData, now: Date): ParsedInquiry {
  const values: InquiryFormValues = {
    source: text(form, "source"),
    clientMessage: text(form, "clientMessage"),
    staffSummary: text(form, "staffSummary"),
    receivedMode: text(form, "receivedMode") === "other" ? "other" : "now",
    receivedLocal: text(form, "receivedLocal"),
    requesterName: text(form, "requesterName"),
    requesterPhone: text(form, "requesterPhone"),
    requesterEmail: text(form, "requesterEmail"),
    eventDate: text(form, "eventDate"),
    guests: text(form, "guests"),
  };
  const requestId = parseRequestId(form.get("requestId"));
  const errors: InquiryFieldErrors = {};

  const source = isInquirySource(values.source) ? values.source : undefined;
  if (!source) errors.source = "sourceRequired";

  const clientMessage = description(values.clientMessage);
  const staffSummary = description(values.staffSummary);
  if (!clientMessage && !staffSummary) {
    errors.description = "descriptionRequired";
  }
  if (clientMessage && clientMessage.length > CLIENT_MESSAGE_MAX) {
    errors.clientMessage = "clientMessageTooLong";
  }
  if (staffSummary && staffSummary.length > STAFF_SUMMARY_MAX) {
    errors.staffSummary = "staffSummaryTooLong";
  }

  // "Now" is stamped by the database at registration (and kept on retries).
  let receivedAt: string | null = null;
  if (values.receivedMode === "other") {
    const timeZone = text(form, "timeZone");
    if (values.receivedLocal === "") errors.received = "receivedRequired";
    else if (timeZone === "") errors.received = "receivedTimeZoneMissing";
    else {
      const instant = zonedLocalToUtc(values.receivedLocal, timeZone);
      if (!instant || instant.getTime() < EARLIEST_RECEIVED) {
        errors.received = "receivedInvalid";
      } else if (instant.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
        errors.received = "receivedInFuture";
      } else {
        receivedAt = instant.toISOString();
      }
    }
  }

  const requesterName = optional(values.requesterName);
  if (requesterName && requesterName.length > NAME_MAX) {
    errors.requesterName = "nameTooLong";
  }
  const requesterPhone = optional(values.requesterPhone);
  if (
    requesterPhone &&
    (requesterPhone.length > PHONE_MAX || !/\d/.test(requesterPhone))
  ) {
    errors.requesterPhone = "phoneInvalid";
  }
  const requesterEmail = optional(values.requesterEmail);
  if (
    requesterEmail &&
    (requesterEmail.length > EMAIL_MAX || !EMAIL_PATTERN.test(requesterEmail))
  ) {
    errors.requesterEmail = "emailInvalid";
  }

  const eventDateText = optional(values.eventDate);
  const eventDate = eventDateText ? parseEventDate(eventDateText) : undefined;
  if (eventDateText && !eventDate) errors.eventDate = "eventDateInvalid";

  const guestsText = optional(values.guests);
  const guests = guestsText !== null ? Number(guestsText) : null;
  if (
    guestsText !== null &&
    (!/^\d+$/.test(guestsText) ||
      guests === null ||
      guests < 1 ||
      guests > GUESTS_MAX)
  ) {
    errors.guests = "guestsInvalid";
  }

  if (Object.keys(errors).length > 0 || !source) {
    return { ok: false, values, requestId, fieldErrors: errors };
  }
  return {
    ok: true,
    values,
    requestId,
    args: {
      p_source: source,
      p_client_message: clientMessage,
      p_staff_summary: staffSummary,
      p_received_at: receivedAt,
      p_requester_name: requesterName,
      p_requester_phone: requesterPhone,
      p_requester_email: requesterEmail,
      p_requested_event_date: eventDate ?? null,
      p_estimated_guests: guestsText !== null ? guests : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Submission (idempotent; the Server Function supplies the dependencies)
// ---------------------------------------------------------------------------

export type InquiryFormErrorKey =
  "unavailable" | "notAllowed" | "invalid" | "requestReused" | "generic";

export type InquiryFormState = {
  requestId: string;
  values: InquiryFormValues;
  fieldErrors?: InquiryFieldErrors;
  formError?: InquiryFormErrorKey;
};

export type RpcResult<T> =
  { ok: true; data: T } | { ok: false; code: string | undefined };

/** SQLSTATEs of the inquiry functions (ADR 0008); unknown → retryable. */
export function inquiryErrorKey(
  code: string | undefined,
): Exclude<InquiryFormErrorKey, "generic"> {
  if (code === "42501" || code?.startsWith("PGRST3")) return "notAllowed";
  if (code === "22023") return "invalid";
  if (code === "23505") return "requestReused";
  return "unavailable";
}

export type SubmitInquiryOutcome =
  | { kind: "created"; inquiryId: string }
  | { kind: "form"; state: InquiryFormState };

/**
 * Validates and registers an inquiry in the (server-resolved) organization.
 * The request id issued with the form is reused by every retry, so a double
 * submission or a retry after a lost response returns the same inquiry.
 */
export async function submitInquiry(
  form: FormData,
  deps: {
    organizationId: string;
    now: Date;
    createInquiry: (args: CreateInquiryArgs) => Promise<RpcResult<string>>;
    newRequestId: () => string;
  },
): Promise<SubmitInquiryOutcome> {
  const parsed = parseInquiryForm(form, deps.now);
  const requestId = parsed.requestId ?? deps.newRequestId();

  if (!parsed.ok) {
    return {
      kind: "form",
      state: {
        requestId,
        values: parsed.values,
        fieldErrors: parsed.fieldErrors,
      },
    };
  }
  if (!parsed.requestId) {
    return {
      kind: "form",
      state: { requestId, values: parsed.values, formError: "generic" },
    };
  }

  const result = await deps.createInquiry({
    p_organization_id: deps.organizationId,
    p_request_id: parsed.requestId,
    ...parsed.args,
  });
  if (result.ok) return { kind: "created", inquiryId: result.data };

  const formError = inquiryErrorKey(result.code);
  return {
    kind: "form",
    state: {
      // A reused id can never succeed again; otherwise keep it so a retry
      // stays idempotent.
      requestId:
        formError === "requestReused" ? deps.newRequestId() : requestId,
      values: parsed.values,
      formError,
    },
  };
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

/**
 * A one-paragraph preview: line breaks and runs of spaces collapsed (the first
 * line is often only a greeting), shortened to `max` characters. Display
 * only; the stored text is never changed.
 */
export function snippet(value: string | null, max = 160): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** "YYYY-MM-DD" as a Date at UTC midnight, for date-only formatting. */
export function eventDateAsUtc(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}
