/**
 * Who is viewing, as established on the server, and where they belong.
 * The membership flags are only routing hints; every protected read and
 * mutation is still authorized by RLS and server-side checks.
 */

export type Viewer =
  | { status: "anonymous" }
  | { status: "unverified" }
  | {
      status: "verified";
      userId: string;
      email: string;
      hasActiveMembership: boolean;
      /** At least one suspended membership (and none active, if false above). */
      hasSuspendedMembership: boolean;
    };

export type Destination =
  | "/sign-in"
  | "/sign-in?status=unverified"
  | "/onboarding"
  | "/access-suspended"
  | "/";

export const ACCESS_SUSPENDED_PATH = "/access-suspended";

export function destinationFor(viewer: Viewer): Destination {
  switch (viewer.status) {
    case "anonymous":
      return "/sign-in";
    case "unverified":
      return "/sign-in?status=unverified";
    case "verified":
      // An active membership wins. Suspended-only users are told so rather
      // than offered a new organization; removed or invited-only users have
      // no current organization and go to onboarding.
      if (viewer.hasActiveMembership) return "/";
      return viewer.hasSuspendedMembership
        ? ACCESS_SUSPENDED_PATH
        : "/onboarding";
  }
}

/** Notices the sign-in page may show, selected by `?status=`. */
export const SIGN_IN_NOTICES = [
  "signed-out",
  "unverified",
  "confirmation-failed",
  "link-expired",
] as const;
export type SignInNotice = (typeof SIGN_IN_NOTICES)[number];

export function signInNotice(value: unknown): SignInNotice | undefined {
  return SIGN_IN_NOTICES.find((notice) => notice === value);
}
