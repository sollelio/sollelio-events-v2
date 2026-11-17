"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowLeftRight, ChevronsUpDown, Settings } from "lucide-react";
import { Popover } from "radix-ui";

import { AppearanceSwitcher } from "@/components/appearance/appearance-switcher";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { Messages } from "@/messages";

function initial(email: string): string {
  return (Array.from(email)[0] ?? "?").toLocaleUpperCase();
}

/**
 * The signed-in user and their personal preferences. Appearance lives here:
 * it belongs to the user and device, not to the organization.
 */
export function AccountMenu({
  variant,
  email,
  switchOrganizationHref,
  copy,
}: {
  variant: "sidebar" | "header";
  email: string;
  /** Present only when the viewer has more than one organization. */
  switchOrganizationHref?: string;
  copy: Pick<Messages, "shell" | "appearance" | "common">;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const avatar = (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-[12px] font-semibold text-foreground"
    >
      {initial(email)}
    </span>
  );

  return (
    <Popover.Root>
      <Popover.Trigger
        // The avatar-only trigger needs a label; the sidebar one shows the
        // email, which must stay part of its accessible name.
        aria-label={variant === "header" ? copy.shell.account : undefined}
        className={
          variant === "sidebar"
            ? "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors duration-150 ease-standard hover:bg-muted data-[state=open]:bg-muted"
            : "grid size-11 place-items-center rounded-lg transition-colors duration-150 ease-standard hover:bg-muted data-[state=open]:bg-muted"
        }
      >
        {avatar}
        {variant === "sidebar" ? (
          <>
            <span className="sr-only">{copy.shell.account}: </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground">
              {email}
            </span>
            <ChevronsUpDown
              aria-hidden
              className="size-3.5 text-muted-foreground"
            />
          </>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={variant === "sidebar" ? "top" : "bottom"}
          align={variant === "sidebar" ? "start" : "end"}
          sideOffset={8}
          collisionPadding={16}
          ref={contentRef}
          // Focus the panel itself: Tab then follows reading order, and the
          // radio group is entered at its checked option, not its first one.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current?.focus();
          }}
          tabIndex={-1}
          className="z-50 grid w-[min(20rem,calc(100vw-2rem))] gap-3 rounded-xl border border-border bg-popover p-3 text-sm text-popover-foreground shadow-raised outline-none"
        >
          <Popover.Title className="sr-only">
            {copy.shell.account}
          </Popover.Title>
          <p className="px-1 text-muted-foreground">
            {copy.shell.signedInAs}{" "}
            <span className="font-medium break-all text-foreground">
              {email}
            </span>
          </p>

          <div className="grid gap-0.5 border-t border-border pt-2">
            {switchOrganizationHref ? (
              <Link
                href={switchOrganizationHref}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-foreground transition-colors duration-150 hover:bg-muted"
              >
                <ArrowLeftRight aria-hidden className="size-4" />
                {copy.shell.switchOrganization}
              </Link>
            ) : null}
            {/* Settings is reached from here on mobile (Blueprint §10). */}
            <span className="flex items-center gap-2.5 px-2 py-2 text-muted-foreground">
              <Settings aria-hidden className="size-4 opacity-60" />
              <span className="flex-1 opacity-80">
                {copy.shell.nav.settings}
              </span>
              <span className="rounded-full border border-border px-1.5 py-px text-[10.5px] leading-4">
                {copy.shell.comingSoon}
              </span>
            </span>
          </div>

          <div className="border-t border-border px-1 pt-3">
            <AppearanceSwitcher copy={copy.appearance} />
          </div>

          <div className="border-t border-border pt-3">
            <SignOutButton
              label={copy.common.signOut}
              pendingLabel={copy.common.signingOut}
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
