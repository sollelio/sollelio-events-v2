import { PublicShell } from "@/components/public-forms/public-shell";
import { getMessages } from "@/messages";

/** An unknown or revoked link, or public forms not configured. */
export default function PublicFormNotFound() {
  const { unavailable } = getMessages().publicForm;
  return (
    <PublicShell>
      <h1 className="type-title text-foreground">{unavailable.title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{unavailable.body}</p>
    </PublicShell>
  );
}
