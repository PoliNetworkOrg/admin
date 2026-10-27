import { z } from "zod"

import { FRESHMAN_ICON_NAMES } from "./freshman.constants.ts"

const destination = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (value === "") return true
    if (value.startsWith("/") && !value.startsWith("//") && !/[\\\s]/.test(value)) return true
    if (!URL.canParse(value)) return false
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
  }, "Enter a site path or a full HTTP or HTTPS URL.")

export const freshmanIconInput = z.enum(FRESHMAN_ICON_NAMES)

export const freshmanCardInput = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(120),
  description: z.string().trim().max(1000),
  icon: freshmanIconInput,
  href: destination,
})

const freshmanSlotId = z
  .string()
  .regex(/^(?:featured-[12]|guides-[1-5]|materials-1|tools-[12]|telegram-[1-8])$/, "Unknown website slot.")

export const updateFreshmanCardInput = freshmanCardInput
  .extend({ id: freshmanSlotId })
  .strict()
  .superRefine((input, ctx) => {
    if (input.id.startsWith("telegram-") && !input.href)
      ctx.addIssue({ code: "custom", path: ["href"], message: "Enter a group link." })
  })

export const moveFreshmanCardInput = z
  .object({
    id: freshmanSlotId,
    direction: z.union([z.literal(-1), z.literal(1)]),
  })
  .strict()

export const selectFreshmanFaqInput = z
  .object({
    position: z.number().int().min(0).max(4),
    faqId: z.number().int().positive(),
  })
  .strict()
