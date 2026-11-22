"use client";

import { useActionState, useState } from "react";
import { Ban, Check, Copy, LoaderCircle, RefreshCw } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import {
  enablePublicForm,
  revokePublicFormLink,
  rotatePublicFormLink,
  type LinkActionState,
} from "@/lib/public-forms/staff-actions";
import type { Messages } from "@/messages";

type Copy = Messages["inquiries"]["publicFormCard"];
const initial: LinkActionState = {};

export function EnablePublicFormButton({ copy }: { copy: Copy }) {
  const [state, action, pending] = useActionState(enablePublicForm, initial);
  return (
    <form action={action} className="grid gap-3">
      {state.error ? (
        <FormMessage tone="error">{copy.errors[state.error]}</FormMessage>
      ) : null}
      <Button
        type="submit"
        variant="outline"
        size="lg"
        className="w-full sm:w-auto"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : null}
        {pending ? copy.enabling : copy.enable}
      </Button>
    </form>
  );
}

/** Copies the link; the URL stays visible and selectable without JavaScript. */
export function CopyLinkButton({ url, copy }: { url: string; copy: Copy }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      <span aria-live="polite">{copied ? copy.copied : copy.copy}</span>
    </Button>
  );
}

export function LinkManagement({
  linkId,
  copy,
}: {
  linkId: string;
  copy: Copy;
}) {
  const [rotateState, rotate, rotating] = useActionState(
    rotatePublicFormLink,
    initial,
  );
  const [revokeState, revoke, revoking] = useActionState(
    revokePublicFormLink,
    initial,
  );
  const error = rotateState.error ?? revokeState.error;
  const busy = rotating || revoking;

  return (
    <div className="grid gap-3">
      {error ? (
        <FormMessage tone="error">{copy.errors[error]}</FormMessage>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <form action={rotate} className="grid gap-1.5">
          <input type="hidden" name="linkId" value={linkId} />
          <Button
            type="submit"
            variant="outline"
            disabled={busy}
            aria-busy={rotating}
            aria-describedby="rotate-hint"
          >
            {rotating ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <RefreshCw aria-hidden />
            )}
            {rotating ? copy.working : copy.rotate}
          </Button>
          <p id="rotate-hint" className="text-xs text-muted-foreground">
            {copy.rotateHint}
          </p>
        </form>
        <form action={revoke} className="grid gap-1.5">
          <input type="hidden" name="linkId" value={linkId} />
          <Button
            type="submit"
            variant="outline"
            disabled={busy}
            aria-busy={revoking}
            aria-describedby="revoke-hint"
          >
            {revoking ? (
              <LoaderCircle aria-hidden className="animate-spin" />
            ) : (
              <Ban aria-hidden />
            )}
            {revoking ? copy.working : copy.revoke}
          </Button>
          <p id="revoke-hint" className="text-xs text-muted-foreground">
            {copy.revokeHint}
          </p>
        </form>
      </div>
    </div>
  );
}
