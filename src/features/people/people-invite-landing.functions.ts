import { createServerFn } from "@tanstack/react-start"
import { TRPCClientError } from "@trpc/client"

import { errorMessage } from "@/lib/errors"
import { peopleInviteMiddleware } from "@/server/auth.middleware"

import { peopleApi } from "./people.api.server"
import { type Assignment, type InvitePreview, inviteTokenInputSchema } from "./people.contract"

/** Who the invite is for, or why the link no longer works, in the backend's words. */
export type InviteCheck =
  | { status: "valid"; preview: InvitePreview; account: string }
  | { status: "invalid"; message: string; account: string }

/** After accepting: the record's roles once the account can read them, or `waiting` while Auth applies them. */
export type InviteOutcome =
  | { status: "linked"; name: string; assignments: Assignment[] }
  | { status: "waiting"; account: string }

function accountLabel(user: { name: string; email: string }) {
  return user.email || user.name
}

export const checkPeopleInvite = createServerFn({ method: "GET" })
  .middleware([peopleInviteMiddleware])
  .validator(inviteTokenInputSchema)
  .handler(async ({ data, context }): Promise<InviteCheck> => {
    const account = accountLabel(context.user)
    try {
      const preview = await (await peopleApi(context)).previewInvite(data)
      return { status: "valid", preview, account }
    } catch (error) {
      console.error(error)
      // A spent, revoked or expired token is the backend's NOT_FOUND (the agent-mode fake throws a plain error).
      // Anything else, such as the backend being down, isn't the link's fault: the route's error state offers a
      // retry instead of telling the person to ask for a new invite.
      const deadLink = error instanceof TRPCClientError ? error.data?.code === "NOT_FOUND" : context.agentMode
      if (!deadLink) throw error
      return { status: "invalid", message: errorMessage(error, "This invite link doesn't work."), account }
    }
  })

/** Links the signed-in account to the invited record; each pending role then goes to Auth as whoever assigned it. */
export const acceptPeopleInvite = createServerFn({ method: "POST" })
  .middleware([peopleInviteMiddleware])
  .validator(inviteTokenInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).acceptInvite(data))

/**
 * The linked record's roles and where they stand with Auth. My area needs `people:self`, which most people only hold
 * once Auth has applied their roles: until then this answers `waiting`.
 */
export const getPeopleInviteOutcome = createServerFn({ method: "GET" })
  .middleware([peopleInviteMiddleware])
  .handler(async ({ context }): Promise<InviteOutcome> => {
    const waiting = { status: "waiting", account: accountLabel(context.user) } as const
    if (!context.permissions.includes("people:self")) return waiting
    try {
      const area = await (await peopleApi(context)).getMyArea()
      if (area.state !== "linked") return waiting
      return {
        status: "linked",
        name: `${area.person.firstName} ${area.person.lastName}`,
        assignments: area.person.assignments,
      }
    } catch (error) {
      console.error(error)
      return waiting
    }
  })
