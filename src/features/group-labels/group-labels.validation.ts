import { z } from "zod"

import { errorHasCode } from "@/lib/errors"

import { GROUP_LABEL_COLOR_NAMES, GROUP_LABEL_DESCRIPTION_MAX, GROUP_LABEL_MAX } from "./group-labels.constants"

const groupLabelFieldsInput = z.object({
  label: z.string().trim().min(1).max(GROUP_LABEL_MAX),
  color: z.enum(GROUP_LABEL_COLOR_NAMES),
  description: z.string().trim().max(GROUP_LABEL_DESCRIPTION_MAX),
})

export const createGroupLabelInput = groupLabelFieldsInput
export const editGroupLabelInput = groupLabelFieldsInput.extend({ id: z.number().int().positive() })
export const groupLabelIdInput = z.object({ id: z.number().int().positive() })

export function groupLabelSaveErrorMessage(cause: unknown) {
  if (errorHasCode(cause, "NOT_FOUND")) return "This label no longer exists."
  if (errorHasCode(cause, "INVALID_LABEL")) return `Enter a label no longer than ${GROUP_LABEL_MAX} characters.`
  if (errorHasCode(cause, "INVALID_DESCRIPTION")) {
    return `Enter a description no longer than ${GROUP_LABEL_DESCRIPTION_MAX} characters.`
  }
  return "The label could not be saved. Check your permissions and try again."
}
