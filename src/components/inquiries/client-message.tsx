import { Newsreader } from "next/font/google";

import { cn } from "@/lib/utils";

/*
 * Newsreader is reserved for editorial content such as a client's own words
 * (ADR 0002). It is loaded only where a verbatim client message is shown.
 */
const newsreader = Newsreader({ subsets: ["latin"], display: "swap" });

/** A client's message exactly as received: line breaks kept, never parsed. */
export function ClientMessage({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        newsreader.className,
        "text-[17px] leading-relaxed break-words whitespace-pre-wrap text-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
