import { cookies } from "next/headers";

import { en } from "./en";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./locales";
import { ptPT, type Messages } from "./pt-PT";

const dictionaries: Record<Locale, Messages> = { "pt-PT": ptPT, en };

/** Server only. Reads the visitor's saved language from the cookie. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getMessages(): Promise<Messages> {
  return dictionaries[await getLocale()];
}

export type { Messages, Locale };