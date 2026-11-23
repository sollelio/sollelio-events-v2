
"use client";

import { RotateCw } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/components/i18n/locale-provider";

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { failure } = useMessages().onboarding;

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
          onClick={reset}
        >
          <RotateCw aria-hidden />
          {failure.retry}
        </Button>
      </div>
    </AuthShell>
  );
}
