"use client";

import { useId, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  readAppearance,
  setAppearance,
  subscribeAppearance,
  switcherPrePaintScript,
  type Appearance,
} from "./appearance";

const options = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
  { value: "system", Icon: Monitor },
] as const satisfies readonly {
  value: Appearance;
  Icon: LucideIcon;
}[];

/** Interface copy, supplied by the caller from the active locale's messages. */
export type AppearanceSwitcherCopy = Record<Appearance | "legend", string>;

/** Segmented choice of the user's appearance preference (native radios). */
export function AppearanceSwitcher({
  copy,
  className,
}: {
  copy: AppearanceSwitcherCopy;
  className?: string;
}) {
  const appearance = useSyncExternalStore(
    subscribeAppearance,
    readAppearance,
    () => "system" as const,
  );
  const groupId = useId();

  return (
    <fieldset id={groupId} className={cn("min-w-0", className)}>
      <legend className="mb-2 type-eyebrow text-muted-foreground">
        {copy.legend}
      </legend>
      {/* Track sits below the surface, the selected thumb above it, in both themes. */}
      <div className="inline-flex rounded-full border border-border bg-muted p-0.5 dark:bg-background">
        {options.map(({ value, Icon }) => (
          <label key={value} className="relative">
            <input
              type="radio"
              name="appearance"
              value={value}
              checked={appearance === value}
              // Only the checked option is a tab stop, as in a native radio
              // group; focus traps that loop (menus) then re-enter it there.
              // Arrow keys still move between options.
              tabIndex={appearance === value ? 0 : -1}
              onChange={() => setAppearance(value)}
              className="peer sr-only"
            />
            <span className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-muted-foreground transition-[color,background-color,box-shadow] duration-150 ease-standard peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-card peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring hover:text-foreground dark:peer-checked:bg-muted">
              <Icon aria-hidden className="size-3.5" />
              {copy[value]}
            </span>
          </label>
        ))}
      </div>
      {/* Pre-paint correction of the checked option on full page loads. On the
          client the type is text/plain, so React never runs it (Next.js
          "Preventing flash before hydration" guide). */}
      <script
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: switcherPrePaintScript(groupId) }}
      />
    </fieldset>
  );
}
