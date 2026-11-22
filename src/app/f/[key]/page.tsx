import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { PublicForm } from "@/components/public-forms/public-form";
import { PublicShell } from "@/components/public-forms/public-shell";
import { issueRenderToken, loadPublicForm } from "@/lib/public-forms/server";
import { getMessages } from "@/messages";

/** Public, shareable form: no sign-in; not indexed by search engines. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PublicFormPage({
  params,
}: PageProps<"/f/[key]">) {
  // Per request: the request id and render token must never be prerendered.
  await connection();
  const { key } = await params;
  const form = await loadPublicForm(key);
  const token = form ? issueRenderToken(key, form.formVersionId) : null;
  if (!form || !token) notFound();

  return (
    <PublicShell organizationName={form.organizationName}>
      <PublicForm
        form={form}
        publicKey={key}
        requestId={crypto.randomUUID()}
        token={token}
        copy={getMessages().publicForm}
      />
    </PublicShell>
  );
}
