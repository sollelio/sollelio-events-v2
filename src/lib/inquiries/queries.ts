import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { CloseReason, InquirySource, InquiryStatus } from "./inquiry";

export type InquiryRecord = {
  id: string;
  /** Null for public submissions (origin not stated). */
  source: InquirySource | null;
  clientMessage: string | null;
  staffSummary: string | null;
  receivedAt: string;
  requesterName: string | null;
  requesterPhone: string | null;
  requesterEmail: string | null;
  requestedEventDate: string | null;
  estimatedGuests: number | null;
  status: InquiryStatus;
  closeReason: CloseReason | null;
  closedAt: string | null;
  /** Null for public submissions (no author). */
  createdBy: string | null;
  createdAt: string;
  submissionChannel: "staff_entry" | "public_form";
  formSubmissionId: string | null;
};

const COLUMNS =
  "id, source, client_message, staff_summary, received_at, requester_name, requester_phone, requester_email, requested_event_date, estimated_guests, status, close_reason, closed_at, created_by, created_at, submission_channel, form_submission_id";

/** Rows as returned by PostgREST (no generated types yet). */
type Row = {
  id: string;
  source: InquirySource | null;
  client_message: string | null;
  staff_summary: string | null;
  received_at: string;
  requester_name: string | null;
  requester_phone: string | null;
  requester_email: string | null;
  requested_event_date: string | null;
  estimated_guests: number | null;
  status: InquiryStatus;
  close_reason: CloseReason | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  submission_channel: "staff_entry" | "public_form";
  form_submission_id: string | null;
};

function toRecord(row: Row): InquiryRecord {
  return {
    id: row.id,
    source: row.source,
    clientMessage: row.client_message,
    staffSummary: row.staff_summary,
    receivedAt: row.received_at,
    requesterName: row.requester_name,
    requesterPhone: row.requester_phone,
    requesterEmail: row.requester_email,
    requestedEventDate: row.requested_event_date,
    estimatedGuests: row.estimated_guests,
    status: row.status,
    closeReason: row.close_reason,
    closedAt: row.closed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    submissionChannel: row.submission_channel,
    formSubmissionId: row.form_submission_id,
  };
}

/** How many inquiries a list shows; the page says when there are more. */
export const LIST_LIMIT = 100;

/*
 * Every query filters by the server-resolved active organization. RLS already
 * limits rows to organizations where the viewer is an active, verified Owner
 * or Manager; the explicit filter keeps a viewer of several organizations in
 * the one they are working in.
 */

export async function listInquiries(
  organizationId: string,
  status: InquiryStatus,
): Promise<{ inquiries: InquiryRecord[]; total: number }> {
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("inquiries")
    .select(COLUMNS, { count: "exact" })
    .eq("organization_id", organizationId)
    .eq("status", status)
    .order("received_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) throw new Error("Could not load inquiries");
  return {
    inquiries: ((data ?? []) as Row[]).map(toRecord),
    total: count ?? 0,
  };
}

export async function countInquiries(
  organizationId: string,
): Promise<{ open: number; closed: number }> {
  const supabase = await createClient();
  const count = async (status: InquiryStatus) => {
    const { count, error } = await supabase
      .from("inquiries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", status);
    if (error) throw new Error("Could not count inquiries");
    return count ?? 0;
  };
  const [open, closed] = await Promise.all([count("open"), count("closed")]);
  return { open, closed };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The inquiry, or null when it does not exist in this organization. */
export async function getInquiry(
  organizationId: string,
  inquiryId: string,
): Promise<InquiryRecord | null> {
  if (!UUID_PATTERN.test(inquiryId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inquiries")
    .select(COLUMNS)
    .eq("organization_id", organizationId)
    .eq("id", inquiryId)
    .maybeSingle();
  if (error) throw new Error("Could not load the inquiry");
  return data ? toRecord(data as Row) : null;
}
