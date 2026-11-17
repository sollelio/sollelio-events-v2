import "server-only";

import { createClient } from "@/lib/supabase/server";

export type HomeOrganization = {
  id: string;
  name: string;
  countryCode: string;
};

/**
 * The organization shown on Home. RLS returns only organizations in which the
 * viewer holds an active membership, so this is also the authorization check.
 *
 * Onboarding creates one organization per user. Choosing between several
 * (the active-organization context) is not designed yet; until it is, the
 * oldest is shown.
 */
export async function getHomeOrganization(): Promise<HomeOrganization | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, country_code")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error("Could not load the organization");
  if (!data) return null;
  return { id: data.id, name: data.name, countryCode: data.country_code };
}
