import type { TgGroupLabel } from "@/lib/api/types"

export type GroupLabel = TgGroupLabel

/** Color and description are the only fields ever edited inline — the name is set once at creation and only
 * ever changed through the dedicated rename flow (which cascades to descendants for categories). */
export type GroupLabelEditValues = {
  color: string
  description: string
}
