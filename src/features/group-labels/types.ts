import type { TgGroupLabel } from "@/lib/api/types"

export type GroupLabel = TgGroupLabel

export type GroupLabelFormValues = {
  label: string
  color: string
  description: string
}
