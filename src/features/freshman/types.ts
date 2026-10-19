import type { z } from "zod"

import type { FRESHMAN_ICON_NAMES } from "./freshman.constants"
import type { freshmanCard, freshmanCardInput, freshmanContentInput } from "./freshman.validation"

export type FreshmanIcon = (typeof FRESHMAN_ICON_NAMES)[number]
export type FreshmanCard = z.infer<typeof freshmanCard>
export type FreshmanCardInput = z.infer<typeof freshmanCardInput>
export type FreshmanContent = z.infer<typeof freshmanContentInput>
export type FreshmanCardErrors = Partial<Record<keyof FreshmanCardInput, string>>
export type FreshmanCardSection = "resources" | "telegram"
