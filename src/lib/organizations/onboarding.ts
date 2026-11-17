import type { Viewer } from "../auth/viewer.ts";
import {
  parseOrganizationForm,
  type OrganizationFieldErrors,
} from "./validation.ts";

/**
 * First-organization onboarding, free of framework and Supabase imports so it
 * can be tested directly. The Server Function (actions.ts) supplies the
 * dependencies.
 *
 * Idempotency: the page issues one request id per visit, and every retry of
 * that form reuses it. `create_organization()` returns the same organization
 * for a repeated id, so a double submission or a retry after a lost response
 * cannot create a second one. The owner is always the session's user
 * (`auth.uid()` in the database); the browser never supplies it.
 */

export const ONBOARDING_PATH = "/onboarding";
const SIGN_IN_FOR_ONBOARDING = `/sign-in?next=${encodeURIComponent(ONBOARDING_PATH)}`;

export type OnboardingFormErrorKey =
  "unavailable" | "notAllowed" | "invalid" | "requestReused" | "generic";

export type OnboardingFormState = {
  requestId: string;
  name: string;
  countryCode: string;
  fieldErrors?: OrganizationFieldErrors;
  formError?: OnboardingFormErrorKey;
};

export type CreateOrganizationArgs = {
  organization_name: string;
  country_code: string;
  request_id: string;
};

/** Result of calling `public.create_organization()`. */
export type CreateOrganizationResult =
  { ok: true } | { ok: false; code: string | undefined };

export type OnboardingDependencies = {
  /** Reads the viewer from Supabase Auth and RLS, without memoisation. */
  loadViewer: () => Promise<Viewer>;
  createOrganization: (
    args: CreateOrganizationArgs,
  ) => Promise<CreateOrganizationResult>;
  newRequestId: () => string;
};

export type OnboardingOutcome =
  | { kind: "redirect"; to: string }
  | { kind: "form"; state: OnboardingFormState };

/**
 * Who may see onboarding: verified users without an active membership.
 * Anyone else is sent where they belong.
 */
export function onboardingAccess(
  viewer: Viewer,
):
  | { allowed: true; viewer: Extract<Viewer, { status: "verified" }> }
  | { allowed: false; redirectTo: string } {
  switch (viewer.status) {
    case "anonymous":
      return { allowed: false, redirectTo: SIGN_IN_FOR_ONBOARDING };
    case "unverified":
      return { allowed: false, redirectTo: "/sign-in?status=unverified" };
    case "verified":
      return viewer.hasActiveMembership
        ? { allowed: false, redirectTo: "/" }
        : { allowed: true, viewer };
  }
}

/**
 * Maps the error of `create_organization()` (SQLSTATEs in ADR 0004) to a
 * message key. Anything unexpected, including a network failure (no code),
 * is "unavailable": retrying is safe because the request id is reused.
 */
export function createOrganizationErrorKey(
  code: string | undefined,
): Exclude<OnboardingFormErrorKey, "generic"> {
  if (code === "42501" || code?.startsWith("PGRST3")) {
    // Not permitted, or PostgREST rejected the session's JWT.
    return "notAllowed";
  }
  if (code === "22023") return "invalid";
  if (code === "23505") return "requestReused";
  return "unavailable";
}

export async function submitOnboarding(
  form: FormData,
  deps: OnboardingDependencies,
): Promise<OnboardingOutcome> {
  const access = onboardingAccess(await deps.loadViewer());
  if (!access.allowed) {
    // Includes onboarding already completed, for example in another tab.
    return { kind: "redirect", to: access.redirectTo };
  }

  const input = parseOrganizationForm(form);
  // A missing or malformed id means nothing was sent with it; issue a new one.
  const requestId = input.requestId ?? deps.newRequestId();
  const values = {
    requestId,
    name: input.name,
    countryCode: input.countryCode,
  };

  if (!input.ok) {
    return {
      kind: "form",
      state: { ...values, fieldErrors: input.fieldErrors },
    };
  }
  if (!input.requestId) {
    return { kind: "form", state: { ...values, formError: "generic" } };
  }

  const result = await deps.createOrganization({
    organization_name: input.name,
    country_code: input.countryCode,
    request_id: input.requestId,
  });
  if (result.ok) return { kind: "redirect", to: "/" };

  const formError = createOrganizationErrorKey(result.code);

  if (formError === "requestReused" || formError === "notAllowed") {
    // The id already created an organization (a retry with edited values),
    // or the session changed. Re-read the viewer: a member goes home, a
    // signed-out or unverified session goes to sign-in.
    const recheck = onboardingAccess(await deps.loadViewer());
    if (!recheck.allowed) return { kind: "redirect", to: recheck.redirectTo };
  }

  return {
    kind: "form",
    state: {
      ...values,
      // A reused id can never succeed again; anything else keeps it so a
      // retry stays idempotent.
      requestId:
        formError === "requestReused" ? deps.newRequestId() : requestId,
      formError,
    },
  };
}
