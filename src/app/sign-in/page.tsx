import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { getViewer } from "@/lib/auth/session";
import { destinationFor, signInNotice } from "@/lib/auth/viewer";
import { getMessages } from "@/messages";

export const metadata: Metadata = {
  title: getMessages().auth.signIn.metaTitle,
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const viewer = await getViewer();
  if (viewer.status === "verified") {
    redirect(destinationFor(viewer));
  }

  const params = await searchParams;
  const next = safeRedirectPath(params.next, "/");
  const notice = signInNotice(params.status);
  const { auth } = getMessages();

  return (
    <AuthShell
      title={auth.signIn.title}
      description={auth.signIn.description}
      footer={
        <>
          {auth.signIn.noAccount}{" "}
          <Link
            href="/sign-up"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {auth.signIn.toSignUp}
          </Link>
        </>
      }
    >
      <SignInForm next={next} notice={notice} copy={auth} />
    </AuthShell>
  );
}
