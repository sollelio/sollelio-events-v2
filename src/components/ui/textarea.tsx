import * as React from "react";
import { cn } from "cn";

/**
 * Multi-line text input, styled like Input: 16px text below `sm` (no iOS
 * zoom), the `input` boundary token, the global focus ring. Resizes
 * vertically only.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-28 w-full min-w-0 resize-y rounded-lg border border-input bg-card px-3 py-2.5 text-base leading-relaxed text-foreground transition-[border-color,box-shadow] duration-150 ease-standard placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
