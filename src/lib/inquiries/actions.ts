"use server";

import { redirect } from "next/navigation";

import { requireActiveOrganization } from "@/lib/organizations/context";
import { createClient } from "@/lib/supabase/server";

import {
  canAccessInquiries,
  inquiryErrorKey,
  isCloseReason,
  submitInquiry,
  type InquiryFormErrorKey,
  type InquiryFormState,
  type RpcResult,
} from "./inquiry";

/*
 * Server Functions for inquiries. Each one resolves the active organization
 * and the viewer's role on the server; the database functions check again
 * (verified, active Owner or Manager of the inquiry's organization).
 */

async function requireInquiryAccess() {
  const context = await requireActiveOrganization();
  if (!canAccessInquiries(context.organization.role)) redirect("/inquiries");
  return context;
}

export async function createInquiry(
  _previous: InquiryFormState,
  form: FormData,
): Promise<InquiryFormState> {
  const { organization } = await requireInquiryAccess();

  const outcome = await submitInquiry(form, {
    organizationId: organization.id,
    now: new Date(),
    newRequestId: () => crypto.randomUUID(),
    async createInquiry(args): Promise<RpcResult<string>> {
      try {
        const supabase = await createClient();
        const { data, error } = await supabase.rpc("create_inquiry", args);
        if (error) return { ok: false, code: error.code };
        return typeof data === "string"
          ? { ok: true, data }
          : { ok: false, code: undefined };
      } catch {
        return { ok: false, code: undefined };
      }
    },
  });

  if (outcome.kind === "created") {
    redirect(`/inquiries/${outcome.inquiryId}?notice=registered`);
  }
  return outcome.state;
}

export type InquiryStatusFormState = { error?: InquiryFormErrorKey };

async function changeStatus(
  inquiryId: FormDataEntryValue | null,
  call: (id: string) => Promise<{ code?: string } | null>,
  notice: "closed" | "reopened",
): Promise<InquiryStatusFormState> {
  await requireInquiryAccess();
  if (typeof inquiryId !== "string") return { error: "generic" };

  let failure: { code?: string } | null;
  try {
    failure = await call(inquiryId);
  } catch {
    failure = { code: undefined };
  }
  if (failure) return { error: inquiryErrorKey(failure.code) };
  redirect(`/inquiries/${inquiryId}?notice=${notice}`);
}

/** Closing is about this inquiry only; it implies nothing about any Event. */
export async function closeInquiry(
  _previous: InquiryStatusFormState,
  form: FormData,
): Promise<InquiryStatusFormState> {
  const reason = form.get("reason");
  if (!isCloseReason(reason)) return { error: "invalid" };
  return changeStatus(
    form.get("inquiryId"),
    async (id) => {
      const supabase = await createClient();
      const { error } = await supabase.rpc("close_inquiry", {
        p_inquiry_id: id,
        p_reason: reason,
      });
      return error ? { code: error.code } : null;
    },
    "closed",
  );
}

export async function reopenInquiry(
  _previous: InquiryStatusFormState,
  form: FormData,
): Promise<InquiryStatusFormState> {
  return changeStatus(
    form.get("inquiryId"),
    async (id) => {
      const supabase = await createClient();
      const { error } = await supabase.rpc("reopen_inquiry", {
        p_inquiry_id: id,
      });
      return error ? { code: error.code } : null;
    },
    "reopened",
  );
}
