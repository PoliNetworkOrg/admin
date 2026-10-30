/** Mirrors the backend's `src/azure/mailbox.ts`, which builds and checks the address again. */
export const MAIL_DOMAIN = "polinetwork.org"

const LOCAL_PART = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/

export type MailboxKind = "standard" | "custom"

export function isLocalPart(value: string) {
  return value.length <= 64 && LOCAL_PART.test(value)
}

/** Accents and apostrophes are dropped and spaces removed: "Niccolò", "D'Amico" -> "niccolo.damico". */
function namePart(name: string) {
  return name.trim().normalize("NFD").replace(/\p{M}/gu, "").replace(/['\s]/g, "").toLowerCase()
}

/** `firstname.lastname`, or null when the name has letters an address cannot hold (e.g. "Łukasz"). */
export function standardLocalPart(firstName: string, lastName: string): string | null {
  const localPart = `${namePart(firstName)}.${namePart(lastName)}`
  return isLocalPart(localPart) ? localPart : null
}

export function isPoliNetworkAddress(email: string) {
  return email.trim().toLowerCase().endsWith(`@${MAIL_DOMAIN}`)
}
