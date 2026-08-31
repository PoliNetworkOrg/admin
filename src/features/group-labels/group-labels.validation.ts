import { z } from "zod"

import { errorHasZodField, errorMessage } from "@/lib/errors"

import { GROUP_LABEL_DESCRIPTION_MAX, GROUP_LABEL_MAX } from "./group-labels.constants"
import { isCategoryLabel, isValidLabelSegment } from "./label-tree"

const label = z.string().trim().min(1).max(GROUP_LABEL_MAX)
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/)
const description = z.string().trim().max(GROUP_LABEL_DESCRIPTION_MAX)

/**
 * The fixed category root a path is nested under, e.g. "didattica" for "didattica.design.triennale"; `null`
 * for a bare tag (tags have no root to preserve). Deliberately *not* "everything but the last segment": a
 * cascading rename re-paths every descendant at once (e.g. renaming "didattica.design" to "didattica.web" also
 * turns "didattica.design.triennale" into "didattica.web.triennale"), so only the outermost root stays the
 * same across the whole batch — the immediate parent segment shifts for every descendant by construction.
 */
function categoryRoot(value: string): string | null {
  const dotIndex = value.indexOf(".")
  return dotIndex === -1 ? null : value.slice(0, dotIndex)
}

/**
 * The server-side backstop for the label shapes the admin UI can produce (see CATEGORY_ROOTS in
 * label-tree.ts): a flat tag with no dots, a fixed category root used to hold groups directly, or a path nested
 * under one of those roots. The tag-creation UI still reserves the root names; allowing them here lets the
 * "Add group" flow materialize `extra` or `didattica` the first time a group is assigned directly to that root.
 * Only applied where a *new* path is being written into existence — fields that merely identify an already-existing
 * row (edit, delete, or the "from" side of a rename) stay unrestricted so a pre-existing row is always manageable.
 */
const newLabelPath = label.refine(
  (value) => {
    const segments = value.split(".")
    if (segments.some((segment) => !isValidLabelSegment(segment))) return false
    return segments.length === 1 || isCategoryLabel(value)
  },
  { message: "Use a plain tag name, a category root, or nest a category under an existing root." }
)

export const createGroupLabelInput = z.object({ label: newLabelPath, color, description })
export const editGroupLabelInput = z.object({ label, color, description })
export const renameGroupLabelInput = z
  .object({ label, newLabel: newLabelPath, color, description })
  .refine((data) => categoryRoot(data.label) === categoryRoot(data.newLabel), {
    message: "A rename can't move a label to a different category root, or turn a tag into a category (or back).",
    path: ["newLabel"],
  })
export const groupLabelIdentifierInput = z.object({ label })

export function groupLabelSaveErrorMessage(cause: unknown) {
  if (errorHasZodField(cause, "newLabel")) {
    return "A rename can't move a label to a different category root, or turn a tag into a category (or back)."
  }
  if (errorHasZodField(cause, "label")) {
    return `Enter a valid label: a plain tag name, a category root, or a category nested under an existing root (max ${GROUP_LABEL_MAX} characters).`
  }
  if (errorHasZodField(cause, "color")) return "Choose a valid color."
  if (errorHasZodField(cause, "description")) {
    return `Enter a description no longer than ${GROUP_LABEL_DESCRIPTION_MAX} characters.`
  }
  if (/duplicate|unique/i.test(errorMessage(cause, ""))) return "A label with this name already exists."
  return "The label could not be saved. Check your permissions and try again."
}
