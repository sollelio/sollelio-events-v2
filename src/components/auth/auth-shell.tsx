import { AuthHeroSlider } from "@/components/auth/auth-hero-slider";
import { ProductLockup } from "@/components/brand/product-logo";

/**
 * Frame for authentication and account-entry screens.
 * - variant "card" (default): single-column card, used by check-email etc.
 * - variant "split": form on the left, hero slider on the right (sign-in / sign-up).
 */
export function AuthShell({
  title,
  description,
  eyebrow,
  children,
  footer,
  variant = "card",
  tabs,
}: {
  title: string;
  description?: React.ReactNode;
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  variant?: "card" | "split";
  tabs?: React.ReactNode;
}) {
  if (variant === "split") {
    return (
      <main className="grid min-h-svh bg-black font-[family-name:var(--font-auth)] text-white lg:grid-cols-[minmax(0,1fr)_minmax(420px,520px)]">
        <div className="relative flex flex-col px-6 py-10">
          <ProductLockup width={110} className="absolute start-6 top-6" />
         <div className="m-auto w-full max-w-[340px] animate-[auth-in_600ms_cubic-bezier(0.22,1,0.36,1)_both] pt-16">
            <h1 className="text-center text-[32px] font-medium leading-tight">
              {title}
            </h1>
            {description ? (
              <p className="mx-auto mt-4 max-w-[300px] text-center text-[15px] leading-snug text-white/80">
                {description}
              </p>
            ) : null}
            {tabs ? <div className="mt-8">{tabs}</div> : null}
            <div className="mt-8">{children}</div>
          </div>
        </div>
       <aside className="hidden py-6 pe-6 lg:block">
          <AuthHeroSlider />
        </aside>
      </main>
    );
  }

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