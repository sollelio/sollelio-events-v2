"use client";

import { useFormStatus } from "react-dom";
import { LogOut, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

/** Sign-out is a POST form (Server Function), never a link. */
export function SignOutButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  return (
    <form action={signOut}>
      <SubmitButton label={label} pendingLabel={pendingLabel} />
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      className="w-full"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <LoaderCircle aria-hidden className="animate-spin" />
      ) : (
        <LogOut aria-hidden />
      )}
      {pending ? pendingLabel : label}
    </Button>
  );
}
