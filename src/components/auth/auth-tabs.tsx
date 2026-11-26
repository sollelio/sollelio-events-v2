"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const KEY = "auth-tab-from";
type Tab = "sign-in" | "sign-up";
const idx = (t: Tab) => (t === "sign-up" ? 1 : 0);

/**
 * Sliding pill. Sign-in and sign-up are separate pages, so the component
 * remounts on navigation: we remember the previous tab in sessionStorage and
 * slide the pill from there to the active tab on mount.
 */
export function AuthTabs({
  active,
  labels,
}: {
  active: Tab;
  labels: { signIn: string; signUp: string };
}) {
  const [pos, setPos] = useState(idx(active));
  const [animated, setAnimated] = useState(false);

  useLayoutEffect(() => {
    let from: string | null = null;
    try {
      from = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch {}
    const target = idx(active);
    if ((from === "sign-in" || from === "sign-up") && idx(from) !== target) {
      setPos(idx(from));
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setAnimated(true);
          setPos(target);
        }),
      );
    } else {
      setAnimated(true);
    }
  }, [active]);

  const remember = () => {
    try {
      sessionStorage.setItem(KEY, active);
    } catch {}
  };

  const item = (i: number) =>
    cn(
      "relative z-10 flex h-11 items-center justify-center rounded-full text-[15px] font-medium transition-colors duration-300",
      pos === i ? "text-black" : "text-white/80 hover:text-white",
    );

  return (
    <nav className="relative grid grid-cols-2 rounded-full border border-white/25 bg-black p-1">
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 start-1 w-[calc(50%-4px)] rounded-full bg-white shadow-[0_4px_16px_-4px_rgba(255,255,255,0.35)]",
          animated &&
            "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        )}
        style={{ transform: `translateX(${pos * 100}%)` }}
      />
      <Link
        href="/sign-in"
        onClick={remember}
        className={item(0)}
        aria-current={active === "sign-in" ? "page" : undefined}
      >
        {labels.signIn}
      </Link>
      <Link
        href="/sign-up"
        onClick={remember}
        className={item(1)}
        aria-current={active === "sign-up" ? "page" : undefined}
      >
        {labels.signUp}
      </Link>
    </nav>
  );
}