"use client";

import { useActionState, useEffect, useRef } from "react";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signUp, type AuthFormState } from "@/lib/auth/actions";
import type { Messages } from "@/messages";

import { AuthField } from "./auth-field";
import { FormMessage } from "./form-message";

const initialState: AuthFormState = { email: "" };

export function SignUpForm({ copy }: { copy: Messages["auth"] }) {
  const [state, formAction, pending] = useActionState(signUp, initialState);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.fieldErrors?.email) emailRef.current?.focus();
    else if (state.fieldErrors?.password) passwordRef.current?.focus();
    else if (state.fieldErrors?.confirmPassword) confirmRef.current?.focus();
    else if (state.formError) messageRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} noValidate className="grid gap-5">
      {state.formError ? (
        <FormMessage tone="error" messageRef={messageRef}>
          {copy.formErrors[state.formError]}
        </FormMessage>
      ) : null}

      <AuthField
        id="sign-up-email"
        name="email"
        kind="email"
        label={copy.fields.email}
        placeholder={copy.placeholders.email}
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
      <AuthField
        id="sign-up-password"
        name="password"
        kind="password"
        label={copy.fields.newPassword}
        placeholder={copy.placeholders.newPassword}
        autoComplete="new-password"
        minLength={8}
        required
        error={
          state.fieldErrors?.password &&
          copy.fieldErrors[state.fieldErrors.password]
        }
        inputRef={passwordRef}
      />
      <AuthField
        id="sign-up-confirm"
        name="confirmPassword"
        kind="password"
        label={copy.fields.confirmPassword}
        placeholder={copy.placeholders.confirmPassword}
        autoComplete="new-password"
        required
        error={
          state.fieldErrors?.confirmPassword &&
          copy.fieldErrors[state.fieldErrors.confirmPassword]
        }
        inputRef={confirmRef}
      />

      <Button
        type="submit"
        size="lg"
        className="mt-3 h-12 w-full rounded-2xl bg-white text-base font-medium text-black hover:bg-white/90"
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