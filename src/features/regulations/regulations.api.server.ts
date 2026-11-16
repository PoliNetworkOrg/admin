import { z } from "zod"

import { createUntypedBackendClient } from "@/server/backend.server"

import {
  type applyMergeInputSchema,
  type Assignment,
  assignmentSchema,
  type BinaryFile,
  binaryFileSchema,
  type CollabTicket,
  collabTicketSchema,
  type commentRefInputSchema,
  type CommentThread,
  commentThreadSchema,
  type CompileStatus,
  compileStatusSchema,
  type compilePdfInputSchema,
  type createCommentInputSchema,
  type createDelegaInputSchema,
  type createDraftInputSchema,
  type createSnapshotInputSchema,
  type Delega,
  delegaSchema,
  type delegaRefInputSchema,
  type Diff,
  diffSchema,
  type DocumentInfo,
  documentSchema,
  type Draft,
  draftFilesSchema,
  type draftRefInputSchema,
  draftSchema,
  type DraftSummary,
  draftSummarySchema,
  type Emanation,
  emanationSchema,
  type listDraftsInputSchema,
  type Me,
  meSchema,
  type mergeInputSchema,
  type MergePreview,
  mergePreviewSchema,
  type removeAssignmentInputSchema,
  type renameDraftInputSchema,
  type replyCommentInputSchema,
  type setAssignmentInputSchema,
  type Snapshot,
  type snapshotRefInputSchema,
  snapshotSchema,
  snapshotWithFilesSchema,
  type transitionInputSchema,
  type UserMatch,
  userMatchSchema,
  type userSearchInputSchema,
  type VersionSummary,
  versionSummarySchema,
} from "./regulations.contract"

type In<T extends z.ZodType> = z.input<T>
type DraftRef = In<typeof draftRefInputSchema>
type DocumentRef = { documentKey: string }

export type DraftFiles = z.infer<typeof draftFilesSchema>
export type SnapshotWithFiles = z.infer<typeof snapshotWithFilesSchema>

/** Who is asking, for agent mode's fake: their account and permissions. */
export type RegulationsViewer = { user: UserMatch; permissions: readonly string[] }

/** The `regulations.*` procedures (docs/regulations/contract.md), one method each. */
export type RegulationsApi = {
  getMe: () => Promise<Me>
  listDocuments: () => Promise<DocumentInfo[]>
  getDocument: (input: DocumentRef) => Promise<DocumentInfo>
  syncDocuments: () => Promise<void>
  listVersions: (input: DocumentRef) => Promise<VersionSummary[]>
  versionPdf: (input: { versionId: string }) => Promise<BinaryFile>
  listDrafts: (input: In<typeof listDraftsInputSchema>) => Promise<DraftSummary[]>
  getDraft: (input: DraftRef) => Promise<Draft>
  draftFiles: (input: DraftRef) => Promise<DraftFiles>
  createDraft: (input: In<typeof createDraftInputSchema>) => Promise<{ id: string }>
  renameDraft: (input: In<typeof renameDraftInputSchema>) => Promise<void>
  deleteDraft: (input: DraftRef) => Promise<void>
  transition: (input: In<typeof transitionInputSchema>) => Promise<void>
  listAssignments: (input: DraftRef) => Promise<Assignment[]>
  setAssignment: (input: In<typeof setAssignmentInputSchema>) => Promise<void>
  removeAssignment: (input: In<typeof removeAssignmentInputSchema>) => Promise<void>
  searchUsers: (input: In<typeof userSearchInputSchema>) => Promise<UserMatch[]>
  collabTicket: (input: DraftRef) => Promise<CollabTicket>
  compileStatus: (input: DraftRef) => Promise<CompileStatus>
  compilePdf: (input: In<typeof compilePdfInputSchema>) => Promise<BinaryFile>
  listSnapshots: (input: DraftRef) => Promise<Snapshot[]>
  getSnapshot: (input: In<typeof snapshotRefInputSchema>) => Promise<SnapshotWithFiles>
  createSnapshot: (input: In<typeof createSnapshotInputSchema>) => Promise<void>
  restoreSnapshot: (input: In<typeof snapshotRefInputSchema>) => Promise<void>
  listComments: (input: DraftRef) => Promise<CommentThread[]>
  createComment: (input: In<typeof createCommentInputSchema>) => Promise<void>
  replyComment: (input: In<typeof replyCommentInputSchema>) => Promise<void>
  resolveComment: (input: In<typeof commentRefInputSchema>) => Promise<void>
  reopenComment: (input: In<typeof commentRefInputSchema>) => Promise<void>
  deleteComment: (input: In<typeof commentRefInputSchema>) => Promise<void>
  previewMerge: (input: In<typeof mergeInputSchema>) => Promise<MergePreview>
  applyMerge: (input: In<typeof applyMergeInputSchema>) => Promise<void>
  getDiff: (input: DraftRef) => Promise<Diff>
  regenerateDiff: (input: DraftRef) => Promise<void>
  diffPdf: (input: DraftRef) => Promise<BinaryFile>
  getEmanation: (input: DraftRef) => Promise<Emanation | null>
  startEmanation: (input: DraftRef) => Promise<void>
  retryEmanation: (input: DraftRef) => Promise<void>
  listDeleghe: () => Promise<Delega[]>
  createDelega: (input: In<typeof createDelegaInputSchema>) => Promise<void>
  revokeDelega: (input: In<typeof delegaRefInputSchema>) => Promise<void>
}

