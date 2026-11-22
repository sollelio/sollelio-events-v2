import { headers } from "next/headers";
import { ClipboardList, ExternalLink } from "lucide-react";

import { getActiveInquiryFormLink } from "@/lib/public-forms/queries";
import type { Messages } from "@/messages";

import {
  CopyLinkButton,
  EnablePublicFormButton,
  LinkManagement,
} from "./public-form-actions";

/** The request's own origin, for a shareable absolute link. */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.")
      ? "http"
      : "https");
  return `${proto}://${host}`;
}

/** Owner/Manager management of the public Inquiry form link (ADR 0009). */
export async function PublicFormCard({
  organizationId,
  copy,
}: {
  organizationId: string;
  copy: Messages["inquiries"]["publicFormCard"];
}) {
  const link = await getActiveInquiryFormLink(organizationId);
  const url = link ? `${await origin()}/f/${link.publicKey}` : null;

  return (
    <section
      aria-labelledby="public-form-title"
      className="mb-6 rounded-xl border border-border bg-card p-5 shadow-card sm:p-6"
    >
      <div className="flex items-start gap-3">
        <ClipboardList
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0 flex-1">
          <h2
            id="public-form-title"
            className="text-[14px] font-semibold tracking-[-0.01em] text-foreground"
          >
            {copy.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {link ? copy.onBody : copy.offBody}
          </p>
        </div>
      </div>

      <div className="mt-4">
        {link && url ? (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <p className="text-[12px] text-muted-foreground">
                {copy.linkLabel}
              </p>
              <p className="rounded-lg border border-border bg-muted px-3 py-2 font-mono text-[13px] break-all text-foreground select-all">
                {url}
              </p>
              <div className="flex flex-wrap gap-2">
                <CopyLinkButton url={url} copy={copy} />
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13.5px] font-medium text-foreground underline-offset-4 hover:underline"
                >
                  <ExternalLink aria-hidden className="size-4" />
                  {copy.open}
                </a>
              </div>
            </div>
            <LinkManagement linkId={link.id} copy={copy} />
          </div>
        ) : (
          <EnablePublicFormButton copy={copy} />
        )}
      </div>
    </section>
  );
}
