import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

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
      title={auth.signUp.title}
      description={auth.signUp.description}
      footer={
        <>
          {auth.signUp.haveAccount}{" "}
          <Link
            href="/sign-in"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {auth.signUp.toSignIn}
          </Link>
        </>
      }
    >
      <SignUpForm copy={auth} />
    </AuthShell>
  );
}