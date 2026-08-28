import type { GroupLabelColorName } from "./group-labels.constants"

export type GroupLabel = {
  id: number
  label: string
  color: GroupLabelColorName
  description: string
}

export type GroupLabelFormValues = Pick<GroupLabel, "label" | "color" | "description">
