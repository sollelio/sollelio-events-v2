"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { LOCALE_COOKIE, type Locale } from "@/messages/locales";

/** EN | PT toggle. Saves the choice in a cookie (1 year) and re-renders. */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isPt = locale === "pt-PT";

  function toggle() {
    const next: Locale = isPt ? "en" : "pt-PT";
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPt}
      aria-label="Language / Idioma"
      title={isPt ? "Switch to English" : "Mudar para Português"}
      onClick={toggle}
      disabled={pending}
      className="fixed end-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] grid h-8 w-[76px] grid-cols-2 items-center rounded-full border border-border-strong bg-card/80 text-[11px] font-semibold tracking-wide backdrop-blur press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0.5 w-[calc(50%-2px)] rounded-full bg-foreground transition-[left] duration-200 ease-standard",
          isPt ? "left-[50%]" : "left-0.5",
        )}
      />
      <span className={cn("relative text-center", !isPt ? "text-background" : "text-muted-foreground")}>EN</span>
      <span className={cn("relative text-center", isPt ? "text-background" : "text-muted-foreground")}>PT</span>
    </button>
  );
}