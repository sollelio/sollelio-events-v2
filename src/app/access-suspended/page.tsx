import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CircleSlash } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getViewer } from "@/lib/auth/session";
import { ACCESS_SUSPENDED_PATH, destinationFor } from "@/lib/auth/viewer";
import { getMessages } from "@/messages";

export const metadata: Metadata = {
  title: getMessages().accessSuspended.metaTitle,
};

/**
 * For verified users whose only current memberships are suspended. They are
 * not offered a new organization. The organization itself is not readable
 * while suspended (RLS), so it is not named here.
 */
export default async function AccessSuspendedPage() {
  const viewer = await getViewer();
  const destination = destinationFor(viewer);
  if (destination !== ACCESS_SUSPENDED_PATH || viewer.status !== "verified") {
    redirect(destination);
  }

  const { accessSuspended: copy, common } = getMessages();

  return (
    <AuthShell title={copy.title}>
      <div className="grid gap-4 text-sm">
        <div className="flex gap-3">
          <CircleSlash
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
          />
          <p className="text-foreground">{copy.body}</p>
        </div>
        <p className="text-muted-foreground">{copy.hint}</p>
        <div className="mt-2 grid gap-4 border-t border-border pt-5">
          <p className="text-muted-foreground">
            {copy.signedInAs}{" "}
            <span className="font-medium break-all text-foreground">
              {viewer.email}
            </span>
          </p>
          <SignOutButton
            label={common.signOut}
            pendingLabel={common.signingOut}
          />
        </div>
      </div>
    </AuthShell>
  );
}
