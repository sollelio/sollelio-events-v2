"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  submitPublicFormAction,
  type PublicFormState,
} from "@/lib/public-forms/actions";
import {
  answerFieldName,
  HONEYPOT_FIELD,
  HONEYPOT_OFF_FIELD,
  type PublicForm as PublicFormDefinition,
  type PublicQuestion,
} from "@/lib/public-forms/form";
import type { Messages } from "@/messages";

const label = "text-sm font-medium text-foreground";
const hint = "text-xs text-muted-foreground";
const fieldError = "text-xs font-medium text-destructive";

/** Contact questions are individually optional but one is required. */
function isContact(question: PublicQuestion) {
  return (
    question.binding === "requester_email" ||
    question.binding === "requester_phone"
  );
}

/**
 * A published form version, rendered for a client. The key, version, a
 * request id and a signed render token travel as hidden fields; the server
 * checks all of them.
 */
export function PublicForm({
  form,
  publicKey,
  requestId,
  token,
  copy,
}: {
  form: PublicFormDefinition;
  publicKey: string;
  requestId: string;
  token: string;
  copy: Messages["publicForm"];
}) {
  const [state, action, pending] = useActionState(submitPublicFormAction, {
    echoed: {},
  } satisfies PublicFormState);
  const messageRef = useRef<HTMLDivElement>(null);
  const errors = state.fieldErrors ?? {};

  // Move focus to the first problem after a failed submission.
  useEffect(() => {
    const first = form.questions.find((q) => state.fieldErrors?.[q.id]);
    if (first) document.getElementById(`q-${first.id}`)?.focus();
    else if (state.formError) messageRef.current?.focus();
  }, [state, form.questions]);

  return (
    <form action={action} noValidate className="grid gap-6">
      <header>
        <h1 className="type-title text-foreground">{form.title}</h1>
        {form.intro ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{form.intro}</p>
        ) : null}
      </header>

      {state.formError ? (
        <FormMessage tone="error" messageRef={messageRef}>
          {copy.formErrors[state.formError]}
        </FormMessage>
      ) : null}

      <input type="hidden" name="key" value={publicKey} />
      <input type="hidden" name="formVersionId" value={form.formVersionId} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="token" value={state.token ?? token} />

      {/* Honeypot: hidden from people and assistive technology. Removed
          once it has been filled, so autofill cannot trip it twice. */}
      {state.honeypotOff ? (
        <input type="hidden" name={HONEYPOT_OFF_FIELD} value="1" />
      ) : (
        <div
          aria-hidden
          className="absolute -left-[10000px] h-px w-px overflow-hidden"
        >
          <label>
            Não preencher
            <input
              type="text"
              name={HONEYPOT_FIELD}
              tabIndex={-1}
              autoComplete="off"
              data-1p-ignore=""
              data-lpignore="true"
              data-bwignore=""
              data-form-type="other"
            />
          </label>
        </div>
      )}

      {form.questions.map((question) => (
        <Question
          key={question.id}
          question={question}
          echoed={state.echoed[question.id]}
          error={
            errors[question.id]
              ? copy.answerErrors[errors[question.id]!]
              : undefined
          }
          copy={copy}
        />
      ))}

      <p className="border-t border-border pt-5 text-xs text-muted-foreground">
        {copy.privacy.replace("{organization}", form.organizationName)}
      </p>

      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <>
            <LoaderCircle aria-hidden className="animate-spin" />
            {copy.pending}
          </>
        ) : (
          copy.submit
        )}
      </Button>
    </form>
  );
}

function Question({
  question,
  echoed,
  error,
  copy,
}: {
  question: PublicQuestion;
  echoed: string | string[] | undefined;
  error: string | undefined;
  copy: Messages["publicForm"];
}) {
  const id = `q-${question.id}`;
  const name = answerFieldName(question);
  const describedBy =
    [error ? `${id}-error` : null, question.helpText ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  const marker = question.required ? null : isContact(question) ? null : (
    <span className="font-normal text-muted-foreground">
      {" "}
      ({copy.optional})
    </span>
  );
  const text = typeof echoed === "string" ? echoed : "";
  const chosen = Array.isArray(echoed)
    ? echoed
    : typeof echoed === "string"
      ? [echoed]
      : [];

  const footer = (
    <>
      {question.helpText ? (
        <p id={`${id}-hint`} className={hint}>
          {question.helpText}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={fieldError}>
          {error}
        </p>
      ) : null}
    </>
  );

  if (
    question.kind === "single_choice" ||
    question.kind === "multiple_choice"
  ) {
    const multiple = question.kind === "multiple_choice";
    return (
      <fieldset aria-describedby={describedBy} className="grid gap-2">
        <legend className={`${label} mb-1`}>
          {question.label}
          {marker}
        </legend>
        {(question.options ?? []).map((option, index) => (
          <label
            key={option.key}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm text-foreground has-[:checked]:border-primary"
          >
            <input
              id={index === 0 ? id : undefined}
              type={multiple ? "checkbox" : "radio"}
              name={name}
              value={option.key}
              defaultChecked={chosen.includes(option.key)}
              aria-invalid={error ? true : undefined}
              className="size-4 accent-primary"
            />
            {option.label}
          </label>
        ))}
        {footer}
      </fieldset>
    );
  }

  const common = {
    id,
    name,
    defaultValue: text,
    required: question.required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  } as const;

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className={label}>
        {question.label}
        {marker}
      </label>
      {question.kind === "long_text" ? (
        <Textarea {...common} rows={6} maxLength={5000} />
      ) : question.kind === "number" ? (
        <Input {...common} inputMode="decimal" autoComplete="off" />
      ) : question.kind === "date" ? (
        <Input {...common} type="date" />
      ) : question.binding === "requester_email" ? (
        <Input
          {...common}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
        />
      ) : question.binding === "requester_phone" ? (
        <Input {...common} type="tel" inputMode="tel" autoComplete="tel" />
      ) : (
        <Input
          {...common}
          maxLength={2000}
          autoComplete={question.binding === "requester_name" ? "name" : "off"}
        />
      )}
      {footer}
    </div>
  );
}
