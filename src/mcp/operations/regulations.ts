import {
  createRectification,
  createRectificationInput,
  deleteDraft,
  emanateRectification,
  renameDraft,
  retryEmanation,
  revealDraft,
} from "@/features/regulations/regulations-draft.functions"
import {
  createComment,
  createSnapshot,
  deleteComment,
  reopenComment,
  replyComment,
  resolveComment,
  restoreSnapshot,
} from "@/features/regulations/regulations-editor.functions"
import {
  approveDraft,
  approveDraftInput,
  createRegulationDocument,
  emanateDraft,
  regenerateDiff,
  syncRegulationDocuments,
  uploadRegulationDocument,
  uploadRegulationVersion,
  withdrawApproval,
} from "@/features/regulations/regulations-manage.functions"
import { createDelega, revokeDelega } from "@/features/regulations/regulations-rectify.functions"
import {
  applyMerge,
  createDraft,
  createDraftInput,
  removeDraftAssignment,
  setDraftAssignment,
  transitionDraft,
  transitionDraftInput,
} from "@/features/regulations/regulations-write.functions"
import {
  commentRefInputSchema,
  compilePdfInputSchema,
  createCommentInputSchema,
  createDelegaInputSchema,
  createDocumentInputSchema,
  createSnapshotInputSchema,
  delegaRefInputSchema,
  draftRefInputSchema,
  listDraftsInputSchema,
  mergeInputSchema,
  removeAssignmentInputSchema,
  renameDraftInputSchema,
  replyCommentInputSchema,
  setAssignmentInputSchema,
  snapshotRefInputSchema,
  uploadDocumentFieldsSchema,
  uploadVersionFieldsSchema,
  userSearchInputSchema,
  applyMergeInputSchema,
} from "@/features/regulations/regulations.contract"
import {
  documentRefInput,
  getComments,
  getCompileStatus,
  getDeleghe,
  getDiff,
  getDiffPdf,
  getDraft,
  getDraftFiles,
  getDraftPdf,
  getDrafts,
  getDraftWithMembers,
  getEmanation,
  getMergePreview,
  getMyRegulations,
  getRegulationDocument,
  getRegulationDocumentInfo,
  getRegulationDocuments,
  getRegulationTemplates,
  getSnapshot,
  getSnapshots,
  getVersionPdf,
  searchRegulationUsers,
  versionRefInput,
} from "@/features/regulations/regulations.functions"

import { destructive, type Operation, read, write } from "../operation"
import { regulationsSourceOperations } from "./regulations-source"

const PDF_FILE = "One PDF, at most 20 MB; the backend checks it is a PDF."

/**
 * Regolamenti: every PoliNetwork document, its drafts and their procedure. Draft-scoped operations run for anyone the
 * backend assigns to the draft (viewer, commenter, editor) or who holds a delega; the backend decides each call and a
 * draft's `can` says what the caller may do now.
 */
