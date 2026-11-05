import Image from "next/image";
import { cn } from "@/lib/utils";
import lockupOnLight from "./assets/sollelio-events-horizontal-color-outlined.svg";
import lockupOnDark from "./assets/sollelio-events-horizontal-mono-white-outlined.svg";

/*
 * Sollelio Events product identity. Files in ./assets are copied unmodified
 * from the official logo pack v1.0; never redraw, recolour or add effects.
 * This is the product's identity, not an organization's: it never takes the
 * organization brand colour.
 *
 * Both variants are rendered; `dark:` shows the one for the resolved theme.
 * Both load eagerly: the lockup is always above the fold (often the LCP), each
 * file is ~9 KB and immutable-cached, and switching theme is then instant.
 *
 * Dark backgrounds use the mono-white file. The pack's
 * "reverse-transparent-outlined" lockup is byte-identical to the
 * reverse-midnight file and carries an opaque #11152D background; swap the
 * import here once a corrected transparent file is supplied.
 *
 * Below ~140px of visible width the pack requires the isolated symbol; add it
 * here (from the same pack) when a screen needs it.
 */

const NAME = "Sollelio Events";

/** Lockup canvas (viewBox 430×120) includes the pack's clear space. */
const LOCKUP_RATIO = 120 / 430;
/** At 214px the visible lockup is ~140px, the pack's minimum. */
const LOCKUP_MIN_WIDTH = 214;

export function ProductLockup({
  width = LOCKUP_MIN_WIDTH,
  className,
}: {
  /** Canvas width in px; never below 214. */
  width?: number;
  className?: string;
}) {
  const canvas = Math.max(width, LOCKUP_MIN_WIDTH);
  const height = Math.round(canvas * LOCKUP_RATIO);
  return (
    <span className={cn("block", className)}>
      <Image
        src={lockupOnLight}
        alt={NAME}
        width={canvas}
        height={height}
        unoptimized
        loading="eager"
        className="dark:hidden"
      />
      <Image
        src={lockupOnDark}
        alt={NAME}
        width={canvas}
        height={height}
        unoptimized
        loading="eager"
        className="hidden dark:block"
      />
    </span>
  );
}
