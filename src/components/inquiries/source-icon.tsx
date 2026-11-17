import {
  AtSign,
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
