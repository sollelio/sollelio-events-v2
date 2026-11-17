import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getViewer } from "@/lib/auth/session";
import type { Viewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { LOCALE } from "@/messages";

import {
  ACTIVE_ORGANIZATION_COOKIE,
  activeOrganizations,
  appEntry,
  resolveActiveOrganization,
  type ActiveOrganizationResolution,
  type MembershipRow,
  type OrganizationSummary,
} from "./active-organization";

/**
 * The viewer's organizations with an active membership. RLS returns only the
 * viewer's own memberships, and an organization only while that membership is
 * active; the status filter is repeated here and in activeOrganizations().
 * Not memoised: Server Functions re-read it before acting.
 */
export async function loadActiveOrganizations(): Promise<
  OrganizationSummary[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("status, organization:organizations(id, name, country_code)")
    .eq("status", "active");
  if (error) throw new Error("Could not load organizations");

  const rows: MembershipRow[] = (data ?? []).map((row) => {
    // Embedded to-one relation; typed loosely without generated types.
    const org = row.organization as unknown as {
      id: string;
      name: string;
      country_code: string;
    } | null;
    return {
      status: row.status,
      organization: org
        ? { id: org.id, name: org.name, countryCode: org.country_code }
        : null,
    };
  });
  return activeOrganizations(rows, LOCALE);
}

/** loadActiveOrganizations(), memoised per request, for pages and layouts. */
export const listActiveOrganizations = cache(loadActiveOrganizations);

/** Resolution for the current request, from RLS and the preference cookie. */
export const getActiveOrganization = cache(
  async (): Promise<{
    viewer: Viewer;
    resolution: ActiveOrganizationResolution;
  }> => {
    const viewer = await getViewer();
    if (viewer.status !== "verified") {
      return { viewer, resolution: { kind: "none" } };
    }
    const preferred = (await cookies()).get(ACTIVE_ORGANIZATION_COOKIE)?.value;
    return {
      viewer,
      resolution: resolveActiveOrganization(
        await listActiveOrganizations(),
        preferred,
      ),
    };
  },
);

/**
 * Required by every page in the application shell. Redirects anyone without
 * a verified session or an active organization; returns the verified viewer
 * and the organization they are working in.
 */
export async function requireActiveOrganization(): Promise<{
  viewer: Extract<Viewer, { status: "verified" }>;
  organization: OrganizationSummary;
  canSwitch: boolean;
}> {
  const { viewer, resolution } = await getActiveOrganization();
  const entry = appEntry(viewer, resolution);
  if (entry.kind === "redirect") redirect(entry.to);
  if (entry.kind === "inconsistent" || viewer.status !== "verified") {
    throw new Error("Active membership without a readable organization");
  }
  return {
    viewer,
    organization: entry.organization,
    canSwitch: entry.canSwitch,
  };
}
