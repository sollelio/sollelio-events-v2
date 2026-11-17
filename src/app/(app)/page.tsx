import type { Metadata } from "next";
import { CircleCheck, Clock } from "lucide-react";

import { countryName } from "@/lib/organizations/countries";
import { requireActiveOrganization } from "@/lib/organizations/context";
import { getMessages, LOCALE } from "@/messages";

export const metadata: Metadata = { title: getMessages().home.metaTitle };

/**
 * Operational Home (UX Blueprint §4–5) for an organization without requests
 * or events yet: the next action and an empty attention list. Nothing here is
 * invented; operational items will be projections of real records.
 */
export default async function HomePage() {
  const { organization } = await requireActiveOrganization();
  const { home, shell } = getMessages();

  return (
    // Page container (ADR 0007): the shell's main area is full width; pages
    // set the gutters and a wide cap. The empty-state grid below has its own,
    // narrower cap so the cards do not stretch on large screens.
    <div className="w-full max-w-[100rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <header className="mb-6 lg:mb-8">
        <p className="type-eyebrow text-muted-foreground">
          {organization.name} · {countryName(organization.countryCode, LOCALE)}
        </p>
        <h1 className="mt-2 type-display text-foreground">{home.title}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {home.description}
        </p>
      </header>

      <div className="grid max-w-[72rem] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section
          aria-labelledby="next-action-title"
          className="rounded-xl border border-border bg-card shadow-card"
        >
          <div className="p-5 sm:p-6">
            <p className="flex items-center gap-2 type-eyebrow text-muted-foreground">
              <span aria-hidden className="size-1.5 rounded-full bg-info" />
              {home.nextAction.eyebrow}
            </p>
            <h2
              id="next-action-title"
              className="mt-2.5 type-title text-foreground"
            >
              {home.nextAction.title}
            </h2>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              {home.nextAction.body}
            </p>
            {/* Informational, not a control: the action arrives with the
                inquiry step and will replace this note with a real button. */}
            <div className="mt-5 flex items-start gap-3 rounded-lg border border-dashed border-border-strong px-3.5 py-3 text-sm">
              <Clock
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              <p className="min-w-0 flex-1">
                <span className="block font-medium text-foreground">
                  {home.nextAction.action}
                </span>
                <span className="mt-0.5 block text-muted-foreground">
                  {home.nextAction.upcoming}
                </span>
              </p>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11.5px] text-muted-foreground">
                {shell.comingSoon}
              </span>
            </div>
          </div>

          <div className="border-t border-border px-5 py-5 sm:px-6">
            <h3 className="type-eyebrow text-muted-foreground">
              {home.journey.title}
            </h3>
            <ol className="mt-4 grid gap-4 sm:grid-cols-3 sm:gap-5">
              {home.journey.steps.map((step, index) => (
                <li key={step.title} className="flex gap-3 sm:block">
                  <span
                    aria-hidden
                    className="grid size-6 shrink-0 place-items-center rounded-full border border-border-strong text-[11.5px] font-semibold text-foreground tabular-nums sm:mb-2.5"
                  >
                    {index + 1}
                  </span>
                  <span className="block text-sm">
                    <span className="block font-medium text-foreground">
                      {step.title}
                    </span>
                    <span className="mt-0.5 block text-muted-foreground">
                      {step.body}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="attention-title"
          className="rounded-xl border border-border bg-card shadow-card"
        >
          <div className="p-5 sm:p-6">
            <h2
              id="attention-title"
              className="text-[14px] font-semibold tracking-[-0.01em] text-foreground"
            >
              {home.attention.title}
            </h2>
            <div className="mt-4 flex gap-3 rounded-lg bg-muted px-3.5 py-3 text-sm">
              <CircleCheck
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-success"
              />
              <p>
                <span className="block font-medium text-foreground">
                  {home.attention.empty}
                </span>
                <span className="mt-0.5 block text-muted-foreground">
                  {home.attention.hint}
                </span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
