const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Whether the creator's turn comes first: first in an ordered request, anywhere in an unordered one. */
export function signsFirst(signers: string[], me: string, ordered: boolean) {
  const at = signers.indexOf(me)
  return at === 0 || (at > 0 && !ordered)
}

/**
 * The composer's primary action. A creator whose turn comes first signs in the same click that creates the request
 * ("Sign with CIE" alone, "Sign and send" with others), except where signing can't happen (a phone or tablet).
 */
export function composerPrimary(
  signers: string[],
  me: string,
  ordered: boolean,
  canSignHere: boolean
): "sign" | "signAndSend" | "send" {
  if (!canSignHere || !signsFirst(signers, me, ordered)) return "send"
  return signers.length === 1 ? "sign" : "signAndSend"
}

/** Where the signed PDF goes, in the request page's words: "Will be saved to OneDrive: Verbali/Verbale - firmato.pdf". */
export function savedToText(drive: string, folderPath: string, fileName: string) {
  return `Will be saved to ${drive}: ${folderPath ? `${folderPath}/` : "/"}${fileName}`
}

/** The addresses typed in the email field, separated by commas, semicolons or spaces. */
export function parseRecipients(text: string) {
  return text
    .split(/[\s,;]+/)
    .map((address) => address.trim())
    .filter(Boolean)
}

/** The first address that isn't one, for "“x” isn't an email address." */
export function invalidRecipient(recipients: string[]) {
  return recipients.find((address) => !EMAIL.test(address))
}
