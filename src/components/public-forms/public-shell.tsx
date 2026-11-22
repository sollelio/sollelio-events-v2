import { getMessages } from "@/messages";

/**
 * Frame for client-facing public forms. The organization leads; the product
 * appears only as a quiet footer. Organization branding (logo, colour) is a
 * later setting. Gutters respect the device's safe areas.
 */
export function PublicShell({
  organizationName,
  children,
}: {
  organizationName?: string;
  children: React.ReactNode;
}) {
  const { publicForm } = getMessages();
  return (
    <main className="flex min-h-svh flex-col items-center ps-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:pt-[max(3rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-xl">
        {organizationName ? (
          <p className="mb-4 text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            {organizationName}
          </p>
        ) : null}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card sm:p-8">
          {children}
        </div>
        <p className="mt-6 text-center text-[12px] text-muted-foreground">
          {publicForm.poweredBy}
        </p>
      </div>
    </main>
  );
}
