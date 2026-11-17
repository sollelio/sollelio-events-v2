"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { loadViewer } from "@/lib/auth/session";
import { destinationFor } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

import {
  ACTIVE_ORGANIZATION_COOKIE,
  findOrganization,
  SELECT_ORGANIZATION_PATH,
} from "./active-organization";
import { loadActiveOrganizations } from "./context";
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

/** The preference lasts about six months; it is re-validated on every use. */
const PREFERENCE_MAX_AGE = 60 * 60 * 24 * 180;

/**
 * Makes one of the viewer's organizations the active one. The submitted id is
 * a hint: it is accepted only if it names an organization in which the viewer,
 * re-read now from Supabase Auth and RLS, holds an active membership.
 */
export async function selectOrganization(form: FormData): Promise<void> {
  const viewer = await loadViewer();
  if (viewer.status !== "verified") redirect(destinationFor(viewer));

  const organization = findOrganization(
    await loadActiveOrganizations(),
    form.get("organizationId"),
  );
  if (!organization) redirect(SELECT_ORGANIZATION_PATH);

  (await cookies()).set(ACTIVE_ORGANIZATION_COOKIE, organization.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PREFERENCE_MAX_AGE,
  });
  redirect("/");
}
