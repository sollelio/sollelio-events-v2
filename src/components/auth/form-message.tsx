import { CircleAlert, Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Inline message above a form. Errors are announced immediately (role=alert);
 * notices politely (role=status).
 */
export function FormMessage({
  tone,
  children,
  messageRef,
}: {
  tone: "error" | "notice";
  children: React.ReactNode;
  messageRef?: React.Ref<HTMLDivElement>;
}) {
  const Icon = tone === "error" ? CircleAlert : Info;
  return (
    <div
      ref={messageRef}
      tabIndex={-1}
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-2.5 rounded-lg px-3 py-2.5 text-sm",
        tone === "error"
          ? "bg-destructive-soft text-destructive"
          : "bg-info-soft text-foreground",
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
