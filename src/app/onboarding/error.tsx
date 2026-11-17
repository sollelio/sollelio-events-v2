"use client";

import { RotateCw } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/messages";

/**
 * Shown when the session cannot be verified or the form cannot reach the
 * server. Retrying re-runs the page's checks on the server, so if the
 * organization was created before the failure the viewer is sent home rather
 * than shown the form again.
 */
export default function OnboardingError({ retry }: { retry: () => void }) {
  const { failure } = getMessages().onboarding;

  return (
    <AuthShell title={failure.title}>
      <div className="grid gap-4 text-sm">
        <p role="alert" className="text-foreground">
          {failure.body}
        </p>
        <Button
          type="button"
          size="lg"
          className="mt-2 w-full"
          onClick={() => retry()}
        >
          <RotateCw aria-hidden />
          {failure.retry}
        </Button>
      </div>
    </AuthShell>
  );
}
