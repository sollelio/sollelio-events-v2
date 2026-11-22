/**
 * Public forms (ADR 0009): the shape returned by `get_public_form`, typed
 * answers built from a posted form, and checks for helpful field errors.
 * The database validates everything again; this module only decides what
 * to tell the person filling in the form. Free of framework imports.
 */

export const QUESTION_KINDS = [
  "short_text",
  "long_text",
  "number",
  "date",
  "single_choice",
  "multiple_choice",
] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

export type QuestionBinding =
  | "requester_name"
  | "requester_email"
  | "requester_phone"
  | "client_message"
  | "requested_event_date"
  | "estimated_guests";

export type PublicQuestion = {
  id: string;
  position: number;
  kind: QuestionKind;
  label: string;
  helpText: string | null;
  required: boolean;
  options: { key: string; label: string }[] | null;
  binding: QuestionBinding | null;
};

export type PublicForm = {
  organizationName: string;
  formVersionId: string;
  title: string;
  intro: string | null;
  questions: PublicQuestion[];
};

export const PUBLIC_KEY_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/**
 * Visually hidden field that people never fill in (ADR 0009). The name and
 * label avoid words that browser or password-manager autofill recognises.
 */
export const HONEYPOT_FIELD = "sf_hp_field";

/** Sent once the hidden field has been disabled after being filled. */
export const HONEYPOT_OFF_FIELD = "sf_hp_off";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Posted field name for a question; the kind lets the server type it. */
export function answerFieldName(question: { id: string; kind: QuestionKind }) {
  return `answer:${question.kind}:${question.id}`;
}

function isQuestionKind(value: string): value is QuestionKind {
  return QUESTION_KINDS.some((kind) => kind === value);
}

function trimmed(value: string): string {
  return value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
}

/** A real calendar date. */
function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

export type AnswerValue = string | number | string[];

/** Values to show again after an error (exactly as typed). */
export type EchoedValues = Record<string, string | string[]>;

/**
 * Typed answers keyed by question id, as `submit_public_form` expects.
 * Empty answers are left out; a non-numeric number is kept as text so the
 * database (and the field check below) can reject it.
 */
export function buildAnswers(form: FormData): {
  answers: Record<string, AnswerValue>;
  echoed: EchoedValues;
} {
  const answers: Record<string, AnswerValue> = {};
  const echoed: EchoedValues = {};
  const seen = new Set<string>();

  for (const name of form.keys()) {
    if (seen.has(name)) continue;
    seen.add(name);
    const match = /^answer:([a-z_]+):([0-9a-f-]{36})$/.exec(name);
    if (
      !match ||
      !isQuestionKind(match[1] ?? "") ||
      !UUID_PATTERN.test(match[2] ?? "")
    ) {
      continue;
    }
    const kind = match[1] as QuestionKind;
    const id = match[2] as string;
    const values = form
      .getAll(name)
      .filter((value): value is string => typeof value === "string");

    if (kind === "multiple_choice") {
      echoed[id] = values;
      const choices = [...new Set(values)];
      if (choices.length > 0) answers[id] = choices;
      continue;
    }

    const raw = values[0] ?? "";
    echoed[id] = raw;
    const value = trimmed(raw);
    if (value === "") continue;
    if (kind === "number") {
      const normalised = value.replace(",", ".");
      const number = Number(normalised);
      answers[id] =
        /^-?\d+(\.\d+)?$/.test(normalised) && Number.isFinite(number)
          ? number
          : value;
    } else {
      answers[id] = value;
    }
  }
  return { answers, echoed };
}

export type AnswerErrorKey =
  | "required"
  | "contactRequired"
  | "email"
  | "phone"
  | "number"
  | "wholeNumber"
  | "date"
  | "choice"
  | "singleLine"
  | "tooLong";

/**
 * Field errors for the current version, mirroring the database rules, so
 * the person sees what to fix. Returns an empty object when nothing is
 * wrong.
 */