export const regulationsOperations: Operation[] = [
  // Reads
  read("regulations.me.get", getMyRegulations, {
    guard: "regulationsAssigneeMiddleware",
    description:
      "How this account reaches Regolamenti: drafts it is assigned to (with its role), its deleghe, permissions.",
  }),
  read("regulations.documents.list", getRegulationDocuments, {
    guard: "regulationsReadMiddleware",
    description:
      "Every document (regolamenti, documenti generali, private, sola consultazione) with its kind, procedure and status.",
  }),
  read("regulations.documents.get", getRegulationDocument, {
    guard: "regulationsReadMiddleware",
    input: documentRefInput,
    description:
      "One document (key from documents.list) with its published versions, newest first, and all its drafts.",
  }),
  read("regulations.documents.getInfo", getRegulationDocumentInfo, {
    guard: "regulationsReadMiddleware",
    input: documentRefInput,
    description: "One document alone (storage, procedure, editable), without versions or drafts.",
  }),
  read("regulations.templates.list", getRegulationTemplates, {
    guard: "regulationsReadMiddleware",
    description: "The templates documents.create can start a document from.",
  }),
  read("regulations.versions.pdf", getVersionPdf, {
    guard: "regulationsReadMiddleware",
    input: versionRefInput,
    description: "A published version's PDF as base64 (version ids from documents.get).",
  }),
  read("regulations.drafts.list", getDrafts, {
    guard: "regulationsAssigneeMiddleware",
    input: listDraftsInputSchema,
    description:
      "The drafts (bozze) this account may see, optionally of one document; includeClosed adds emanated ones.",
  }),
  read("regulations.drafts.get", getDraft, {
    guard: "regulationsAssigneeMiddleware",
    input: draftRefInputSchema,
    description: "One draft: state, procedure, deadlines and `can` (the steps this account may take now, or why not).",
  }),
  read("regulations.drafts.getWithMembers", getDraftWithMembers, {
    guard: "regulationsAssigneeMiddleware",
    input: draftRefInputSchema,
    description: "One draft with its members (assignments: viewer, commenter, editor).",
  }),
  read("regulations.drafts.files", getDraftFiles, {
    guard: "regulationsAssigneeMiddleware",
    input: draftRefInputSchema,
    description:
      "A draft's saved text with the parser's structure and problems, and the source globs new files must match. The live text is drafts.readSource.",
  }),
  read("regulations.compile.status", getCompileStatus, {
    guard: "regulationsAssigneeMiddleware",
    input: draftRefInputSchema,
    description: "The draft's latest preview compile: state, source hash, last good hash, LaTeX errors and log tail.",
  }),
  read("regulations.compile.pdf", getDraftPdf, {
    guard: "regulationsAssigneeMiddleware",
    input: compilePdfInputSchema,
    description: "The preview PDF of one source hash (from compile.status), as base64.",
  }),
  read("regulations.snapshots.list", getSnapshots, {
    guard: "regulationsAssigneeMiddleware",
    input: draftRefInputSchema,
    description: "A draft's history: automatic, named, state, restore and merge snapshots, newest first.",
  }),
  read("regulations.snapshots.get", getSnapshot, {
    guard: "regulationsAssigneeMiddleware",
    input: snapshotRefInputSchema,
    description: "One snapshot (id from snapshots.list) with its files.",
  }),
  read("regulations.comments.list", getComments, {
    guard: "regulationsAssigneeMiddleware",
    input: draftRefInputSchema,
    description: "A draft's comment threads with their quoted text, replies and resolution.",
  }),
  read("regulations.diff.get", getDiff, {
    guard: "regulationsAssigneeMiddleware",
    input: draftRefInputSchema,
    description: "The differences of a draft from its base version: article changes and the LLM's categories.",
  }),
  read("regulations.diff.pdf", getDiffPdf, {
    guard: "regulationsAssigneeMiddleware",
    input: draftRefInputSchema,
    description: "The differences as a PDF, base64.",
  }),
  read("regulations.emanation.get", getEmanation, {
    guard: "regulationsAssigneeMiddleware",
    input: draftRefInputSchema,
    description:
      "A draft's emanation (or publication): each step's state, notifications, and the error where it stopped.",
  }),
  read("regulations.deleghe.list", getDeleghe, {
    guard: "regulationsAssigneeMiddleware",
    description: "Deleghe to rectify: every one for the Segretario, otherwise this account's own.",
  }),
  read("regulations.merge.preview", getMergePreview, {
    guard: "regulationsWriteMiddleware",
    input: mergeInputSchema,
    description:
      "What merging a draft or version into a draft would do: clean changes, conflicts (with base, ours, theirs) and why it can't run.",
  }),
  read("regulations.users.search", searchRegulationUsers, {
    guard: "regulationsWriteMiddleware",
    input: userSearchInputSchema,
    description: "Search any IdP account by name or email, to add to a draft (members.set) or give a delega.",
  }),

  // Drafts (per-draft rights: the backend decides)
  write("regulations.drafts.rename", renameDraft, {
    guard: "regulationsAssigneeMiddleware",
    input: renameDraftInputSchema,
    description: "Rename a draft: the Direttivo, or whoever started the rettifica.",
  }),
  destructive("regulations.drafts.delete", deleteDraft, {
    guard: "regulationsAssigneeMiddleware",
    input: draftRefInputSchema,
    description:
      "Delete a draft still in bozza: the Direttivo, or whoever started the rettifica; a secret one only its creator.",
  }),
  destructive("regulations.drafts.reveal", revealDraft, {
    guard: "regulationsAssigneeMiddleware",
    input: draftRefInputSchema,
    description:
      "Make a secret draft visible to regulations:read and open its procedure, for good. Its creator only; can't be made secret again.",
  }),
  write("regulations.rettifiche.create", createRectification, {
    guard: "regulationsAssigneeMiddleware",
    input: createRectificationInput,
    description:
      "Start a rettifica of a document from its latest version (version id from documents.get): the Segretario or a delega holder.",
  }),
  destructive("regulations.rettifiche.emanate", emanateRectification, {
    guard: "regulationsAssigneeMiddleware",
    input: draftRefInputSchema,
    description:
      "Emana rettifica: publish the rettifica straight from bozza (release, then email and Telegram notices). Segretario or delega holder.",
  }),
  destructive("regulations.emanation.retry", retryEmanation, {
    guard: "regulationsAssigneeMiddleware",
    input: draftRefInputSchema,
    description:
      "Resume a failed emanation where it stopped (emanation.get): it may publish the release and send the notices still due.",
  }),

  // Editor: comments and snapshots
  write("regulations.comments.create", createComment, {
    guard: "regulationsAssigneeMiddleware",
    input: createCommentInputSchema,
    description:
      "Comment with a raw Yjs anchor (base64 relative positions). To comment on a piece of text, use comments.createOnText instead.",
  }),
  write("regulations.comments.reply", replyComment, {
    guard: "regulationsAssigneeMiddleware",
    input: replyCommentInputSchema,
    description: "Reply to a comment thread (id from comments.list): the draft's commenters and editors.",
  }),
  write("regulations.comments.resolve", resolveComment, {
    guard: "regulationsAssigneeMiddleware",
    input: commentRefInputSchema,
    description: "Mark a comment thread resolved.",
  }),
  write("regulations.comments.reopen", reopenComment, {
    guard: "regulationsAssigneeMiddleware",
    input: commentRefInputSchema,
    description: "Reopen a resolved comment thread.",
  }),
  destructive("regulations.comments.delete", deleteComment, {
    guard: "regulationsAssigneeMiddleware",
    input: commentRefInputSchema,
    description: "Delete a comment or reply; it keeps its place in the thread with an empty body.",
  }),
  write("regulations.snapshots.create", createSnapshot, {
    guard: "regulationsAssigneeMiddleware",
    input: createSnapshotInputSchema,
    description: "Save the draft's current text as a named snapshot in its history.",
  }),
  write("regulations.snapshots.restore", restoreSnapshot, {
    guard: "regulationsAssigneeMiddleware",
    input: snapshotRefInputSchema,
    description:
      "Restore a snapshot's text into its draft; the current text is saved as a snapshot first. Editors only.",
  }),

  // Direttivo (regulations:write)
  write("regulations.drafts.create", createDraft, {
    guard: "regulationsWriteMiddleware",
    input: createDraftInput,
    description:
      "Start a bozza (kind modifica) of a document from a version or another draft; secret: only its creator and the members they add see it.",
  }),
  write("regulations.members.set", setDraftAssignment, {
    guard: "regulationsWriteMiddleware",
    input: setAssignmentInputSchema,
    description:
      "Add a member to a draft or change their role (viewer, commenter, editor); user ids from users.search.",
  }),
  destructive("regulations.members.remove", removeDraftAssignment, {
    guard: "regulationsWriteMiddleware",
    input: removeAssignmentInputSchema,
    description: "Remove a member from a draft: they lose access to it.",
  }),
  write("regulations.merge.apply", applyMerge, {
    guard: "regulationsWriteMiddleware",
    input: applyMergeInputSchema,
    description:
      "Merge a draft or version into a draft, with one resolution per conflict of merge.preview (ours, theirs, or text).",
  }),
  write("regulations.drafts.transition", transitionDraft, {
    guard: "regulationsWriteMiddleware",
    input: transitionDraftInput,
    description:
      "Invia in approvazione (in_approvazione, freezes the text) or Riporta in bozza (bozza), when the draft's can.transitions allows it.",
  }),

  // Presidente and Segretario (regulations:manage)
  write("regulations.drafts.approve", approveDraft, {
    guard: "regulationsManageMiddleware",
    input: approveDraftInput,
    description:
      "Registra l'approvazione: record the delibera (body, date of the vote, optional verbale URL); the draft becomes approvata.",
  }),
  destructive("regulations.drafts.withdrawApproval", withdrawApproval, {
    guard: "regulationsManageMiddleware",
    input: draftRefInputSchema,
    description:
      "Annulla l'approvazione: back from approvata to bozza; the recorded delibera stops counting. Refused once emanation started.",
  }),
  destructive("regulations.drafts.emanate", emanateDraft, {
    guard: "regulationsManageMiddleware",
    input: draftRefInputSchema,
    description:
      "Emana e notifica (RRI: PR, release, email and Telegram to Soci) or Pubblica (a documento). Public and irreversible.",
  }),
  write("regulations.diff.regenerate", regenerateDiff, {
    guard: "regulationsManageMiddleware",
    input: draftRefInputSchema,
    description: "Recompute a draft's differences and their LLM summary.",
  }),
  write("regulations.documents.sync", syncRegulationDocuments, {
    guard: "regulationsManageMiddleware",
    description:
      "Importa dal repository: import new documents and changed sola consultazione sources from documents.json; says what it skipped. Slow.",
  }),
  write("regulations.documents.create", createRegulationDocument, {
    guard: "regulationsManageMiddleware",
    input: createDocumentInputSchema,
    description:
      "Create a document from a template (templates.list): repo opens a GitHub pull request (In creazione until merged); private is kept in the backend.",
  }),
  destructive("regulations.documents.upload", uploadRegulationDocument, {
    guard: "regulationsManageMiddleware",
    input: uploadDocumentFieldsSchema,
    files: [{ field: "file", required: true, description: PDF_FILE }],
    description:
      "Carica un PDF: a new private, read-only document whose first version is the uploaded PDF. It can't be deleted afterwards.",
  }),
  destructive("regulations.versions.upload", uploadRegulationVersion, {
    guard: "regulationsManageMiddleware",
    input: uploadVersionFieldsSchema,
    files: [{ field: "file", required: true, description: PDF_FILE }],
    description:
      "Carica nuova versione: a new version of an uploaded-PDF document. Versions can't be deleted afterwards.",
  }),

  // Segretario (regulations:rectify)
  destructive("regulations.deleghe.create", createDelega, {
    guard: "regulationsRectifyMiddleware",
    input: createDelegaInputSchema,
    description:
      "Give someone (users.search) a delega to rectify one rri document or all, optionally until a date. Emails direttivo@polinetwork.org.",
  }),
  destructive("regulations.deleghe.revoke", revokeDelega, {
    guard: "regulationsRectifyMiddleware",
    input: delegaRefInputSchema,
    description: "Revoke a delega (id from deleghe.list). Emails direttivo@polinetwork.org.",
  }),

  // The draft's text, through the collab service
  ...regulationsSourceOperations,
]
