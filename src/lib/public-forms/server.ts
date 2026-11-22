import "server-only";

import {
  callSubmitPublicForm,
  databaseErrorCode,
  selectPublicForm,
  serviceDatabase,
} from "./database";
import { getPublicFormsEnv } from "./env";
import { parsePublicForm, PUBLIC_KEY_PATTERN, type PublicForm } from "./form";
import { signRenderToken } from "./token";

/**
 * The current published version of an active link's form, or null when the
 * link is unknown or revoked, or public forms are not configured.
 */
export async function loadPublicForm(key: string): Promise<PublicForm | null> {
  const env = getPublicFormsEnv();
  if (!env || !PUBLIC_KEY_PATTERN.test(key)) return null;
  try {
    return parsePublicForm(
      await selectPublicForm(serviceDatabase(env.database), key),
    );
  } catch (error) {
    const code = databaseErrorCode(error);
    if (code !== "SF001") {
      console.error("public form unavailable", code ?? "connection");
    }
    return null;
  }
}

export async function submitPublicForm(args: {
  key: string;
  formVersionId: string;
  requestId: string;
  fingerprint: string | null;
  answers: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; code: string | undefined }> {
  const env = getPublicFormsEnv();
  if (!env) return { ok: false, code: undefined };
  try {
    await callSubmitPublicForm(serviceDatabase(env.database), args);
    return { ok: true };
  } catch (error) {
    const code = databaseErrorCode(error);
    if (!code) console.error("public form submission failed", "connection");
    return { ok: false, code };
  }
}

/** A render token for this link and version, issued now. */
export function issueRenderToken(
  key: string,
  versionId: string,
): string | null {
  const env = getPublicFormsEnv();
  return env
    ? signRenderToken(env.signingSecret, {
        key,
        versionId,
        issuedAt: Date.now(),
      })
    : null;
}
