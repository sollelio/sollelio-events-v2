"use client";

import { useSyncExternalStore } from "react";

import { LOCALE } from "@/messages";

const noSubscription = () => () => {};
const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimeZone = () => "UTC";

const FORMATS = {
  full: { dateStyle: "medium", timeStyle: "short" },
  short: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

/**
 * An instant (stored in UTC) shown in the device's time zone. The organization
 * time zone is a future setting (ADR 0008). The server renders UTC; the
 * client re-renders with the device zone right after hydration.
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
  const text = new Intl.DateTimeFormat(LOCALE, {
    ...FORMATS[format],
    timeZone,
  }).format(new Date(value));
  return <time dateTime={value}>{text}</time>;
}
