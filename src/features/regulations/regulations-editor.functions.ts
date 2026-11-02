import { createServerFn } from "@tanstack/react-start"

import { regulationsAssigneeMiddleware } from "@/server/auth.middleware"

import { regulationsApi } from "./regulations.api.server"
import {
  commentRefInputSchema,
  createCommentInputSchema,
  createSnapshotInputSchema,
  draftRefInputSchema,
  replyCommentInputSchema,
  snapshotRefInputSchema,
} from "./regulations.contract"

/**
 * The editor's writes: the collab ticket, comments and snapshots. Commenters and editors are per-draft assignments the
 * backend holds, so the dashboard admits the caller and the backend decides.
 */

/** A single-use ticket for the collab service, asked again on every (re)connection. */
export const issueCollabTicket = createServerFn({ method: "POST" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(draftRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).collabTicket(data))

export const createComment = createServerFn({ method: "POST" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(createCommentInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).createComment(data))

export const replyComment = createServerFn({ method: "POST" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(replyCommentInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).replyComment(data))

export const resolveComment = createServerFn({ method: "POST" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(commentRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).resolveComment(data))

export const reopenComment = createServerFn({ method: "POST" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(commentRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).reopenComment(data))

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(commentRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).deleteComment(data))

export const createSnapshot = createServerFn({ method: "POST" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(createSnapshotInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).createSnapshot(data))

/** Never destructive: the backend saves the current text as a snapshot first. */
export const restoreSnapshot = createServerFn({ method: "POST" })
  .middleware([regulationsAssigneeMiddleware])
  .validator(snapshotRefInputSchema)
  .handler(async ({ data, context }) => (await regulationsApi(context)).restoreSnapshot(data))
