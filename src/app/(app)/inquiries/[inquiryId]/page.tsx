import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormMessage } from "@/components/auth/form-message";
import { ClientMessage } from "@/components/inquiries/client-message";
import { LocalDateTime } from "@/components/inquiries/local-date-time";
import {
  BackLink,
  NoInquiryAccess,
  PageFrame,
} from "@/components/inquiries/page-frame";
import { SourceIcon } from "@/components/inquiries/source-icon";
import {
  CloseInquiryForm,
  ReopenInquiryForm,
} from "@/components/inquiries/status-forms";
import { canAccessInquiries, eventDateAsUtc } from "@/lib/inquiries/inquiry";
import { getInquiry } from "@/lib/inquiries/queries";
import { requireActiveOrganization } from "@/lib/organizations/context";
import { getMessages, LOCALE } from "@/messages";

export const metadata: Metadata = { title: getMessages().inquiries.metaTitle };

const NOTICES = ["registered", "closed", "reopened"] as const;
type Notice = (typeof NOTICES)[number];

const card = "rounded-xl border border-border bg-card shadow-card";
const cardTitle =
  "text-[14px] font-semibold tracking-[-0.01em] text-foreground";

/**
 * One inquiry of the active organization. Anything else, including an
 * inquiry of another organization the viewer belongs to, is not found.
 */
export default async function InquiryPage({
  params,
  searchParams,
}: PageProps<"/inquiries/[inquiryId]">) {
  const { organization, viewer } = await requireActiveOrganization();
  const { inquiries: copy } = getMessages();
  if (!canAccessInquiries(organization.role)) {
    return <NoInquiryAccess copy={copy} />;
  }

  const inquiry = await getInquiry(organization.id, (await params).inquiryId);
  if (!inquiry) notFound();

  const noticeParam = (await searchParams).notice;
  const notice = NOTICES.find(
    (value): value is Notice => value === noticeParam,
  );
  const t = copy.detail;
  const closed = inquiry.status === "closed";
  const hasRequester =
    inquiry.requesterName || inquiry.requesterPhone || inquiry.requesterEmail;

  return (
    <PageFrame>
      <div className="max-w-[72rem]">
        <BackLink href="/inquiries" label={t.back} />

        <header className="mb-6">
          <p className="flex items-center gap-1.5 type-eyebrow text-muted-foreground">
            <SourceIcon source={inquiry.source} className="size-3.5" />
            {t.eyebrow} · {copy.sources[inquiry.source]}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="min-w-0 type-display break-words text-foreground">
              {inquiry.requesterName ?? t.noName}
            </h1>
            <span
              className={
                closed
                  ? "rounded-full border border-border-strong px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground"
                  : "rounded-full bg-info-soft px-2.5 py-0.5 text-[12px] font-medium text-foreground"
              }
            >
              {copy.statuses[inquiry.status]}
              {closed && inquiry.closeReason
                ? ` · ${copy.closeReasons[inquiry.closeReason]}`
                : ""}
            </span>
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span>
              {t.receivedAt} <LocalDateTime value={inquiry.receivedAt} />
            </span>
            <span>
              {t.registeredAt} <LocalDateTime value={inquiry.createdAt} />
              {inquiry.createdBy === viewer.userId ? ` ${t.byYou}` : ""}
            </span>
          </p>
        </header>

        {notice ? (
          <div className="mb-5 max-w-xl">
            <FormMessage tone="notice">{t.notices[notice]}</FormMessage>
          </div>
        ) : null}

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-5">
          <div className="grid gap-4 lg:gap-5">
            {inquiry.clientMessage ? (
              <section aria-labelledby="client-message" className={card}>
                <div className="p-5 sm:p-6">
                  <h2 id="client-message" className={cardTitle}>
                    {t.clientMessage}
                  </h2>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {t.clientMessageNote}
                  </p>
                  <blockquote className="mt-4 border-s-2 border-border-strong ps-4">
                    <ClientMessage>{inquiry.clientMessage}</ClientMessage>
                  </blockquote>
                </div>
              </section>
            ) : null}
            {inquiry.staffSummary ? (
              <section aria-labelledby="staff-summary" className={card}>
                <div className="p-5 sm:p-6">
                  <h2 id="staff-summary" className={cardTitle}>
                    {t.staffSummary}
                  </h2>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {t.staffSummaryNote}
                  </p>
                  <p className="mt-4 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
                    {inquiry.staffSummary}
                  </p>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="grid gap-4 lg:gap-5">
            <section aria-labelledby="requester" className={card}>
              <div className="p-5">
                <h2 id="requester" className={cardTitle}>
                  {t.requester}
                </h2>
                {hasRequester ? (
                  <dl className="mt-3 grid gap-2.5 text-sm">
                    {inquiry.requesterName ? (
                      <Detail label={copy.form.requesterName}>
                        {inquiry.requesterName}
                      </Detail>
                    ) : null}
                    {inquiry.requesterPhone ? (
                      <Detail label={copy.form.requesterPhone}>
                        <a
                          href={`tel:${inquiry.requesterPhone.replace(/[^\d+]/g, "")}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {inquiry.requesterPhone}
                        </a>
                      </Detail>
                    ) : null}
                    {inquiry.requesterEmail ? (
                      <Detail label={copy.form.requesterEmail}>
                        <a
                          href={`mailto:${inquiry.requesterEmail}`}
                          className="break-all underline-offset-4 hover:underline"
                        >
                          {inquiry.requesterEmail}
                        </a>
                      </Detail>
                    ) : null}
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t.requesterNone}
                  </p>
                )}
              </div>
            </section>

            <section aria-labelledby="event" className={card}>
              <div className="p-5">
                <h2 id="event" className={cardTitle}>
                  {t.event}
                </h2>
                {inquiry.requestedEventDate || inquiry.estimatedGuests ? (
                  <dl className="mt-3 grid gap-2.5 text-sm">
                    {inquiry.requestedEventDate ? (
                      <Detail label={t.eventDate}>
                        {new Intl.DateTimeFormat(LOCALE, {
                          dateStyle: "long",
                          timeZone: "UTC",
                        }).format(eventDateAsUtc(inquiry.requestedEventDate))}
                      </Detail>
                    ) : null}
                    {inquiry.estimatedGuests ? (
                      <Detail label={t.guests}>
                        <span className="tabular-nums">
                          {inquiry.estimatedGuests}
                        </span>
                      </Detail>
                    ) : null}
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {t.eventNone}
                  </p>
                )}
              </div>
            </section>

            <section aria-labelledby="status" className={card}>
              <div className="p-5">
                <h2 id="status" className={cardTitle}>
                  {closed ? t.status : t.closeTitle}
                </h2>
                {closed && inquiry.closedAt && inquiry.closeReason ? (
                  <dl className="mt-3 mb-4 grid gap-2.5 text-sm">
                    <Detail label={t.closedOn}>
                      <LocalDateTime value={inquiry.closedAt} />
                    </Detail>
                    <Detail label={t.reason}>
                      {copy.closeReasons[inquiry.closeReason]}
                    </Detail>
                  </dl>
                ) : null}
                <div className={closed ? "" : "mt-3"}>
                  {closed ? (
                    <ReopenInquiryForm inquiryId={inquiry.id} copy={copy} />
                  ) : (
                    <CloseInquiryForm inquiryId={inquiry.id} copy={copy} />
                  )}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </PageFrame>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-foreground">{children}</dd>
    </div>
  );
}
