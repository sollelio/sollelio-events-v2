import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppearanceSwitcher } from "@/components/appearance/appearance-switcher";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { OrganizationForm } from "@/components/onboarding/organization-form";
import { getViewer } from "@/lib/auth/session";
import { countryOptions } from "@/lib/organizations/countries";
import { onboardingAccess } from "@/lib/organizations/onboarding";
import { getMessages, LOCALE } from "@/messages";

export const metadata: Metadata = { title: getMessages().onboarding.metaTitle };

/**
 * First organization: name and country. Only verified users without an
 * active membership reach the form; the Server Function checks again.
 */
export default async function OnboardingPage() {
  const access = onboardingAccess(await getViewer());
  if (!access.allowed) redirect(access.redirectTo);
  const { viewer } = access;

  const { onboarding, common, appearance } = getMessages();

  return (
    <AuthShell
      eyebrow={onboarding.eyebrow}
      title={onboarding.title}
      description={onboarding.description}
    >
      <OrganizationForm
        // One idempotency key per visit; retries of this form reuse it.
        requestId={crypto.randomUUID()}
        countries={countryOptions(LOCALE)}
        copy={onboarding}
      />
      <div className="mt-6 grid gap-4 border-t border-border pt-5 text-sm">
        <p className="text-muted-foreground">
          {onboarding.signedInAs}{" "}
          <span className="font-medium break-all text-foreground">
            {viewer.email}
          </span>
        </p>
        <SignOutButton
          label={common.signOut}
          pendingLabel={common.signingOut}
        />
        <AppearanceSwitcher copy={appearance} className="mt-1" />
      </div>
    </AuthShell>
  );
}
