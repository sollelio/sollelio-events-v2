"use client";

import { useActionState, useEffect, useRef, useSyncExternalStore } from "react";
import { LoaderCircle } from "lucide-react";

import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createInquiry } from "@/lib/inquiries/actions";
import {
  CLIENT_MESSAGE_MAX,
  INQUIRY_SOURCES,
  STAFF_SUMMARY_MAX,
  type InquiryField,
  type InquiryFormState,
} from "@/lib/inquiries/inquiry";
import type { Messages } from "@/messages";

import { SourceIcon } from "./source-icon";

const noSubscription = () => () => {};
const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const noTimeZone = () => "";

/** Order in which focus looks for the first problem. */
const FIELD_ORDER: InquiryField[] = [
  "source",
  "description",
  "clientMessage",
  "staffSummary",
  "received",
  "requesterName",
  "requesterPhone",
  "requesterEmail",
  "eventDate",
  "guests",
];
const FOCUS_TARGET: Record<InquiryField, string> = {
  source: "inquiry-source-phone",
  description: "inquiry-client-message",
  clientMessage: "inquiry-client-message",
  staffSummary: "inquiry-staff-summary",
  received: "inquiry-received-local",
  requesterName: "inquiry-requester-name",
  requesterPhone: "inquiry-requester-phone",
  requesterEmail: "inquiry-requester-email",
  eventDate: "inquiry-event-date",
  guests: "inquiry-guests",
};

const EMPTY_VALUES: InquiryFormState["values"] = {
  source: "",
  clientMessage: "",
  staffSummary: "",
  receivedMode: "now",
  receivedLocal: "",
  requesterName: "",
  requesterPhone: "",
  requesterEmail: "",
  eventDate: "",
  guests: "",
};

const legend = "text-sm font-semibold text-foreground";
const hint = "text-xs text-muted-foreground";
const fieldError = "text-xs font-medium text-destructive";

/**
 * Manual inquiry registration. `requestId` is issued by the page and kept in
 * the form state, so every retry sends the same idempotency key.
 */
