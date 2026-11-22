import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Plus } from "lucide-react";

import { LocalDateTime } from "@/components/inquiries/local-date-time";
import { PublicFormCard } from "@/components/inquiries/public-form-card";
import { NoInquiryAccess, PageFrame } from "@/components/inquiries/page-frame";
import { InquiryOrigin } from "@/components/inquiries/source-icon";
import { Button } from "@/components/ui/button";
import {
  canAccessInquiries,
  eventDateAsUtc,
  snippet,
  type InquiryStatus,
} from "@/lib/inquiries/inquiry";
import {
  countInquiries,
  LIST_LIMIT,
  listInquiries,
} from "@/lib/inquiries/queries";
import { requireActiveOrganization } from "@/lib/organizations/context";
import { getMessages, LOCALE } from "@/messages";

export const metadata: Metadata = { title: getMessages().inquiries.metaTitle };

/** Open or closed inquiries of the active organization, newest first. */
export default async function InquiriesPage({
  searchParams,
}: PageProps<"/inquiries">) {
  const { organization } = await requireActiveOrganization();
  const { inquiries: copy } = getMessages();
  if (!canAccessInquiries(organization.role)) {
    return <NoInquiryAccess copy={copy} />;
  }

  const status: InquiryStatus =
    (await searchParams).status === "closed" ? "closed" : "open";
  const [{ inquiries, total }, counts] = await Promise.all([
    listInquiries(organization.id, status),
    countInquiries(organization.id),
  ]);
  const none = counts.open + counts.closed === 0;
  const eventDate = new Intl.DateTimeFormat(LOCALE, {
    dateStyle: "medium",
    timeZone: "UTC",
  });

  return (
    <PageFrame>
      <div className="max-w-[64rem]">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="type-display text-foreground">{copy.title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {copy.description}
            </p>
          </div>
          {none ? null : (
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/inquiries/new">
                <Plus aria-hidden />
                {copy.register}
              </Link>
            </Button>
          )}
        </header>

        <PublicFormCard
          organizationId={organization.id}
          copy={copy.publicFormCard}
        />

        {none ? (
          <section className="rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
            <Inbox aria-hidden className="size-6 text-muted-foreground" />
            <h2 className="mt-3 type-title text-foreground">
              {copy.list.emptyFirstTitle}
            </h2>
            <p className="mt-1.5 max-w-prose text-sm text-muted-foreground">
              {copy.list.emptyFirstBody}
            </p>
            <Button asChild size="lg" className="mt-5 w-full sm:w-auto">
              <Link href="/inquiries/new">
                <Plus aria-hidden />
                {copy.registerFirst}
              </Link>
            </Button>
          </section>
        ) : (
          <>
            <nav
              aria-label={copy.list.tabsLabel}
              className="mb-4 flex gap-6 border-b border-border text-[13.5px]"
            >
              {(["open", "closed"] as const).map((tab) => (
                <Link
                  key={tab}
                  href={
                    tab === "open" ? "/inquiries" : "/inquiries?status=closed"
                  }
                  aria-current={tab === status ? "page" : undefined}
                  className="relative -mb-px flex items-center gap-1.5 rounded-sm py-3 font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-0 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded-full aria-[current=page]:after:bg-primary"
                >
                  {tab === "open" ? copy.list.openTab : copy.list.closedTab}
                  <span className="rounded-full bg-muted px-1.5 text-[11.5px] text-muted-foreground tabular-nums">
                    {counts[tab]}
                  </span>
                </Link>
              ))}
            </nav>

            {inquiries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted-foreground">
                {status === "open"
                  ? copy.list.emptyOpen
                  : copy.list.emptyClosed}
              </p>
            ) : (
              <ul className="grid gap-2.5">
                {inquiries.map((inquiry) => (
                  <li key={inquiry.id}>
                    <Link
                      href={`/inquiries/${inquiry.id}`}
                      className="block rounded-xl border border-border bg-card p-4 shadow-card transition-colors duration-150 ease-standard hover:border-border-strong sm:px-5"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                        <p className="min-w-0 truncate font-medium text-foreground">
                          {inquiry.requesterName ?? copy.list.noName}
                        </p>
                        <p className="text-[12.5px] text-muted-foreground tabular-nums">
                          <LocalDateTime
                            value={inquiry.receivedAt}
                            format="short"
                          />
                        </p>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {inquiry.clientMessage
                          ? `“${snippet(inquiry.clientMessage)}”`
                          : `${copy.list.summaryPrefix} ${snippet(inquiry.staffSummary)}`}
                      </p>
                      <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <InquiryOrigin
                            source={inquiry.source}
                            channel={inquiry.submissionChannel}
                            labels={{
                              sources: copy.sources,
                              publicForm: copy.channels.public_form,
                            }}
                          />
                        </span>
                        {inquiry.requestedEventDate ? (
                          <span>
                            {eventDate.format(
                              eventDateAsUtc(inquiry.requestedEventDate),
                            )}
                          </span>
                        ) : null}
                        {inquiry.estimatedGuests ? (
                          <span className="tabular-nums">
                            {inquiry.estimatedGuests} {copy.list.guests}
                          </span>
                        ) : null}
                        {inquiry.closeReason ? (
                          <span className="rounded-full border border-border px-2 py-px">
                            {copy.closeReasons[inquiry.closeReason]}
                          </span>
                        ) : null}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {total > LIST_LIMIT ? (
              <p className="mt-4 text-[12.5px] text-muted-foreground">
                {copy.list.truncated
                  .replace("{shown}", String(LIST_LIMIT))
                  .replace("{total}", String(total))}
              </p>
            ) : null}
          </>
        )}
      </div>
    </PageFrame>
  );
}
