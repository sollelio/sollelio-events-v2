"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  House,
  Inbox,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Messages } from "@/messages";

type NavKey = keyof Messages["shell"]["nav"];

/**
 * The five approved destinations (UX Blueprint §3, §10). Only those with an
 * `href` exist; the others are shown as coming soon and are not links, so
 * there is nothing to follow and nothing to focus.
 */
const DESTINATIONS: {
  key: NavKey;
  Icon: LucideIcon;
  href?: string;
  /** Reached from the header menu on mobile. */
  desktopOnly?: boolean;
}[] = [
  { key: "home", Icon: House, href: "/" },
  { key: "inquiries", Icon: Inbox },
  { key: "events", Icon: CalendarDays },
  { key: "contacts", Icon: Users },
  { key: "settings", Icon: Settings, desktopOnly: true },
];

export function PrimaryNav({
  variant,
  copy,
}: {
  variant: "sidebar" | "bar";
  copy: Messages["shell"];
}) {
  const pathname = usePathname();
  const items =
    variant === "bar"
      ? DESTINATIONS.filter((item) => !item.desktopOnly)
      : DESTINATIONS;

  if (variant === "sidebar") {
    return (
      <nav aria-label={copy.primaryNavigation} className="px-3">
        <ul className="grid gap-0.5">
          {items.map(({ key, Icon, href }) => (
            <li key={key}>
              {href ? (
                <Link
                  href={href}
                  aria-current={pathname === href ? "page" : undefined}
                  className="relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-muted-foreground transition-colors duration-150 ease-standard hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-2 aria-[current=page]:before:-left-3 aria-[current=page]:before:w-0.5 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-primary"
                >
                  <Icon aria-hidden className="size-4" />
                  {copy.nav[key]}
                </Link>
              ) : (
                <span className="flex items-center gap-2.5 px-2.5 py-2 text-[13px] text-muted-foreground">
                  <Icon aria-hidden className="size-4 opacity-60" />
                  <span className="flex-1 opacity-80">{copy.nav[key]}</span>
                  <span className="rounded-full border border-border px-1.5 py-px text-[10.5px] leading-4">
                    {copy.comingSoon}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav
      aria-label={copy.primaryNavigation}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 ps-[env(safe-area-inset-left)] pe-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {items.map(({ key, Icon, href }) => (
          <li key={key}>
            {href ? (
              <Link
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className="relative flex min-h-(--app-bar-height) flex-col items-center justify-center gap-1 py-2 text-[11px] text-muted-foreground transition-colors duration-150 aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:before:absolute aria-[current=page]:before:top-0 aria-[current=page]:before:h-0.5 aria-[current=page]:before:w-8 aria-[current=page]:before:rounded-full aria-[current=page]:before:bg-primary"
              >
                <Icon aria-hidden className="size-5" />
                {copy.nav[key]}
              </Link>
            ) : (
              <span className="flex min-h-(--app-bar-height) flex-col items-center justify-center gap-1 py-2 text-[11px] text-muted-foreground">
                <Icon aria-hidden className="size-5 opacity-50" />
                <span className="opacity-70">{copy.nav[key]}</span>
                <span className="sr-only">({copy.comingSoon})</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
