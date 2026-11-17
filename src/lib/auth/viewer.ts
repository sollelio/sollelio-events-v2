/**
 * Who is viewing, as established on the server, and where they belong.
 * The membership flag is only a routing hint; every protected read and
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
    };

export type Destination =
  "/sign-in" | "/sign-in?status=unverified" | "/onboarding" | "/";

export function destinationFor(viewer: Viewer): Destination {
  switch (viewer.status) {
    case "anonymous":
      return "/sign-in";
    case "unverified":
      return "/sign-in?status=unverified";
    case "verified":
      return viewer.hasActiveMembership ? "/" : "/onboarding";
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
