"use client";

import { createContext, useContext } from "react";
import type { Locale } from "@/messages/locales";
import type { Messages } from "@/messages/pt-PT";

const Ctx = createContext<{ locale: Locale; messages: Messages } | null>(null);

/** Gives client components the active locale and dictionary. */
export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ locale, messages }}>{children}</Ctx.Provider>;
}

function useCtx() {
  const v = useContext(Ctx);
  if (!v) throw new Error("LocaleProvider missing");
  return v;
}
export const useLocale = () => useCtx().locale;
export const useMessages = () => useCtx().messages;