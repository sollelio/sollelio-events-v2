
"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

const deviceTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

const deviceLocale = () => navigator.language;

const serverTimeZone = () => "UTC";
const serverLocale = () => "en";

const FORMATS = {
  full: { dateStyle: "medium", timeStyle: "short" },
  short: {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/**
 * An instant (stored in UTC) shown in the device's time zone.
 * The server renders using UTC and English; the client updates
 * to the device's time zone and locale after hydration.
 */
export function LocalDateTime({
  value,
  format = "full",
}: {
  value: string;
  format?: keyof typeof FORMATS;
}) {
  const timeZone = useSyncExternalStore(
    noSubscription,
    deviceTimeZone,
    serverTimeZone,
  );

  const locale = useSyncExternalStore(
    noSubscription,
    deviceLocale,
    serverLocale,
  );

  const text = new Intl.DateTimeFormat(locale, {
    ...FORMATS[format],
    timeZone,
  }).format(new Date(value));

  return <time dateTime={value}>{text}</time>;
}
