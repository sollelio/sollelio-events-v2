import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppearanceSwitcher } from "@/components/appearance/appearance-switcher";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getViewer } from "@/lib/auth/session";
import { destinationFor } from "@/lib/auth/viewer";
import { countryName } from "@/lib/organizations/countries";
import { getHomeOrganization } from "@/lib/organizations/queries";
import { getMessages, LOCALE } from "@/messages";

export const metadata: Metadata = { title: getMessages().home.metaTitle };

/**
 * Organization Home. Anonymous visitors go to sign-in, verified users without
 * an active membership to onboarding. Members see their organization; there
 * is no operational data yet, so none is shown.
 */
export default async function HomePage() {
  const viewer = await getViewer();
  const destination = destinationFor(viewer);
  if (viewer.status !== "verified" || destination !== "/") {
    redirect(destination);
  }

  // Readable only through an active membership (RLS).
  const organization = await getHomeOrganization();
  if (!organization) {
    // The membership was found but its organization is not readable: fail
    // closed instead of looping between Home and onboarding.
    throw new Error("Active membership without a readable organization");
  }

  const { home, common, appearance } = getMessages();

  return (
    <AuthShell
      eyebrow={home.eyebrow}
      title={organization.name}
      description={countryName(organization.countryCode, LOCALE)}
    >
      <div className="grid gap-4 text-sm">
        <p className="rounded-lg bg-muted px-3 py-2.5 text-muted-foreground">
          {home.empty}
        </p>
        <p className="text-muted-foreground">
          {home.signedInAs}{" "}
          <span className="font-medium break-all text-foreground">
            {viewer.email}
          </span>
        </p>
        <SignOutButton
          label={common.signOut}
          pendingLabel={common.signingOut}
        />
        <div className="mt-2 border-t border-border pt-5">
          <AppearanceSwitcher copy={appearance} />
        </div>
      </div>
    </AuthShell>
  );
}
