"use server";

import { redirect } from "next/navigation";

import { loadViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import {
  submitOnboarding,
  type CreateOrganizationResult,
  type OnboardingFormState,
} from "./onboarding";

/**
 * Creates the viewer's first organization through
 * `public.create_organization()`, with the user's own session, so RLS and the
 * function's own checks apply. The function makes the caller the Owner; no
 * user or organization id is accepted from the form.
 */
export async function createOrganization(
  _previous: OnboardingFormState,
  form: FormData,
): Promise<OnboardingFormState> {
  const outcome = await submitOnboarding(form, {
    loadViewer,
    newRequestId: () => crypto.randomUUID(),
    async createOrganization(args): Promise<CreateOrganizationResult> {
      try {
        const supabase = await createClient();
        const { error } = await supabase.rpc("create_organization", args);
        return error ? { ok: false, code: error.code } : { ok: true };
      } catch {
        return { ok: false, code: undefined };
      }
    },
  });

  if (outcome.kind === "redirect") redirect(outcome.to);
  return outcome.state;
}
