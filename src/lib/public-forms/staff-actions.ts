"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canAccessInquiries } from "@/lib/inquiries/inquiry";
import { requireActiveOrganization } from "@/lib/organizations/context";
import { createClient } from "@/lib/supabase/server";

/*
 * Owner/Manager management of the public Inquiry form link. The database
 * functions check again (verified, active Owner or Manager of the link's
 * organization).
 */

export type LinkActionState = { error?: "notAllowed" | "unavailable" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function run(
  call: (supabase: Awaited<ReturnType<typeof createClient>>) => PromiseLike<{
    error: { code?: string } | null;
  }>,
): Promise<LinkActionState> {
  const { organization } = await requireActiveOrganization();
  if (!canAccessInquiries(organization.role)) redirect("/inquiries");
  try {
    const { error } = await call(await createClient());
    if (error)
      return { error: error.code === "42501" ? "notAllowed" : "unavailable" };
  } catch {
    return { error: "unavailable" };
  }
  revalidatePath("/inquiries");
  return {};
}

/** Creates the default Inquiry form (first time) and an active link. */
export async function enablePublicForm(): Promise<LinkActionState> {
  const { organization } = await requireActiveOrganization();
  return run((supabase) =>
    supabase.rpc("enable_public_inquiry_form", {
      p_organization_id: organization.id,
    }),
  );
}

export async function rotatePublicFormLink(
  _previous: LinkActionState,
  form: FormData,
): Promise<LinkActionState> {
  const linkId = form.get("linkId");
  if (typeof linkId !== "string" || !UUID_PATTERN.test(linkId)) {
    return { error: "unavailable" };
  }
  return run((supabase) =>
    supabase.rpc("rotate_public_form_link", { p_link_id: linkId }),
  );
}

export async function revokePublicFormLink(
  _previous: LinkActionState,
  form: FormData,
): Promise<LinkActionState> {
  const linkId = form.get("linkId");
  if (typeof linkId !== "string" || !UUID_PATTERN.test(linkId)) {
    return { error: "unavailable" };
  }
  return run((supabase) =>
    supabase.rpc("revoke_public_form_link", { p_link_id: linkId }),
  );
}
