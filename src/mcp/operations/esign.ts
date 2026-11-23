import { getEsignDriveAccess, setEsignDriveAccess, setEsignDriveAccessInput } from "@/features/esign/drives.functions"
import {
  cancelEsignSignature,
  declineEsignRequest,
  declineEsignRequestInput,
  esignBatchInput,
  esignDocumentIdInput,
  esignHomeInput,
  esignJobIdsInput,
  esignRequestIdInput,
  getEsignBatch,
  getEsignDocumentContent,
  getEsignHome,
  getEsignJobStatus,
  getEsignPendingCount,
  getEsignRequest,
  startEsignSignature,
  startEsignSignatureInput,
} from "@/features/esign/esign.functions"
import {
  cancelEsignRequest,
  createEsignRequest,
  createEsignRequestInput,
  deleteEsignRequest,
  esignComposerInput,
  esignDriveFolderInput,
  esignDriveItemInput,
  esignManagedRequestInput,
  getEsignComposer,
  importEsignDriveDocument,
  listEsignDrive,
  retryEsignDelivery,
  uploadEsignDocument,
} from "@/features/esign/requests.functions"

import { destructive, read, write } from "../operation"

/**
 * eSign (Signatures). A CIE signature needs the person, their card and PIN, and the PoliNetwork eSign desktop app:
 * the MCP only starts signing jobs, whose single-use tickets the app consumes through `/api/esign/agent/…`.
 */
export const esignOperations = [
  read("esign.requests.list", getEsignHome, {
    guard: "esignReadMiddleware",
    input: esignHomeInput,
    description:
      "The eSign configuration (drives, PDF size limit) and the caller's signature requests: inbox (their turn to sign), mine (they created or sign) or all (managers).",
  }),
  read("esign.requests.pendingCount", getEsignPendingCount, {
    guard: "esignReadMiddleware",
    description: "How many signature requests wait for the caller's signature.",
  }),
  read("esign.requests.get", getEsignRequest, {
    guard: "esignReadMiddleware",
    input: esignRequestIdInput,
    description:
      "One signature request (id from esign.requests.list): signers and their places, audit events, versions, current document's pages and signatures, and how many others wait for the caller.",
  }),
  read("esign.requests.toSign", getEsignBatch, {
    guard: "esignReadMiddleware",
    input: esignBatchInput,
    description:
      "Up to 10 requests waiting for the caller's signature, with details, to sign together with one PIN; `first` (a request id) leads. `more` counts the rest.",
  }),
  read("esign.documents.content", getEsignDocumentContent, {
    guard: "esignReadMiddleware",
    input: esignDocumentIdInput,
    description:
      "A document version's PDF as { fileName, base64 }. documentId: a request's currentDocumentId or versions, or an upload/import result.",
  }),
  write("esign.signatures.start", startEsignSignature, {
    guard: "esignSignWriteMiddleware",
    input: startEsignSignatureInput,
    description:
      "Start the caller's signature of 1–10 requests in their inbox; returns single-use tickets. The person signs with their CIE in the PoliNetwork eSign app at http://127.0.0.1:47321/sign?origin=<this server's origin>&ticket=<each ticket>. Never ask for a PIN.",
  }),
  read("esign.signatures.status", getEsignJobStatus, {
    guard: "esignReadMiddleware",
    input: esignJobIdsInput,
    description:
      "The status of signing jobs (jobIds from esign.signatures.start): pending, prepared, completed, failed, cancelled or expired, with the error and signatures left.",
  }),
  destructive("esign.signatures.cancel", cancelEsignSignature, {
    guard: "esignSignWriteMiddleware",
    input: esignJobIdsInput,
    description:
      "Cancel signing jobs not completed yet (jobIds from esign.signatures.start); their tickets stop working in the eSign app. The requests stay open.",
  }),
  destructive("esign.requests.decline", declineEsignRequest, {
    guard: "esignSignWriteMiddleware",
    input: declineEsignRequestInput,
    description:
      "Decline a request it is the caller's turn to sign, with an optional reason: the request stops for everyone and its creator gets an email with the reason.",
  }),
  read("esign.composer.get", getEsignComposer, {
    guard: "esignRequestsManageMiddleware",
    input: esignComposerInput,
    description:
      "What a new request needs: the configuration, the people who can sign (their sub) and the drives; with `from` (a request id), that request and its original PDF to start from.",
  }),
  read("esign.drives.browse", listEsignDrive, {
    guard: "esignRequestsManageMiddleware",
    input: esignDriveFolderInput,
    description:
      "List a OneDrive folder (the drive's root without folderId): its subfolders and PDFs. driveId from esign.composer.get's config.drives.",
  }),
  write("esign.documents.upload", uploadEsignDocument, {
    guard: "esignRequestsManageMiddleware",
    files: [
      { field: "file", required: true, description: "The PDF to sign (.pdf or application/pdf), at most 30 MB." },
    ],
    description:
      "Stage a PDF for a new request; returns its documentId, pages and existing signatures, for esign.requests.create.",
  }),
  write("esign.documents.importFromDrive", importEsignDriveDocument, {
    guard: "esignRequestsManageMiddleware",
    input: esignDriveItemInput,
    description:
      "Stage a OneDrive PDF (itemId from esign.drives.browse) for a new request; returns its documentId and pages, for esign.requests.create.",
  }),
  write("esign.requests.create", createEsignRequest, {
    guard: "esignRequestsManageMiddleware",
    input: createEsignRequestInput,
    description:
      "Create a signature request on a staged document for signers (sub from esign.composer.get). Places: 0-based page, x/y/width/height as page fractions from top-left. The signed PDF goes to output and email.",
  }),
  destructive("esign.requests.cancel", cancelEsignRequest, {
    guard: "esignRequestsManageMiddleware",
    input: esignManagedRequestInput,
    description:
      "Cancel a signature request in progress: nobody can sign it any more; signatures already added stay in the document.",
  }),
  destructive("esign.requests.delete", deleteEsignRequest, {
    guard: "esignRequestsManageMiddleware",
    input: esignManagedRequestInput,
    description:
      "Delete a request that is not in progress (cancel it first) and has no pending delivery: its signers, activity and every document version. A OneDrive copy stays.",
  }),
  destructive("esign.requests.retryDelivery", retryEsignDelivery, {
    guard: "esignRequestsManageMiddleware",
    input: esignManagedRequestInput,
    description:
      "Deliver a completed request's signed PDF again after a failed delivery: saves it to its OneDrive folder and emails its recipients.",
  }),
  read("esign.drives.access", getEsignDriveAccess, {
    guard: "esignDrivesManageMiddleware",
    description:
      "Every drive's access rules (who may use it in requests, who may sign its documents), with the roles and permissions a rule can name.",
  }),
  write("esign.drives.setAccess", setEsignDriveAccess, {
    guard: "esignDrivesManageMiddleware",
    input: setEsignDriveAccessInput,
    description:
      "Set a drive's request and sign rules (any listed role or permission grants it; empty keeps the default). Signers who lose sign access can no longer sign its pending documents.",
  }),
]
