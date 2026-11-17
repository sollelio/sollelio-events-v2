import { destinationFor, type Viewer } from "../auth/viewer.ts";

/**
 * Active-organization resolution (Technical Foundation §3.4): which
 * organization the viewer is working in. The active organization is context,
 * not authorization. It is always chosen from the viewer's own active
 * memberships, read on the server under RLS; a value from the browser (the
 * preference cookie or a submitted form) is only ever a hint matched against
 * that list.
 */

export type MembershipRole = "owner" | "manager" | "member";

/** An organization the viewer can work in, with the viewer's role there. */
export type OrganizationSummary = {
  id: string;
  name: string;
  countryCode: string;
  role: MembershipRole;
};

/** A membership row as read under RLS, with its organization if readable. */
export type MembershipRow = {
  status: string;
  organization: OrganizationSummary | null;
};

export type ActiveOrganizationResolution =
  | { kind: "none" }
  | {
      kind: "selected";
      organization: OrganizationSummary;
      organizations: OrganizationSummary[];
    }
  | { kind: "choose"; organizations: OrganizationSummary[] };

/** httpOnly cookie holding the viewer's preferred organization id. */
export const ACTIVE_ORGANIZATION_COOKIE = "sollelio-active-organization";
export const SELECT_ORGANIZATION_PATH = "/select-organization";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asOrganizationId(value: unknown): string | undefined {
  return typeof value === "string" && UUID_PATTERN.test(value)
    ? value.toLowerCase()
    : undefined;
}

/** Organizations of active memberships only, once each, sorted by name. */
export function activeOrganizations(
  memberships: readonly MembershipRow[],
  locale: string,
): OrganizationSummary[] {
  const byId = new Map<string, OrganizationSummary>();
  for (const { status, organization } of memberships) {
    if (status !== "active" || !organization) continue;
    byId.set(organization.id.toLowerCase(), organization);
  }
  const collator = new Intl.Collator(locale);
  return [...byId.values()].sort(
    (a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id),
  );
}

/** The organization with this id among `organizations`, if any. */
export function findOrganization(
  organizations: readonly OrganizationSummary[],
  id: unknown,
): OrganizationSummary | undefined {
  const wanted = asOrganizationId(id);
  return wanted
    ? organizations.find((org) => org.id.toLowerCase() === wanted)
    : undefined;
}

/**
 * One organization is selected automatically. With several, the preference
 * is used only if it names one of them; otherwise the viewer chooses.
 */
export function resolveActiveOrganization(
  organizations: readonly OrganizationSummary[],
  preferredId: unknown,
): ActiveOrganizationResolution {
  const list = [...organizations];
  const [only] = list;
  if (!only) return { kind: "none" };
  if (list.length === 1) {
    return { kind: "selected", organization: only, organizations: list };
  }
  const preferred = findOrganization(list, preferredId);
  return preferred
    ? { kind: "selected", organization: preferred, organizations: list }
    : { kind: "choose", organizations: list };
}

/** What an application page does for this viewer and resolution. */
export type AppEntry =
  | { kind: "render"; organization: OrganizationSummary; canSwitch: boolean }
  | { kind: "redirect"; to: string }
  | { kind: "inconsistent" };

export function appEntry(
  viewer: Viewer,
  resolution: ActiveOrganizationResolution,
): AppEntry {
  if (viewer.status !== "verified") {
    return { kind: "redirect", to: destinationFor(viewer) };
  }
  switch (resolution.kind) {
    case "none":
      // A counted active membership whose organization cannot be read must
      // not bounce between Home and onboarding: fail closed instead.
      // Otherwise: suspended-only → suspended state, else onboarding.
      return viewer.hasActiveMembership
        ? { kind: "inconsistent" }
        : { kind: "redirect", to: destinationFor(viewer) };
    case "choose":
      return { kind: "redirect", to: SELECT_ORGANIZATION_PATH };
    case "selected":
      return {
        kind: "render",
        organization: resolution.organization,
        canSwitch: resolution.organizations.length > 1,
      };
  }
}

/** What the organization selection page does. */
export type OrganizationChoice =
  | {
      kind: "choose";
      organizations: OrganizationSummary[];
      currentId: string | undefined;
    }
  | { kind: "redirect"; to: string }
  | { kind: "inconsistent" };

/**
 * The selection page lists the viewer's organizations when there is more
 * than one (marking the current one); otherwise it routes like the app.
 */
export function organizationChoice(
  viewer: Viewer,
  resolution: ActiveOrganizationResolution,
): OrganizationChoice {
  if (viewer.status !== "verified" || resolution.kind === "none") {
    const entry = appEntry(viewer, resolution);
    return entry.kind === "render" ? { kind: "redirect", to: "/" } : entry;
  }
  if (resolution.kind === "choose") {
    return {
      kind: "choose",
      organizations: resolution.organizations,
      currentId: undefined,
    };
  }
  return resolution.organizations.length > 1
    ? {
        kind: "choose",
        organizations: resolution.organizations,
        currentId: resolution.organization.id,
      }
    : { kind: "redirect", to: "/" };
}

/** Up to two initials for the organization tile, e.g. "Atelier Lumen" → "AL". */
export function monogram(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word)[0] ?? "")
    .filter((letter) => /\p{L}|\p{N}/u.test(letter));
  return initials.slice(0, 2).join("").toLocaleUpperCase() || "·";
}
