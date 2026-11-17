"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";

import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { createOrganization } from "@/lib/organizations/actions";
import type { CountryOption } from "@/lib/organizations/countries";
import type { OnboardingFormState } from "@/lib/organizations/onboarding";
import type { Messages } from "@/messages";

/**
 * Organization name and country. `requestId` is issued by the page and kept in
 * the form state, so every retry of this form sends the same idempotency key.
 */
export function OrganizationForm({
  requestId,
  countries,
  copy,
}: {
  requestId: string;
  countries: CountryOption[];
  copy: Messages["onboarding"];
}) {
  const [state, formAction, pending] = useActionState(createOrganization, {
    requestId,
    name: "",
    countryCode: "",
  } satisfies OnboardingFormState);
  const nameRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLSelectElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // Move focus to the first problem after a failed submission.
  useEffect(() => {
    if (state.fieldErrors?.name) nameRef.current?.focus();
    else if (state.fieldErrors?.country) countryRef.current?.focus();
    else if (state.formError) messageRef.current?.focus();
  }, [state]);

  const countryError =
    state.fieldErrors?.country && copy.fieldErrors[state.fieldErrors.country];
  const countryDescribedBy = countryError
    ? "organization-country-error"
    : "organization-country-hint";

  return (
    <form action={formAction} noValidate className="grid gap-4">
      {state.formError ? (
        <FormMessage tone="error" messageRef={messageRef}>
          {copy.formErrors[state.formError]}
        </FormMessage>
      ) : null}

      <input type="hidden" name="requestId" value={state.requestId} />

      <FormField
        id="organization-name"
        name="name"
        label={copy.fields.name}
        autoComplete="organization"
        required
        defaultValue={state.name}
        error={
          state.fieldErrors?.name && copy.fieldErrors[state.fieldErrors.name]
        }
        inputRef={nameRef}
      />

      <div className="grid gap-1.5">
        <label
          htmlFor="organization-country"
          className="text-sm font-medium text-foreground"
        >
          {copy.fields.country}
        </label>
        {/* Keyed by the submitted value so a re-render restores it after the
            form resets. */}
        <NativeSelect
          key={state.countryCode}
          id="organization-country"
          name="country"
          ref={countryRef}
          required
          defaultValue={state.countryCode}
          aria-invalid={countryError ? true : undefined}
          aria-describedby={countryDescribedBy}
        >
          <option value="" disabled>
            {copy.fields.countryPlaceholder}
          </option>
          {countries.map(({ code, name }) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </NativeSelect>
        {countryError ? (
          <p
            id="organization-country-error"
            className="text-xs font-medium text-destructive"
          >
            {countryError}
          </p>
        ) : (
          <p
            id="organization-country-hint"
            className="text-xs text-muted-foreground"
          >
            {copy.fields.countryHint}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        className="mt-2 w-full"
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
