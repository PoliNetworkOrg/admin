import { z } from "zod"

import { errorHasZodField, errorMessage } from "@/lib/errors"

import { GROUP_LABEL_DESCRIPTION_MAX, GROUP_LABEL_MAX } from "./group-labels.constants"

const label = z.string().trim().min(1).max(GROUP_LABEL_MAX)
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/)
const description = z.string().trim().max(GROUP_LABEL_DESCRIPTION_MAX)

export const createGroupLabelInput = z.object({ label, color, description })
export const editGroupLabelInput = z.object({ label, color, description })
export const groupLabelIdentifierInput = z.object({ label })

export function groupLabelSaveErrorMessage(cause: unknown) {
  if (errorHasZodField(cause, "label")) return `Enter a label between 1 and ${GROUP_LABEL_MAX} characters.`
  if (errorHasZodField(cause, "color")) return "Choose a valid color."
  if (errorHasZodField(cause, "description")) {
    return `Enter a description no longer than ${GROUP_LABEL_DESCRIPTION_MAX} characters.`
  }
  if (/duplicate|unique/i.test(errorMessage(cause, ""))) return "A label with this name already exists."
  return "The label could not be saved. Check your permissions and try again."
}
