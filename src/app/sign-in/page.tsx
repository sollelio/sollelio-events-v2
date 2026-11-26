
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthTabs } from "@/components/auth/auth-tabs";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getViewer } from "@/lib/auth/session";
import { destinationFor } from "@/lib/auth/viewer";
import { getMessages } from "@/messages";

type SignInPageProps = {
  searchParams: Promise<{
    next?: string;
    notice?: string;
  }>;
};

const validNotices = [
  "signed-out",
  "unverified",
  "confirmation-failed",
  "link-expired",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const messages = await getMessages();

  return {
    title: messages.auth.signIn.metaTitle,
  };
}

export default async function SignInPage({
  searchParams,
}: SignInPageProps) {
  const viewer = await getViewer();

  if (viewer.status === "verified") {
    redirect(destinationFor(viewer));
  }

  const params = await searchParams;

  // Only allow local paths, not external redirect URLs.
  const next =
    params.next?.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/";

  const notice = validNotices.includes(
    params.notice as (typeof validNotices)[number],
  )
    ? (params.notice as (typeof validNotices)[number])
    : undefined;

  const messages = await getMessages();
  const auth = messages.auth;

  return (
<AuthShell
  variant="split"
  title={auth.welcome}
  description={auth.tagline}
  tabs={<AuthTabs active="sign-in" labels={auth.tabs} />}
>
  <SignInForm next={next} notice={notice} copy={auth} />
</AuthShell>

  );
}
