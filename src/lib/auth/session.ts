import "server-only";

import {
  isAuthApiError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

import { destinationFor, type Viewer } from "./viewer";

/**
 * Establishes the viewer on the server. This is the authentication boundary
 * for pages and Server Functions; the proxy only refreshes cookies.
 *
 * getUser() validates the session with Supabase Auth on every call, so a
 * revoked session or deleted user is not trusted, and email_confirmed_at is
 * current. A session whose email is not confirmed is treated as unverified.
 * Not memoised: Server Functions use it to re-read the viewer after a change.
 */
export async function loadViewer(): Promise<Viewer> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (
      isAuthSessionMissingError(error) ||
      (isAuthApiError(error) && (error.status === 401 || error.status === 403))
    ) {
      return { status: "anonymous" };
    }
    // Network or service failure: fail closed with an error page rather than
    // silently treating the visitor as signed out.
    throw new Error("Could not verify the session");
  }

  const user = data.user;
  if (!user.email || !user.email_confirmed_at || user.is_anonymous) {
    return { status: "unverified" };
  }

  // RLS limits this to the viewer's own memberships.
  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select("status")
    .in("status", ["active", "suspended"]);
  if (membershipError) {
    throw new Error("Could not load memberships");
  }
  const statuses = new Set((memberships ?? []).map((row) => row.status));

  return {
    status: "verified",
    userId: user.id,
    email: user.email,
    hasActiveMembership: statuses.has("active"),
    hasSuspendedMembership: statuses.has("suspended"),
  };
}

/** loadViewer(), memoised per request. Use this in pages and layouts. */
export const getViewer = cache(loadViewer);

/**
 * Requires a verified user; otherwise redirects to sign-in, returning to
 * `returnTo` (an internal path chosen by the caller) afterwards.
 */
export async function requireVerifiedViewer(
  returnTo: string,
): Promise<Extract<Viewer, { status: "verified" }>> {
  const viewer = await getViewer();
  if (viewer.status === "anonymous") {
    redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  }
  if (viewer.status === "unverified") {
    redirect(destinationFor(viewer));
  }
  return viewer;
}
