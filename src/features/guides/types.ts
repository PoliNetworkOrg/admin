import type { ApiOutput } from "@/lib/api/types"

export type Guide = ApiOutput["web"]["guides_matricole"]["getAllGuides"][number]