export function checkAnswers(
  questions: PublicQuestion[],
  answers: Record<string, AnswerValue>,
): Record<string, AnswerErrorKey> {
  const errors: Record<string, AnswerErrorKey> = {};

  for (const question of questions) {
    const value = answers[question.id];
    if (value === undefined) {
      if (question.required) errors[question.id] = "required";
      continue;
    }
    switch (question.kind) {
      case "short_text":
      case "long_text": {
        const text = String(value);
        const limit = question.kind === "short_text" ? 2000 : 5000;
        if (text.length > limit) errors[question.id] = "tooLong";
        else if (question.kind === "short_text" && /[\r\n]/.test(text)) {
          errors[question.id] = "singleLine";
        } else if (
          question.binding === "requester_email" &&
          (text.length > 320 || !EMAIL_PATTERN.test(text))
        ) {
          errors[question.id] = "email";
        } else if (
          question.binding === "requester_phone" &&
          (text.length > 40 || !/\d/.test(text))
        ) {
          errors[question.id] = "phone";
        } else if (question.binding === "requester_name" && text.length > 200) {
          errors[question.id] = "tooLong";
        }
        break;
      }
      case "number":
        if (typeof value !== "number") errors[question.id] = "number";
        else if (
          question.binding === "estimated_guests" &&
          (!Number.isInteger(value) || value < 1 || value > 100000)
        ) {
          errors[question.id] = "wholeNumber";
        }
        break;
      case "date": {
        const text = String(value);
        const year = Number(text.slice(0, 4));
        const [min, max] =
          question.binding === "requested_event_date"
            ? [2000, 2100]
            : [1900, 2200];
        if (!isRealDate(text) || year < min || year > max) {
          errors[question.id] = "date";
        }
        break;
      }
      case "single_choice":
        if (
          typeof value !== "string" ||
          !question.options?.some((option) => option.key === value)
        ) {
          errors[question.id] = "choice";
        }
        break;
      case "multiple_choice":
        if (
          !Array.isArray(value) ||
          value.some((key) => !question.options?.some((o) => o.key === key))
        ) {
          errors[question.id] = "choice";
        }
        break;
    }
  }

  // Inquiry forms: at least one of email or phone.
  const contact = questions.filter(
    (q) => q.binding === "requester_email" || q.binding === "requester_phone",
  );
  if (contact.length > 0 && contact.every((q) => answers[q.id] === undefined)) {
    for (const q of contact) errors[q.id] ??= "contactRequired";
  }
  return errors;
}

export type PublicFormErrorKey =
  | "unavailable"
  | "versionChanged"
  | "rateLimited"
  | "invalid"
  | "expired"
  | "confirm";

/** SQLSTATEs of the public functions (ADR 0009). */
export function publicFormErrorKey(
  code: string | undefined,
): PublicFormErrorKey {
  switch (code) {
    case "SF002":
      return "versionChanged";
    case "SF003":
      return "rateLimited";
    case "22023":
    case "23505":
      return "invalid";
    default:
      // SF001, 42501 (server misconfiguration), network or unknown.
      return "unavailable";
  }
}

/** Parses the jsonb returned by get_public_form, defensively. */
export function parsePublicForm(value: unknown): PublicForm | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.organizationName !== "string" ||
    typeof v.formVersionId !== "string" ||
    typeof v.title !== "string" ||
    !Array.isArray(v.questions)
  ) {
    return null;
  }
  const questions: PublicQuestion[] = [];
  for (const raw of v.questions as Record<string, unknown>[]) {
    if (
      typeof raw.id !== "string" ||
      typeof raw.label !== "string" ||
      typeof raw.kind !== "string" ||
      !isQuestionKind(raw.kind)
    ) {
      return null;
    }
    questions.push({
      id: raw.id,
      position: Number(raw.position),
      kind: raw.kind,
      label: raw.label,
      helpText: typeof raw.helpText === "string" ? raw.helpText : null,
      required: raw.required === true,
      options: Array.isArray(raw.options)
        ? (raw.options as { key: string; label: string }[])
        : null,
      binding: (raw.binding as QuestionBinding | null) ?? null,
    });
  }
  return {
    organizationName: v.organizationName,
    formVersionId: v.formVersionId,
    title: v.title,
    intro: typeof v.intro === "string" ? v.intro : null,
    questions,
  };
}
