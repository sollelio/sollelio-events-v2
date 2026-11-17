import { monogram } from "@/lib/organizations/active-organization";
import { cn } from "@/lib/utils";

/**
 * The organization's mark: its initials on the organization brand colour.
 * Branding uploads do not exist yet, so this is the neutral fallback
 * (`--org-brand`). It is an organization setting, independent of the viewer's
 * appearance, and never the product identity. Decorative: the name is always
 * shown or announced next to it.
 */
export function OrganizationTile({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-lg bg-org-brand text-[11px] font-semibold text-org-brand-foreground ring-1 ring-border ring-inset",
        className,
      )}
    >
      {monogram(name)}
    </span>
  );
}