const createdSchema = z.object({ id: z.string() })

/**
 * The backend's `regulations.*` procedures. Every response is parsed with the contract's schema: a backend that drifts
 * from the contract fails loudly here, not in a page.
 */
export function backendRegulationsApi(accessToken: string | null): RegulationsApi {
  const client = createUntypedBackendClient(accessToken)
  const query = async <T, I>(path: string, input: I, schema: z.ZodType<T>) =>
    schema.parse(await client.query(`regulations.${path}`, input))
  const mutate = async <I>(path: string, input: I) => {
    await client.mutation(`regulations.${path}`, input)
  }

  return {
    getMe: () => query("me.get", undefined, meSchema),
    listDocuments: () => query("documents.list", undefined, documentSchema.array()),
    getDocument: (input) => query("documents.get", input, documentSchema),
    syncDocuments: () => mutate("documents.sync", undefined),
    listVersions: (input) => query("versions.list", input, versionSummarySchema.array()),
    versionPdf: (input) => query("versions.pdf", input, binaryFileSchema),
    listDrafts: (input) => query("drafts.list", input, draftSummarySchema.array()),
    getDraft: (input) => query("drafts.get", input, draftSchema),
    draftFiles: (input) => query("drafts.files", input, draftFilesSchema),
    createDraft: async (input) => createdSchema.parse(await client.mutation("regulations.drafts.create", input)),
    renameDraft: (input) => mutate("drafts.rename", input),
    deleteDraft: (input) => mutate("drafts.delete", input),
    transition: (input) => mutate("drafts.transition", input),
    listAssignments: (input) => query("assignments.list", input, assignmentSchema.array()),
    setAssignment: (input) => mutate("assignments.set", input),
    removeAssignment: (input) => mutate("assignments.remove", input),
    searchUsers: (input) => query("users.search", input, userMatchSchema.array()),
    collabTicket: async (input) => collabTicketSchema.parse(await client.mutation("regulations.collabTicket", input)),
    compileStatus: (input) => query("compile.status", input, compileStatusSchema),
    compilePdf: (input) => query("compile.pdf", input, binaryFileSchema),
    listSnapshots: (input) => query("snapshots.list", input, snapshotSchema.array()),
    getSnapshot: (input) => query("snapshots.get", input, snapshotWithFilesSchema),
    createSnapshot: (input) => mutate("snapshots.create", input),
    restoreSnapshot: (input) => mutate("snapshots.restore", input),
    listComments: (input) => query("comments.list", input, commentThreadSchema.array()),
    createComment: (input) => mutate("comments.create", input),
    replyComment: (input) => mutate("comments.reply", input),
    resolveComment: (input) => mutate("comments.resolve", input),
    reopenComment: (input) => mutate("comments.reopen", input),
    deleteComment: (input) => mutate("comments.delete", input),
    previewMerge: (input) => query("merge.preview", input, mergePreviewSchema),
    applyMerge: (input) => mutate("merge.execute", input),
    getDiff: (input) => query("diff.get", input, diffSchema),
    regenerateDiff: (input) => mutate("diff.regenerate", input),
    diffPdf: (input) => query("diff.pdf", input, binaryFileSchema),
    getEmanation: (input) => query("emanation.get", input, emanationSchema.nullable()),
    startEmanation: (input) => mutate("emanation.start", input),
    retryEmanation: (input) => mutate("emanation.retry", input),
    listDeleghe: () => query("deleghe.list", undefined, delegaSchema.array()),
    createDelega: (input) => mutate("deleghe.create", input),
    revokeDelega: (input) => mutate("deleghe.revoke", input),
  }
}

type RegulationsContext = {
  agentMode: boolean
  session: { accessToken: string | null; user: { sub: string; name: string; email: string } }
  permissions: readonly string[]
}

/**
 * The Regolamenti API for this request: the in-memory fake in agent mode without a token, the backend otherwise. The fake (with the
 * collab server and compiler it runs) exists only in development builds.
 */
export async function regulationsApi(context: RegulationsContext): Promise<RegulationsApi> {
  // Agent mode with `AGENT_BACKEND_TOKEN` talks to a real (local) backend instead.
  if (import.meta.env.DEV && context.agentMode && context.session.accessToken === null) {
    const { fakeRegulationsApi } = await import("./regulations.fake.server")
    const { sub, name, email } = context.session.user
    return fakeRegulationsApi({ user: { id: sub, name, email }, permissions: context.permissions })
  }
  return backendRegulationsApi(context.session.accessToken)
}
