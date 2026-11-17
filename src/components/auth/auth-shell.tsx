import { ProductLockup } from "@/components/brand/product-logo";

/**
 * Single-column frame for authentication and account-entry screens. Mobile
 * first: full-width card with a 16px gutter, centred from `sm` up.
 */
export function AuthShell({
  title,
  description,
  eyebrow,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    // Gutters never go below the device's safe-area insets (viewport-fit=cover).
    <main className="flex min-h-svh flex-col items-center ps-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))] pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:justify-center sm:pt-[max(3rem,env(safe-area-inset-top))] sm:pb-[max(3rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        {/* -ms-2 aligns the symbol, not the canvas's clear space, with the card. */}
        <ProductLockup width={214} className="-ms-2 mb-6" />
        <div className="rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
          {eyebrow ? (
            <p className="mb-2 type-eyebrow text-muted-foreground">{eyebrow}</p>
          ) : null}
          <h1 className="type-title text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1.5 text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </div>
    </main>
  );
}
