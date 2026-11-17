"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signIn, type AuthFormState } from "@/lib/auth/actions";
import type { SignInNotice } from "@/lib/auth/viewer";
import type { Messages } from "@/messages";

import { FormField } from "./form-field";
import { FormMessage } from "./form-message";

const initialState: AuthFormState = { email: "" };

export function SignInForm({
  next,
  notice,
  copy,
}: {
  next: string;
  notice?: SignInNotice;
  copy: Messages["auth"];
}) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // Move focus to the first problem after a failed submission.
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
      ) : notice ? (
        <FormMessage tone="notice">{copy.notices[notice]}</FormMessage>
      ) : null}

      <input type="hidden" name="next" value={next} />

      <FormField
        id="sign-in-email"
        name="email"
        type="email"
        label={copy.fields.email}
        autoComplete="username"
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
        id="sign-in-password"
        name="password"
        type="password"
        label={copy.fields.password}
        autoComplete="current-password"
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
            {copy.signIn.pending}
          </>
        ) : (
          copy.signIn.submit
        )}
      </Button>
    </form>
  );
}
