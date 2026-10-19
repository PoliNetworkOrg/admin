import { z } from "zod"

import { FRESHMAN_ICON_NAMES } from "./freshman.constants.ts"
import { freshmanFaqCatalog, initialFreshman } from "./freshman.data.ts"

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

export const freshmanCard = freshmanCardInput.extend({ id: z.string(), group: z.string() })

export const freshmanContentInput = z
  .object({
    resources: z.array(freshmanCard).length(10),
    telegram: z.array(freshmanCard).length(8),
    faqIds: z.array(z.string()).length(5),
  })
  .superRefine((content, ctx) => {
    for (const section of ["resources", "telegram"] as const) {
      content[section].forEach((item, index) => {
        const slot = initialFreshman[section][index]
        if (!slot || item.id !== slot.id || item.group !== slot.group) {
          ctx.addIssue({ code: "custom", path: [section, index], message: "The website slots are fixed." })
        }
      })
    }
    if (
      new Set(content.faqIds).size !== 5 ||
      content.faqIds.some((id) => !freshmanFaqCatalog.some((faq) => faq.id === id))
    ) {
      ctx.addIssue({ code: "custom", path: ["faqIds"], message: "Choose five different FAQs from the catalog." })
    }
  })
