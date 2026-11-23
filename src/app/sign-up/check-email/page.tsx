import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/messages";

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getMessages();

  return {
    title: messages.auth.checkEmail.metaTitle,
  };
}

/**
 * Shown after every accepted sign-up, whether or not the address already had
 * an account, so the page reveals nothing about existing accounts.
 */
export default async function CheckEmailPage() {
  const { checkEmail } = (await getMessages()).auth;

  return (
    <AuthShell title={checkEmail.title}>
      <div className="grid gap-4 text-sm">
        <div className="flex gap-3">
          <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-info" />
          <p className="text-foreground">{checkEmail.body}</p>
        </div>

        <p className="text-muted-foreground">{checkEmail.hint}</p>

        <p className="text-muted-foreground">{checkEmail.notReceived}</p>

        <Button asChild variant="outline" size="lg" className="mt-2 w-full">
          <Link href="/sign-up">Back to Sign Up</Link>
        </Button>
      </div>
    </AuthShell>
  );
}