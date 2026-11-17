import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { OrganizationTile } from "@/components/app-shell/organization-tile";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { organizationChoice } from "@/lib/organizations/active-organization";
import { selectOrganization } from "@/lib/organizations/actions";
import { getActiveOrganization } from "@/lib/organizations/context";
import { countryName } from "@/lib/organizations/countries";
import { getMessages, LOCALE } from "@/messages";

export const metadata: Metadata = {
  title: getMessages().selectOrganization.metaTitle,
};

/**
 * Lists the viewer's organizations (active memberships, read under RLS) when
 * there is more than one. Choosing one posts its id to a Server Function that
 * checks it against the same list before storing the preference.
 */
export default async function SelectOrganizationPage() {
  const { viewer, resolution } = await getActiveOrganization();
  const choice = organizationChoice(viewer, resolution);
  if (choice.kind === "redirect") redirect(choice.to);
  if (choice.kind === "inconsistent" || viewer.status !== "verified") {
    throw new Error("Active membership without a readable organization");
  }

  const { selectOrganization: copy, common } = getMessages();

  return (
    <AuthShell title={copy.title} description={copy.description}>
      <ul className="grid gap-2">
        {choice.organizations.map((organization) => {
          const current = organization.id === choice.currentId;
          return (
            <li key={organization.id}>
              <form action={selectOrganization}>
                <input
                  type="hidden"
                  name="organizationId"
                  value={organization.id}
                />
                <button
                  type="submit"
                  aria-current={current ? "true" : undefined}
                  className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors duration-150 ease-standard hover:border-border-strong hover:bg-muted aria-[current=true]:border-border-strong aria-[current=true]:bg-muted"
                >
                  <OrganizationTile name={organization.name} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {organization.name}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">
                      {countryName(organization.countryCode, LOCALE)}
                    </span>
                  </span>
                  {current ? (
                    <span className="rounded-full border border-border-strong px-2 py-0.5 text-[11.5px] font-medium text-foreground">
                      {copy.current}
                    </span>
                  ) : (
                    <ChevronRight
                      aria-hidden
                      className="size-4 text-muted-foreground"
                    />
                  )}
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 grid gap-4 border-t border-border pt-5 text-sm">
        <p className="text-muted-foreground">
          {copy.signedInAs}{" "}
          <span className="font-medium break-all text-foreground">
            {viewer.email}
          </span>
        </p>
        <SignOutButton
          label={common.signOut}
          pendingLabel={common.signingOut}
        />
      </div>
    </AuthShell>
  );
}
