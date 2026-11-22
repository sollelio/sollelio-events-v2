import "server-only";

import { createClient } from "@/lib/supabase/server";

import type { QuestionKind } from "./form";

/** The organization's active public link for its Inquiry form, if any (RLS). */
export async function getActiveInquiryFormLink(
  organizationId: string,
): Promise<{ id: string; publicKey: string; createdAt: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_form_links")
    .select("id, public_key, created_at, forms!inner(purpose)")
    .eq("organization_id", organizationId)
    .eq("forms.purpose", "inquiry")
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw new Error("Could not load the public form link");
  return data
    ? { id: data.id, publicKey: data.public_key, createdAt: data.created_at }
    : null;
}

export type FormAnswerView = {
  questionId: string;
  position: number;
  label: string;
  kind: QuestionKind;
  bound: boolean;
  text: string | null;
  number: number | null;
  date: string | null;
  choices: string[] | null;
};

/**
 * The answers of a submission with their questions as they were asked
 * (the answered version). RLS limits this to Owners and Managers.
 */
export async function getSubmissionAnswers(
  organizationId: string,
  submissionId: string,
): Promise<{ version: number; answers: FormAnswerView[] } | null> {
  const supabase = await createClient();
  const { data: submission, error: submissionError } = await supabase
    .from("form_submissions")
    .select("id, form_versions!inner(version)")
    .eq("organization_id", organizationId)
    .eq("id", submissionId)
    .maybeSingle();
  if (submissionError) throw new Error("Could not load the form submission");
  if (!submission) return null;

  const { data, error } = await supabase
    .from("form_answers")
    .select(
      "value_text, value_number, value_date, value_choices, form_questions!inner(id, position, label, kind, options, binding)",
    )
    .eq("organization_id", organizationId)
    .eq("form_submission_id", submissionId);
  if (error) throw new Error("Could not load the form answers");

  const version = (submission.form_versions as unknown as { version: number })
    .version;
  const answers = (data ?? [])
    .map((row) => {
      const question = row.form_questions as unknown as {
        id: string;
        position: number;
        label: string;
        kind: QuestionKind;
        options: { key: string; label: string }[] | null;
        binding: string | null;
      };
      const labels = new Map(
        (question.options ?? []).map((o) => [o.key, o.label]),
      );
      return {
        questionId: question.id,
        position: question.position,
        label: question.label,
        kind: question.kind,
        bound: question.binding !== null,
        text: row.value_text,
        number: row.value_number === null ? null : Number(row.value_number),
        date: row.value_date,
        choices: row.value_choices
          ? (row.value_choices as string[]).map((key) => labels.get(key) ?? key)
          : null,
      };
    })
    .sort((a, b) => a.position - b.position);
  return { version, answers };
}
