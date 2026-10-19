import { z } from "zod"

import { freshmanFaqCatalog, initialFreshman } from "./freshman.data.ts"

export const freshmanIconNames = [
  "chart",
  "monitor",
  "book",
  "map",
  "news",
  "money",
  "folder",
  "repeat",
  "refresh",
  "bell",
  "user",
  "users",
  "cart",
  "home",
] as const

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

export const freshmanIconInput = z.enum(freshmanIconNames)

export const freshmanCardInput = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(120),
  description: z.string().trim().max(1000),
  icon: freshmanIconInput,
  href: destination,
})

const card = freshmanCardInput.extend({ id: z.string(), group: z.string() })
export type FreshmanCard = z.infer<typeof card>
export type FreshmanCardInput = z.infer<typeof freshmanCardInput>

export const freshmanContentInput = z
  .object({
    resources: z.array(card).length(10),
    telegram: z.array(card).length(8),
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

export type FreshmanContent = z.infer<typeof freshmanContentInput>
const storageKey = "polinetwork.admin.freshman.mock.v1"

/** Browser-only fake API. Replace this adapter with authenticated server functions when the backend is ready. */
export function createFreshmanMockApi(storage: Pick<Storage, "getItem" | "setItem">) {
  function read() {
    const saved = storage.getItem(storageKey)
    return freshmanContentInput.parse(saved === null ? initialFreshman : JSON.parse(saved))
  }
  function persist(content: FreshmanContent) {
    const valid = freshmanContentInput.parse(content)
    storage.setItem(storageKey, JSON.stringify(valid))
    return valid
  }
  return {
    async getContent() {
      return read()
    },
    async updateCard(section: "resources" | "telegram", id: string, input: FreshmanCardInput) {
      const values = freshmanCardInput.parse(input)
      if (section === "telegram" && !values.href) throw new Error("Enter a group link.")
      const content = read()
      const index = content[section].findIndex((item) => item.id === id)
      if (index < 0) throw new Error("This website slot does not exist.")
      content[section][index] = { ...content[section][index], ...values }
      return persist(content)
    },
    async moveCard(section: "resources" | "telegram", id: string, direction: -1 | 1) {
      const content = read()
      const index = content[section].findIndex((item) => item.id === id)
      const current = content[section][index]
      const next = content[section][index + direction]
      if (!current || !next || current.group !== next.group || ![-1, 1].includes(direction)) {
        throw new Error("Cards can only move within their website section.")
      }
      content[section][index] = { ...next, id: current.id, group: current.group }
      content[section][index + direction] = { ...current, id: next.id, group: next.group }
      return persist(content)
    },
    async selectFaq(index: number, faqId: string) {
      const content = read()
      if (!Number.isInteger(index) || index < 0 || index >= content.faqIds.length) throw new Error("Invalid FAQ slot.")
      const previousIndex = content.faqIds.indexOf(faqId)
      if (previousIndex >= 0) content.faqIds[previousIndex] = content.faqIds[index]
      content.faqIds[index] = faqId
      return persist(content)
    },
  }
}

export const freshmanApi = {
  getContent: async () => createFreshmanMockApi(window.localStorage).getContent(),
  updateCard: async (section: "resources" | "telegram", id: string, input: FreshmanCardInput) =>
    createFreshmanMockApi(window.localStorage).updateCard(section, id, input),
  moveCard: async (section: "resources" | "telegram", id: string, direction: -1 | 1) =>
    createFreshmanMockApi(window.localStorage).moveCard(section, id, direction),
  selectFaq: async (index: number, faqId: string) => createFreshmanMockApi(window.localStorage).selectFaq(index, faqId),
}
