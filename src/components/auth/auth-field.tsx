"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

export function AuthField({
  id,
  label,
  error,
  inputRef,
  kind = "text",
  ...input
}: Omit<React.ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  error?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  kind?: "text" | "email" | "password";
}) {
  const [show, setShow] = useState(false);

  const Icon = kind === "email" ? Mail : Lock;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-[15px] font-medium text-white">
        {label} *
      </label>

      {/* `group` lets the left icon react when the input is focused */}
      <div className="group relative">
        <Icon
          aria-hidden
          className="pointer-events-none absolute start-4 top-1/2 size-[18px] -translate-y-1/2 text-white/70 transition-colors duration-200 group-focus-within:text-white group-hover:text-white"
        />

        <input
          id={id}
          ref={inputRef}
          type={kind === "password" ? (show ? "text" : "password") : kind}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="h-12 w-full rounded-2xl border border-white/25 bg-black ps-12 pe-12 text-sm text-white outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-white/80 hover:border-white/50 focus-visible:border-white focus-visible:bg-white/[0.03] focus-visible:shadow-[0_0_0_4px_rgba(255,255,255,0.08)] aria-invalid:border-destructive aria-invalid:focus-visible:shadow-[0_0_0_4px_rgba(239,68,68,0.15)]"
          {...input}
        />

        {kind === "password" && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute end-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline-none"
          >
            {show ? (
              <Eye className="size-[18px]" />
            ) : (
              <EyeOff className="size-[18px]" />
            )}
          </button>
        )}
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="animate-[auth-in_300ms_cubic-bezier(0.22,1,0.36,1)_both] text-xs font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}