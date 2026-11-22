"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getPublicFormsEnv } from "./env";
import {
  buildAnswers,
  checkAnswers,
  HONEYPOT_FIELD,
  HONEYPOT_OFF_FIELD,
  PUBLIC_KEY_PATTERN,
  publicFormErrorKey,
  type AnswerErrorKey,
  type EchoedValues,
  type PublicFormErrorKey,
} from "./form";
import { issueRenderToken, loadPublicForm, submitPublicForm } from "./server";
import {
  clientFingerprint,
  trustedClientAddress,
  verifyRenderToken,
} from "./token";

export type PublicFormState = {
  echoed: EchoedValues;
  fieldErrors?: Record<string, AnswerErrorKey>;
  formError?: PublicFormErrorKey;
  /** A fresh render token after an expired or invalid one. */
  token?: string;
  /** The hidden field was filled (often by autofill); it stays disabled. */
  honeypotOff?: boolean;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * The only way to submit a public form. Checks run here before the database
 * call (as the server-only role), which validates everything again.
 */
export async function submitPublicFormAction(
  _previous: PublicFormState,
  form: FormData,
): Promise<PublicFormState> {
  const honeypotOff = text(form, HONEYPOT_OFF_FIELD) === "1";
  const state = await evaluate(form, honeypotOff);
  return honeypotOff ? { ...state, honeypotOff } : state;
}

async function evaluate(
  form: FormData,
  honeypotOff: boolean,
): Promise<PublicFormState> {
  const key = text(form, "key");
  const formVersionId = text(form, "formVersionId");
  const requestId = text(form, "requestId");
  const { answers, echoed } = buildAnswers(form);
  const env = getPublicFormsEnv();

  if (
    !env ||
    !PUBLIC_KEY_PATTERN.test(key) ||
    !UUID_PATTERN.test(formVersionId) ||
    !UUID_PATTERN.test(requestId)
  ) {
    return { echoed, formError: "unavailable" };
  }

  // A filled hidden field is a weak bot signal and may be autofill: nothing
  // is sent, the answers stay and the person confirms with one more click.
  if (!honeypotOff && text(form, HONEYPOT_FIELD) !== "") {
    return { echoed, formError: "confirm", honeypotOff: true };
  }

  const token = verifyRenderToken(
    env.signingSecret,
    form.get("token"),
    { key, versionId: formVersionId },
    Date.now(),
  );
  const current = await loadPublicForm(key);
  if (!current) return { echoed, formError: "unavailable" };

  // An expired or invalid token: keep the answers and issue a fresh token if
  // the version shown is still current; otherwise ask for a reload.
  if (token === "invalid" || token === "expired") {
    if (current.formVersionId !== formVersionId) {
      return { echoed, formError: "versionChanged" };
    }
    const fresh = issueRenderToken(key, formVersionId);
    return fresh
      ? { echoed, formError: "expired", token: fresh }
      : { echoed, formError: "unavailable" };
  }

  // Field errors for the version that was shown, when it is still current.
  if (current.formVersionId === formVersionId) {
    const fieldErrors = checkAnswers(current.questions, answers);
    if (Object.keys(fieldErrors).length > 0) return { echoed, fieldErrors };
  }

  // Per-client limits only with a trusted address (ADR 0009); otherwise the
  // database applies the per-link limits alone.
  const address = trustedClientAddress(await headers(), env.trustedProxyHops);
  const result = await submitPublicForm({
    key,
    formVersionId,
    requestId,
    fingerprint: address ? clientFingerprint(env.signingSecret, address) : null,
    answers,
  });
  if (!result.ok) return { echoed, formError: publicFormErrorKey(result.code) };

  redirect(`/f/${key}/sent`);
}
