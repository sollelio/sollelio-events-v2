import Link from "next/link";
import { ChevronsUpDown } from "lucide-react";

import { ProductLockup, ProductSymbol } from "@/components/brand/product-logo";
import {
  SELECT_ORGANIZATION_PATH,
  type OrganizationSummary,
} from "@/lib/organizations/active-organization";
import { getMessages } from "@/messages";

import { AccountMenu } from "./account-menu";
import { OrganizationTile } from "./organization-tile";
import { PrimaryNav } from "./primary-nav";

/**
 * Authenticated application frame (UX Blueprint §10). Desktop: sidebar with
 * the five destinations. Mobile: header with the organization and the account
 * menu, and a bottom bar with Home, Pedidos, Eventos and Contactos.
 *
 * Presentation only: every page inside it verifies the viewer and the active
 * organization on the server itself.
 */
export function AppShell({
  organization,
  email,
  canSwitch,
  children,
}: {
  organization: OrganizationSummary;
  email: string;
  canSwitch: boolean;
  children: React.ReactNode;
}) {
  const { shell, appearance, common } = getMessages();
  const switchHref = canSwitch ? SELECT_ORGANIZATION_PATH : undefined;
  const menuCopy = { shell, appearance, common };

  return (
    <div data-app-shell className="min-h-svh lg:flex">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-card px-3 py-2 text-sm font-medium text-foreground shadow-raised focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {shell.skipToContent}
      </a>

      <aside className="sticky top-0 hidden h-svh w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="px-4 pt-4">
          {/* -ms-2 aligns the symbol, not the canvas's clear space. */}
          <ProductLockup className="-ms-2" />
        </div>

        <div className="mx-3 mt-2 mb-4">
          {switchHref ? (
            <Link
              href={switchHref}
              className="flex items-center gap-2.5 rounded-lg border border-border p-2 transition-colors duration-150 ease-standard hover:border-border-strong hover:bg-muted"
            >
              <OrganizationTile name={organization.name} />
              <OrganizationLabel
                label={shell.organization}
                name={organization.name}
              />
              <span className="sr-only">{shell.switchOrganization}</span>
              <ChevronsUpDown
                aria-hidden
                className="size-3.5 text-muted-foreground"
              />
            </Link>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg border border-border p-2">
              <OrganizationTile name={organization.name} />
              <OrganizationLabel
                label={shell.organization}
                name={organization.name}
              />
            </div>
          )}
        </div>

        <PrimaryNav variant="sidebar" copy={shell} />

        <div className="mt-auto border-t border-sidebar-border p-3">
          <AccountMenu
            variant="sidebar"
            email={email}
            switchOrganizationHref={switchHref}
            copy={menuCopy}
          />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile header: product symbol (the lockup's minimum does not fit),
            the organization, and the account menu. Height and padding include
            the safe-area insets. */}
        <header className="sticky top-0 z-30 flex h-[calc(var(--app-header-height)+env(safe-area-inset-top))] items-center gap-3 border-b border-border bg-card/90 ps-[max(1rem,env(safe-area-inset-left))] pe-[max(0.375rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
          <ProductSymbol size={28} />
          <span aria-hidden className="h-5 w-px shrink-0 bg-border-strong" />
          <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-foreground">
            <span className="sr-only">{shell.organization}: </span>
            {organization.name}
          </p>
          <AccountMenu
            variant="header"
            email={email}
            switchOrganizationHref={switchHref}
            copy={menuCopy}
          />
        </header>

        {/* Below lg, the bottom padding clears the fixed bar, its safe-area
            inset and a margin, so the end of every page stays visible. */}
        <main
          id="main"
          tabIndex={-1}
          className="ps-[env(safe-area-inset-left)] pe-[env(safe-area-inset-right)] pb-[calc(var(--app-bar-height)+env(safe-area-inset-bottom)+1.5rem)] outline-none lg:pb-0"
        >
          {children}
        </main>
      </div>

      <PrimaryNav variant="bar" copy={shell} />
    </div>
  );
}

function OrganizationLabel({ label, name }: { label: string; name: string }) {
  return (
    <span className="min-w-0 flex-1 leading-tight">
      <span className="block text-[11px] text-muted-foreground">{label}</span>
      <span className="block truncate text-[13px] font-semibold text-foreground">
        {name}
      </span>
    </span>
  );
}
