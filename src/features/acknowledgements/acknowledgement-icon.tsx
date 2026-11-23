import { Code, type LucideIcon, Megaphone, Palette, Settings, Smile, Users } from "lucide-react"
import type React from "react"

import type { AcknowledgementIconName } from "./types"

/** Each backend icon, drawn with its closest lucide glyph (the website uses react-icons), and its Italian name. */
export const ACKNOWLEDGEMENT_ICON_MAP = {
  settings: { icon: Settings, label: "Ingranaggio" },
  palette: { icon: Palette, label: "Tavolozza" },
  code: { icon: Code, label: "Codice" },
  smile: { icon: Smile, label: "Sorriso" },
  users: { icon: Users, label: "Persone" },
  megaphone: { icon: Megaphone, label: "Megafono" },
} as const satisfies Record<AcknowledgementIconName, { icon: LucideIcon; label: string }>

export function AcknowledgementIcon({
  icon,
  ...props
}: { icon: AcknowledgementIconName } & Omit<React.ComponentProps<"svg">, "name">) {
  const Icon = ACKNOWLEDGEMENT_ICON_MAP[icon].icon
  return <Icon {...props} />
}
