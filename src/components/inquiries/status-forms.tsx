"use client";

import { useActionState } from "react";
import { Archive, LoaderCircle, RotateCcw } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  closeInquiry,
  reopenInquiry,
  type InquiryStatusFormState,
} from "@/lib/inquiries/actions";
import { CLOSE_REASONS } from "@/lib/inquiries/inquiry";
import type { Messages } from "@/messages";

const initial: InquiryStatusFormState = {};

/** Closing applies to this inquiry only; it cancels no Event. */
export function CloseInquiryForm({
  inquiryId,
  copy,
}: {
  inquiryId: string;
  copy: Messages["inquiries"];
}) {
  const [state, action, pending] = useActionState(closeInquiry, initial);
  const t = copy.detail;

  return (
    <form action={action} className="grid gap-3">
      {state.error ? (
        <FormMessage tone="error">{copy.formErrors[state.error]}</FormMessage>
      ) : null}
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <div className="grid gap-1.5">
        <label
          htmlFor="inquiry-close-reason"
          className="text-sm font-medium text-foreground"
        >
          {t.closeReason}
        </label>
        <NativeSelect
          id="inquiry-close-reason"
          name="reason"
          required
          defaultValue=""
          aria-describedby="inquiry-close-hint"
        >
          <option value="" disabled>
            {t.closeReasonPlaceholder}
          </option>
          {CLOSE_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {copy.closeReasons[reason]}
            </option>
          ))}
        </NativeSelect>
        <p id="inquiry-close-hint" className="text-xs text-muted-foreground">
          {t.closeHint}
        </p>
      </div>
      <Button
        type="submit"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <LoaderCircle aria-hidden className="animate-spin" />
        ) : (
          <Archive aria-hidden />
        )}
        {pending ? t.closing : t.close}
      </Button>
    </form>
  );
}

export function ReopenInquiryForm({
  inquiryId,
  copy,
}: {
  inquiryId: string;
  copy: Messages["inquiries"];
}) {
  const [state, action, pending] = useActionState(reopenInquiry, initial);
  const t = copy.detail;

  return (
    <form action={action} className="grid gap-3">
      {state.error ? (
        <FormMessage tone="error">{copy.formErrors[state.error]}</FormMessage>
      ) : null}
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <Button
        type="submit"
        variant="outline"
        size="lg"
        className="w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <LoaderCircle aria-hidden className="animate-spin" />
        ) : (
          <RotateCcw aria-hidden />
        )}
        {pending ? t.reopening : t.reopen}
      </Button>
    </form>
  );
}
