import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppearanceSwitcher } from "@/components/appearance/appearance-switcher";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getViewer } from "@/lib/auth/session";
import { destinationFor } from "@/lib/auth/viewer";
import { getMessages } from "@/messages";

export const metadata: Metadata = { title: getMessages().home.metaTitle };

/**
 * Application entry. Anonymous visitors go to sign-in, verified users without
 * an active membership to onboarding. Members see a placeholder until the
 * workspace exists.
 */
export default async function HomePage() {
  const viewer = await getViewer();
  const destination = destinationFor(viewer);
  if (viewer.status !== "verified" || destination !== "/") {
    redirect(destination);
  }

  const { home, common, appearance } = getMessages();

  return (
    <AuthShell title={home.title} description={home.body}>
      <div className="grid gap-4">
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
