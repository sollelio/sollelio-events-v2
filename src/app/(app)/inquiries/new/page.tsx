import type { Metadata } from "next";
import { connection } from "next/server";

import { InquiryForm } from "@/components/inquiries/inquiry-form";
import {
  BackLink,
  NoInquiryAccess,
  PageFrame,
} from "@/components/inquiries/page-frame";
import { canAccessInquiries } from "@/lib/inquiries/inquiry";
import { requireActiveOrganization } from "@/lib/organizations/context";
import { getMessages } from "@/messages";

export const metadata: Metadata = {
  title: getMessages().inquiries.form.metaTitle,
};

export default async function NewInquiryPage() {
  // Always per request: the idempotency key below must never be prerendered
  // and shared.
  await connection();
  const { organization } = await requireActiveOrganization();
  const { inquiries: copy } = getMessages();
  if (!canAccessInquiries(organization.role)) {
    return <NoInquiryAccess copy={copy} />;
  }

  return (
    <PageFrame>
      <div className="max-w-2xl">
        <BackLink href="/inquiries" label={copy.form.back} />
        <header className="mb-6">
          <h1 className="type-display text-foreground">{copy.form.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {copy.form.description}
          </p>
        </header>
        <div className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
          {/* One idempotency key per visit; retries of this form reuse it. */}
          <InquiryForm requestId={crypto.randomUUID()} copy={copy} />
        </div>
      </div>
    </PageFrame>
  );
}
