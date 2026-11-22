import type { Metadata } from "next";
import { CircleCheck } from "lucide-react";

import { PublicShell } from "@/components/public-forms/public-shell";
import { loadPublicForm } from "@/lib/public-forms/server";
import { getMessages } from "@/messages";

export const metadata: Metadata = {
  title: getMessages().publicForm.sent.metaTitle,
  robots: { index: false, follow: false },
};

/** Confirmation. Echoes nothing that was submitted. */
export default async function PublicFormSentPage({
  params,
}: PageProps<"/f/[key]/sent">) {
  const { key } = await params;
  const form = await loadPublicForm(key);
  const { sent } = getMessages().publicForm;

  return (
    <PublicShell organizationName={form?.organizationName}>
      <div className="grid gap-3">
        <CircleCheck aria-hidden className="size-6 text-success" />
        <h1 className="type-title text-foreground">{sent.title}</h1>
        <p className="text-sm text-muted-foreground">
          {form
            ? sent.body.replace("{organization}", form.organizationName)
            : sent.bodyGeneric}
        </p>
      </div>
    </PublicShell>
  );
}