export function InquiryForm({
  requestId,
  copy,
}: {
  requestId: string;
  copy: Messages["inquiries"];
}) {
  const [state, formAction, pending] = useActionState(createInquiry, {
    requestId,
    values: EMPTY_VALUES,
  } satisfies InquiryFormState);
  const timeZone = useSyncExternalStore(
    noSubscription,
    deviceTimeZone,
    noTimeZone,
  );
  const messageRef = useRef<HTMLDivElement>(null);
  const { values, fieldErrors = {} } = state;
  const t = copy.form;
  const err = (field: InquiryField) =>
    fieldErrors[field] ? copy.fieldErrors[fieldErrors[field]] : undefined;

  // Move focus to the first problem after a failed submission.
  useEffect(() => {
    const first = FIELD_ORDER.find((field) => state.fieldErrors?.[field]);
    if (first) document.getElementById(FOCUS_TARGET[first])?.focus();
    else if (state.formError) messageRef.current?.focus();
  }, [state]);

  const descriptionError = err("description");
  const describedBy = (...ids: (string | false | undefined)[]) =>
    ids.filter(Boolean).join(" ") || undefined;

  return (
    <form action={formAction} noValidate className="grid gap-7">
      {state.formError ? (
        <FormMessage tone="error" messageRef={messageRef}>
          {copy.formErrors[state.formError]}
        </FormMessage>
      ) : null}

      <input type="hidden" name="requestId" value={state.requestId} />
      <input type="hidden" name="timeZone" value={timeZone} />

      {/* Source */}
      <fieldset
        key={`source-${values.source}`}
        aria-describedby={err("source") ? "inquiry-source-error" : undefined}
        className="grid gap-2.5"
      >
        <legend className={`${legend} mb-2.5`}>{t.source}</legend>
        <div className="flex flex-wrap gap-2">
          {INQUIRY_SOURCES.map((source) => (
            <label key={source} className="relative">
              <input
                id={`inquiry-source-${source}`}
                type="radio"
                name="source"
                value={source}
                defaultChecked={values.source === source}
                className="peer sr-only"
              />
              <span className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[13.5px] font-medium text-muted-foreground transition-[color,background-color,border-color] duration-150 ease-standard peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:border-border-strong hover:text-foreground">
                <SourceIcon source={source} className="size-4" />
                {copy.sources[source]}
              </span>
            </label>
          ))}
        </div>
        {err("source") ? (
          <p id="inquiry-source-error" className={fieldError}>
            {err("source")}
          </p>
        ) : null}
      </fieldset>

      {/* Request: verbatim and/or staff summary (at least one) */}
      <fieldset className="grid gap-4">
        <div>
          <legend className={legend}>{t.request}</legend>
          <p
            id="inquiry-request-hint"
            className={descriptionError ? fieldError : `${hint} mt-1`}
          >
            {descriptionError ?? t.requestHint}
          </p>
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor="inquiry-client-message"
            className="text-sm font-medium text-foreground"
          >
            {t.clientMessage}
          </label>
          <Textarea
            id="inquiry-client-message"
            name="clientMessage"
            rows={6}
            defaultValue={values.clientMessage}
            maxLength={CLIENT_MESSAGE_MAX}
            aria-invalid={
              descriptionError || err("clientMessage") ? true : undefined
            }
            aria-describedby={describedBy(
              "inquiry-request-hint",
              err("clientMessage")
                ? "inquiry-client-message-error"
                : "inquiry-client-message-hint",
            )}
          />
          {err("clientMessage") ? (
            <p id="inquiry-client-message-error" className={fieldError}>
              {err("clientMessage")}
            </p>
          ) : (
            <p id="inquiry-client-message-hint" className={hint}>
              {t.clientMessageHint}
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor="inquiry-staff-summary"
            className="text-sm font-medium text-foreground"
          >
            {t.staffSummary}
          </label>
          <Textarea
            id="inquiry-staff-summary"
            name="staffSummary"
            rows={3}
            defaultValue={values.staffSummary}
            maxLength={STAFF_SUMMARY_MAX}
            className="min-h-20"
            aria-invalid={
              descriptionError || err("staffSummary") ? true : undefined
            }
            aria-describedby={describedBy(
              "inquiry-request-hint",
              err("staffSummary")
                ? "inquiry-staff-summary-error"
                : "inquiry-staff-summary-hint",
            )}
          />
          {err("staffSummary") ? (
            <p id="inquiry-staff-summary-error" className={fieldError}>
              {err("staffSummary")}
            </p>
          ) : (
            <p id="inquiry-staff-summary-hint" className={hint}>
              {t.staffSummaryHint}
            </p>
          )}
        </div>
      </fieldset>

      {/* Received: now (stamped by the database) or another date and time */}
      <fieldset
        key={`received-${values.receivedMode}`}
        className="group grid gap-3"
      >
        <legend className={`${legend} mb-2.5`}>{t.received}</legend>
        <div className="inline-flex w-fit rounded-full border border-border bg-muted p-0.5 dark:bg-background">
          {(["now", "other"] as const).map((mode) => (
            <label key={mode} className="relative">
              <input
                id={`inquiry-received-${mode}`}
                type="radio"
                name="receivedMode"
                value={mode}
                defaultChecked={values.receivedMode === mode}
                className="peer sr-only"
              />
              <span className="inline-flex h-9 cursor-pointer items-center rounded-full px-3.5 text-[13px] font-medium text-muted-foreground transition-[color,background-color,box-shadow] duration-150 ease-standard peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-card peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:text-foreground dark:peer-checked:bg-muted">
                {mode === "now" ? t.receivedNow : t.receivedOther}
              </span>
            </label>
          ))}
        </div>
        {/* Shown with CSS only, so it works before JavaScript loads. */}
        <div className="hidden max-w-xs gap-1.5 group-has-[#inquiry-received-other:checked]:grid">
          <label
            htmlFor="inquiry-received-local"
            className="text-sm font-medium text-foreground"
          >
            {t.receivedLocal}
          </label>
          <input
            id="inquiry-received-local"
            name="receivedLocal"
            type="datetime-local"
            defaultValue={values.receivedLocal}
            aria-invalid={err("received") ? true : undefined}
            aria-describedby={
              err("received")
                ? "inquiry-received-error"
                : "inquiry-received-hint"
            }
            className="h-10 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground aria-invalid:border-destructive sm:text-sm"
          />
          {err("received") ? (
            <p id="inquiry-received-error" className={fieldError}>
              {err("received")}
            </p>
          ) : (
            <p id="inquiry-received-hint" className={hint}>
              {t.receivedLocalHint}
            </p>
          )}
        </div>
      </fieldset>

      {/* Requester details as given (optional) */}
      <fieldset className="grid gap-4">
        <div>
          <legend className={legend}>{t.requester}</legend>
          <p className={`${hint} mt-1`}>{t.requesterHint}</p>
        </div>
        <FormField
          id="inquiry-requester-name"
          name="requesterName"
          label={t.requesterName}
          autoComplete="off"
          defaultValue={values.requesterName}
          error={err("requesterName")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="inquiry-requester-phone"
            name="requesterPhone"
            type="tel"
            inputMode="tel"
            label={t.requesterPhone}
            autoComplete="off"
            defaultValue={values.requesterPhone}
            error={err("requesterPhone")}
          />
          <FormField
            id="inquiry-requester-email"
            name="requesterEmail"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            label={t.requesterEmail}
            autoComplete="off"
            defaultValue={values.requesterEmail}
            error={err("requesterEmail")}
          />
        </div>
      </fieldset>

      {/* Event hints (optional) */}
      <fieldset className="grid gap-4">
        <div>
          <legend className={legend}>{t.event}</legend>
          <p className={`${hint} mt-1`}>{t.eventHint}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="inquiry-event-date"
            name="eventDate"
            type="date"
            label={t.eventDate}
            defaultValue={values.eventDate}
            error={err("eventDate")}
          />
          <FormField
            id="inquiry-guests"
            name="guests"
            inputMode="numeric"
            label={t.guests}
            autoComplete="off"
            defaultValue={values.guests}
            error={err("guests")}
          />
        </div>
      </fieldset>

      <div className="border-t border-border pt-5">
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
              {t.pending}
            </>
          ) : (
            t.submit
          )}
        </Button>
      </div>
    </form>
  );
}
