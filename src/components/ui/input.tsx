import * as React from "react";
import { cn } from "cn";

/**
 * Text input (shadcn/ui contract, retuned to the tokens). 40px tall for touch;
 * 16px text below `sm` so iOS does not zoom on focus. The boundary uses the
 * `input` token (≥ 3:1); focus uses the global :focus-visible outline.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base text-foreground transition-[border-color,box-shadow] duration-150 ease-standard placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
