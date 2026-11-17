import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppearanceSwitcher } from "@/components/appearance/appearance-switcher";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireVerifiedViewer } from "@/lib/auth/session";
import { getMessages } from "@/messages";

export const metadata: Metadata = { title: getMessages().onboarding.metaTitle };

/**
 * Entry state for a verified user without an active membership. Organization
 * creation is a later step.
 */
export default async function OnboardingPage() {
  const viewer = await requireVerifiedViewer("/onboarding");
  if (viewer.hasActiveMembership) {
    redirect("/");
  }

  const { onboarding, common, appearance } = getMessages();

  return (
    <AuthShell eyebrow={onboarding.eyebrow} title={onboarding.title}>
      <div className="grid gap-4 text-sm">
        <p className="text-muted-foreground">
          {onboarding.signedInAs}{" "}
          <span className="font-medium break-all text-foreground">
            {viewer.email}
          </span>
        </p>
        <p className="text-foreground">{onboarding.body}</p>
        <p className="rounded-lg bg-muted px-3 py-2.5 text-muted-foreground">
          {onboarding.comingSoon}
        </p>
        <div className="mt-2">
          <SignOutButton
            label={common.signOut}
            pendingLabel={common.signingOut}
          />
        </div>
        <div className="mt-2 border-t border-border pt-5">
          <AppearanceSwitcher copy={appearance} />
        </div>
      </div>
    </AuthShell>
  );
}
