import { createServerFn } from "@tanstack/react-start"

import { errorMessage } from "@/lib/errors"
import { peopleWriteMiddleware } from "@/server/auth.middleware"

import { todayIso } from "./people-format"
import { peopleApi } from "./people.api.server"
import {
  assignAdminInputSchema,
  capoRefInputSchema,
  endAssignmentInputSchema,
  type NewPersonResult,
  newPersonInputSchema,
  setNoteInputSchema,
  TEAMS,
  updatePersonInputSchema,
} from "./people.contract"

/**
 * Creates the record, then starts each role it was given, from today in Europe/Rome (the backend's calendar for start
 * dates, whatever the server's timezone). A role the backend refuses (no clearance, no role bound in Auth) doesn't
 * undo the record: the result lists it, with the backend's words, so the page can say so.
 */
export const createPerson = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(newPersonInputSchema)
  .handler(async ({ data, context }): Promise<NewPersonResult> => {
    const api = await peopleApi(context)
    const { admin, capoScope, teams, ...fields } = data
    const { id } = await api.createPerson(fields)
    const since = todayIso()
    const refused: NewPersonResult["refused"] = []
    const attempt = async (role: string, start: () => Promise<void>) => {
      try {
        await start()
        return true
      } catch (error) {
        console.error(error)
        refused.push({ role, message: errorMessage(error, "Refused.") })
        return false
      }
    }
    const isAdmin = admin && (await attempt("Admin", () => api.assignAdmin({ personId: id, since, capoId: null })))
    if (capoScope !== null) {
      if (isAdmin) await attempt("Capo Admin", () => api.appointCapo({ personId: id, since, scope: capoScope }))
      else refused.push({ role: "Capo Admin", message: "A Capo Admin must be an admin first." })
    }
    for (const { team, role } of teams)
      await attempt(`${TEAMS[team].name}${role === "lead" ? " Lead" : ""}`, () =>
        api.addTeamMember({ teamId: team, personId: id, role, since, fields: {} })
      )
    return { id, refused }
  })

export const updatePerson = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(updatePersonInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).updatePerson(data))

export const setPersonNote = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(setNoteInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).setNote(data))

/** Pending until the record is linked; for a linked record, sent to PoliNetwork Auth, which may refuse it. */
export const assignAdmin = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(assignAdminInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).assignAdmin(data))

export const endAdminRole = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(endAssignmentInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).endAdmin(data))

export const setCapoOfReference = createServerFn({ method: "POST" })
  .middleware([peopleWriteMiddleware])
  .validator(capoRefInputSchema)
  .handler(async ({ data, context }) => (await peopleApi(context)).setCapoOfReference(data))
