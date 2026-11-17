import { Input } from "@/components/ui/input";

/** Labelled input with an optional hint and an error wired for assistive tech. */
export function FormField({
  id,
  label,
  hint,
  error,
  inputRef,
  ...input
}: Omit<React.ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input
        id={id}
        ref={inputRef}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
