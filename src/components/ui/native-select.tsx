import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";

/**
 * Native <select>, styled like Input: 40px, 16px text below `sm`, the `input`
 * boundary token and the global focus ring. Native for long lists: it is
 * accessible, searchable by typing, and uses the platform picker on mobile.
 * An option with an empty value acts as the placeholder and is shown muted.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "h-10 w-full min-w-0 appearance-none rounded-lg border border-input bg-card ps-3 pe-9 text-base text-foreground transition-[border-color,box-shadow] duration-150 ease-standard disabled:cursor-not-allowed disabled:opacity-50 has-[option[value='']:checked]:text-muted-foreground aria-invalid:border-destructive sm:text-sm [&_option]:text-foreground",
          className,
        )}
        {...props}
      />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}

export { NativeSelect };
