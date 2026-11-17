import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

import type { Messages } from "@/messages";

/** Page container (ADR 0007): full-width main, page gutters and a wide cap. */
export function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[100rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      {children}
    </div>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="-ms-1 mb-4 inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {label}
    </Link>
  );
}

/** Members have no inquiry access until assignment exists (ADR 0008). */
export function NoInquiryAccess({ copy }: { copy: Messages["inquiries"] }) {
  return (
    <PageFrame>
      <div className="max-w-xl rounded-xl border border-border bg-card p-5 shadow-card sm:p-6">
        <div className="flex gap-3">
          <Lock
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
          />
          <div>
            <h1 className="type-title text-foreground">
              {copy.noAccess.title}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {copy.noAccess.body}
            </p>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
