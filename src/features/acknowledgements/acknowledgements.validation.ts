import { z } from "zod"

import { errorHasCode } from "../../lib/errors.ts"

export const ACKNOWLEDGEMENT_TITLE_MAX_LENGTH = 80
export const ACKNOWLEDGEMENT_NAME_MAX_LENGTH = 120
export const ACKNOWLEDGEMENT_DETAIL_MAX_LENGTH = 80
/** The backend's icons for a role group; `acknowledgement-icon.tsx` draws each one. */
export const ACKNOWLEDGEMENT_ICONS = ["settings", "palette", "code", "smile", "users", "megaphone"] as const

const id = z.number().int().positive()
const order = z
  .array(id)
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate ids")
const title = z
  .string()
  .trim()
  .min(1, "Inserisci un titolo.")
  .max(ACKNOWLEDGEMENT_TITLE_MAX_LENGTH, `Usa al massimo ${ACKNOWLEDGEMENT_TITLE_MAX_LENGTH} caratteri.`)
const icon = z.enum(ACKNOWLEDGEMENT_ICONS, "Scegli un'icona.")
const name = z
  .string()
  .trim()
  .min(1, "Inserisci un nome.")
  .max(ACKNOWLEDGEMENT_NAME_MAX_LENGTH, `Usa al massimo ${ACKNOWLEDGEMENT_NAME_MAX_LENGTH} caratteri.`)
/** An empty detail is stored as none. */
const detail = z
  .string()
  .trim()
  .max(ACKNOWLEDGEMENT_DETAIL_MAX_LENGTH, `Usa al massimo ${ACKNOWLEDGEMENT_DETAIL_MAX_LENGTH} caratteri.`)
const list = z.discriminatedUnion("section", [
  z.object({ section: z.literal("website"), groupId: id }).strict(),
  z.object({ section: z.literal("projects") }).strict(),
])

export const acknowledgementGroupInput = z.object({ title, icon }).strict()
export const updateAcknowledgementGroupInput = acknowledgementGroupInput.extend({ id }).strict()
export const reorderAcknowledgementGroupsInput = z.object({ ids: order }).strict()

export const acknowledgementInput = z.object({ list, name, detail }).strict()
export const updateAcknowledgementInput = z.object({ id, name, detail }).strict()
export const reorderAcknowledgementsInput = z.object({ list, ids: order }).strict()

export const acknowledgementIdInput = z.object({ id }).strict()

/** The first message of each invalid field, for the dialogs. */
export function fieldErrors<Field extends string>(error: z.ZodError, fields: readonly Field[]) {
  const errors: Partial<Record<Field, string>> = {}
  for (const issue of error.issues) {
    const field = fields.find((candidate) => candidate === issue.path[0])
    if (field && !errors[field]) errors[field] = issue.message
  }
  return errors
}

/** A clear message for every error the acknowledgements procedures and their server functions report. */
export function acknowledgementsErrorMessage(cause: unknown, fallback: string) {
  if (errorHasCode(cause, "UNAUTHORIZED")) return "Non hai i permessi per modificare i riconoscimenti del sito."
  if (errorHasCode(cause, "GROUP_NOT_FOUND")) return "Il gruppo non esiste più. Ricarica la pagina."
  if (errorHasCode(cause, "NOT_FOUND")) return "Non esiste più. Ricarica la pagina."
  if (errorHasCode(cause, "INVALID_ORDER")) {
    return "L'elenco è cambiato mentre lo riordinavi. Ricarica la pagina e riprova."
  }
  return fallback
}
