import type { z } from "zod"

import type { ApiOutput, FAQItem } from "@/lib/api/types"

import type { FRESHMAN_ICON_NAMES } from "./freshman.constants"
import type { freshmanCardInput } from "./freshman.validation"

export type FreshmanIcon = (typeof FRESHMAN_ICON_NAMES)[number]
export type FreshmanCard = FreshmanContent["resources"][number]
export type FreshmanCardInput = z.infer<typeof freshmanCardInput>
export type FreshmanContent = ApiOutput["web"]["freshman"]["getContent"]
export type FreshmanFaq = FAQItem
export type FreshmanCardErrors = Partial<Record<keyof FreshmanCardInput, string>>
export type FreshmanCardSection = "resources" | "telegram"
