import type { EsignDocumentMeta, EsignRequestDetail } from "@/lib/api/types"

import type { SignerDraft } from "./places"

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

type SourceRequest = EsignRequestDetail["request"]

/** The request a new one starts from ("Send again"), with its PDF as it was first added. */
export type ComposerSource = { request: SourceRequest; original: EsignDocumentMeta }

/**
 * The composer filled in from an earlier request: its title, its signers in order with their roles and places, where
 * the signed PDF went and whom it was emailed to. The signers are free rows until the document is read and its spots
 * found. A folder on a drive that is no longer configured is asked for again.
 */
export function prefillDraft(request: SourceRequest, driveIds: string[]) {
  const { output, email } = request
  const rows: SignerDraft[] = [...request.signers]
    .sort((a, b) => a.position - b.position)
    .map((signer) => ({
      id: `person:${signer.sub}`,
      spot: null,
      person: { sub: signer.sub, name: signer.name },
      role: signer.role ?? "",
      places: signer.places.map(({ page, x, y, width, height, kind }) => ({ page, x, y, width, height, kind })),
    }))
  return {
    title: request.title,
    ordered: request.ordered,
    rows,
    saveToDrive: driveIds.length > 0 && output !== null,
    folder:
      output && driveIds.includes(output.driveId)
        ? { driveId: output.driveId, id: output.folderId, path: output.folderPath }
        : null,
    fileName: output?.fileName ?? "",
    emails: email?.to.join(", ") ?? "",
    message: email?.message ?? "",
  }
}

/** Who declined a declined request, and why ("Mario Rossi declined: “Wrong date.”"); null for any other request. */
export function declinedLine(request: Pick<SourceRequest, "status" | "signers">) {
  if (request.status !== "declined") return null
  const signer = request.signers.find((s) => s.status === "declined")
  if (!signer) return null
  const reason = signer.declineReason?.trim()
  return reason ? `${signer.name} declined: “${reason}”` : `${signer.name} declined.`
}
