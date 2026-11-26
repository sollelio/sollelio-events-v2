import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthTabs } from "@/components/auth/auth-tabs";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getViewer } from "@/lib/auth/session";
import { destinationFor } from "@/lib/auth/viewer";
import { getMessages } from "@/messages";

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getMessages();

  return {
    title: messages.auth.signUp.metaTitle,
  };
}

export default async function SignUpPage() {
  const viewer = await getViewer();

  if (viewer.status === "verified") {
    redirect(destinationFor(viewer));
  }

  const { auth } = await getMessages();

  return (
<AuthShell
  variant="split"
  title={auth.welcome}
  description={auth.tagline}
  tabs={<AuthTabs active="sign-up" labels={auth.tabs} />}
>
  <SignUpForm copy={auth} />
</AuthShell>
  );
}