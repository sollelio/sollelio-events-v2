"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { signInErrorKey, signUpOutcome, type FormErrorKey } from "./errors";
import { safeRedirectPath } from "./redirect";
import { parseCredentials, type FieldErrorKey } from "./validation";

/** Returned to the form. Never contains the password or raw Auth errors. */
export type AuthFormState = {
  email: string;
  fieldErrors?: { email?: FieldErrorKey; password?: FieldErrorKey };
  formError?: FormErrorKey;
};

export async function signIn(
  _previous: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const credentials = parseCredentials(form, "sign-in");
  if (!credentials.ok) {
    return { email: credentials.email, fieldErrors: credentials.fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (error) {
    return { email: credentials.email, formError: signInErrorKey(error) };
  }

  // Defence in depth: never keep a session for an unconfirmed address, even
  // if the hosted "Confirm email" setting is ever switched off.
  if (!data.user.email_confirmed_at) {
    await supabase.auth.signOut({ scope: "local" });
    return { email: credentials.email, formError: "emailNotConfirmed" };
  }

  redirect(safeRedirectPath(form.get("next"), "/"));
}

export async function signUp(
  _previous: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const credentials = parseCredentials(form, "sign-up");
  if (!credentials.ok) {
    return { email: credentials.email, fieldErrors: credentials.fieldErrors };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: { emailRedirectTo: await callbackUrl() },
  });

  if (error) {
    const outcome = signUpOutcome(error);
    if (outcome !== "accepted") {
      return { email: credentials.email, formError: outcome };
    }
  } else if (data.session) {
    // Only possible if email confirmation were disabled for the project.
    redirect("/");
  }

  redirect("/sign-up/check-email");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  // Ends this device's session only; other devices stay signed in.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/sign-in?status=signed-out");
}

/**
 * Where the confirmation email returns. Next.js rejects Server Function
 * requests whose Origin does not match the host, and Supabase Auth only
 * redirects to URLs on the project's allow list (otherwise it uses the Site
 * URL), so this cannot send users to another site.
 */
async function callbackUrl(): Promise<string | undefined> {
  const origin = (await headers()).get("origin");
  if (!origin) return undefined;
  try {
    const url = new URL("/auth/callback", origin);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
