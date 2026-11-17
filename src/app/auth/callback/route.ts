import { NextResponse, type NextRequest } from "next/server";

import { parseCallbackParams } from "@/lib/auth/callback";
import { safeRedirectPath } from "@/lib/auth/redirect";
import type { SignInNotice } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

/**
 * Completes an email confirmation link. Every outcome redirects to a fixed
 * internal path or a sanitised `next` path on this origin; Auth error details
 * are never shown.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = parseCallbackParams(params);

  const toSignIn = (notice: SignInNotice) =>
    NextResponse.redirect(new URL(`/sign-in?status=${notice}`, request.url));

  if (parsed.kind === "error") {
    return toSignIn(
      parsed.reason === "expired" ? "link-expired" : "confirmation-failed",
    );
  }
  if (parsed.kind === "invalid") {
    return toSignIn("confirmation-failed");
  }

  const supabase = await createClient();
  const { error } =
    parsed.kind === "code"
      ? await supabase.auth.exchangeCodeForSession(parsed.code)
      : await supabase.auth.verifyOtp({
          type: parsed.type,
          token_hash: parsed.tokenHash,
        });

  if (error) {
    // Typically the link was opened in a different browser (no PKCE
    // verifier). The address may already be confirmed; sign-in will tell.
    return toSignIn(
      error.code === "otp_expired" ? "link-expired" : "confirmation-failed",
    );
  }

  // The destination page verifies the session and email itself.
  return NextResponse.redirect(
    new URL(safeRedirectPath(params.get("next"), "/"), request.url),
  );
}
