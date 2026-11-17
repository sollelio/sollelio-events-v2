import { AppShell } from "@/components/app-shell/app-shell";
import { requireActiveOrganization } from "@/lib/organizations/context";

/**
 * Application shell for organization work. The layout resolves the active
 * organization to render the frame; each page resolves it again (memoised per
 * request) because layouts do not re-run on every navigation and are not an
 * authorization boundary.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { viewer, organization, canSwitch } = await requireActiveOrganization();

  return (
    <AppShell
      organization={organization}
      email={viewer.email}
      canSwitch={canSwitch}
    >
      {children}
    </AppShell>
  );
}
