import {
  AtSign,
  ClipboardList,
  Ellipsis,
  Globe,
  Handshake,
  Mail,
  MessageCircle,
  Phone,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";

import type { InquirySource } from "@/lib/inquiries/inquiry";

const ICONS: Record<InquirySource, LucideIcon> = {
  phone: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  social_media: AtSign,
  in_person: Handshake,
  website: Globe,
  referral: UserRoundPlus,
  other: Ellipsis,
};

/** Decorative: the source's name is always shown next to it. */
export function SourceIcon({
  source,
  className,
}: {
  source: InquirySource;
  className?: string;
}) {
  const Icon = ICONS[source];
  return <Icon aria-hidden className={className} />;
}

/**
 * How an inquiry arrived, for lists and headers: the commercial source for
 * manual registrations, "Formulário público" for public submissions (whose
 * source is not stated).
 */
export function InquiryOrigin({
  source,
  channel,
  labels,
  className = "size-3.5",
}: {
  source: InquirySource | null;
  channel: "staff_entry" | "public_form";
  labels: { sources: Record<InquirySource, string>; publicForm: string };
  className?: string;
}) {
  if (channel === "public_form" || !source) {
    return (
      <>
        <ClipboardList aria-hidden className={className} />
        {labels.publicForm}
      </>
    );
  }
  return (
    <>
      <SourceIcon source={source} className={className} />
      {labels.sources[source]}
    </>
  );
}
