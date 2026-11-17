"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signUp, type AuthFormState } from "@/lib/auth/actions";
import type { Messages } from "@/messages";

import { FormField } from "./form-field";
import { FormMessage } from "./form-message";

const initialState: AuthFormState = { email: "" };

export function SignUpForm({ copy }: { copy: Messages["auth"] }) {
  const [state, formAction, pending] = useActionState(signUp, initialState);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.fieldErrors?.email) emailRef.current?.focus();
    else if (state.fieldErrors?.password) passwordRef.current?.focus();
    else if (state.formError) messageRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} noValidate className="grid gap-4">
      {state.formError ? (
        <FormMessage tone="error" messageRef={messageRef}>
          {copy.formErrors[state.formError]}
        </FormMessage>
      ) : null}

      <FormField
        id="sign-up-email"
        name="email"
        type="email"
        label={copy.fields.email}
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        defaultValue={state.email}
        error={
          state.fieldErrors?.email && copy.fieldErrors[state.fieldErrors.email]
        }
        inputRef={emailRef}
      />
      <FormField
        id="sign-up-password"
        name="password"
        type="password"
        label={copy.fields.password}
        hint={copy.fields.newPasswordHint}
        autoComplete="new-password"
        minLength={8}
        required
        error={
          state.fieldErrors?.password &&
          copy.fieldErrors[state.fieldErrors.password]
        }
        inputRef={passwordRef}
      />

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
            {copy.signUp.pending}
          </>
        ) : (
          copy.signUp.submit
        )}
      </Button>
    </form>
  );
}
