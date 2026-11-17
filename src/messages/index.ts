import { ptPT, type Messages } from "./pt-PT";

/**
 * Interface copy. Only European Portuguese exists for now; adding a locale
 * means adding a dictionary of the same shape and choosing it here.
 */
export const LOCALE = "pt-PT";

export function getMessages(): Messages {
  return ptPT;
}

export type { Messages };
