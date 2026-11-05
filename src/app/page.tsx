import { AppearanceSwitcher } from "@/components/appearance/appearance-switcher";
import { ProductLockup } from "@/components/brand/product-logo";

export default function Page() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-card sm:p-8">
        <h1>
          {/* -ms-2 aligns the symbol, not the canvas's clear space, with the text. */}
          <ProductLockup width={260} className="-ms-2" />
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Design foundation only. Product screens are built with Vertical Slice
          1.
        </p>
        <div className="mt-8 border-t border-border pt-6">
          <AppearanceSwitcher />
        </div>
      </div>
    </main>
  );
}
