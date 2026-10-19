import { initialFreshman } from "./freshman.data.ts"
import { freshmanCardInput, freshmanContentInput } from "./freshman.validation.ts"
import type { FreshmanCardInput, FreshmanContent } from "./types.ts"

const storageKey = "polinetwork.admin.freshman.mock.v1"

export class FreshmanDemoDataError extends Error {}

/** Browser-only fake API. Replace this adapter with authenticated server functions when the backend is ready. */
export function createFreshmanMockApi(storage: Pick<Storage, "getItem" | "setItem">) {
  function read() {
    const saved = storage.getItem(storageKey)
    if (saved === null) return freshmanContentInput.parse(initialFreshman)
    try {
      return freshmanContentInput.parse(JSON.parse(saved))
    } catch (error) {
      console.error(error)
      throw new FreshmanDemoDataError("Saved demo content is invalid.", { cause: error })
    }
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
    async resetContent() {
      return persist(freshmanContentInput.parse(initialFreshman))
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
  resetContent: async () => createFreshmanMockApi(window.localStorage).resetContent(),
  updateCard: async (section: "resources" | "telegram", id: string, input: FreshmanCardInput) =>
    createFreshmanMockApi(window.localStorage).updateCard(section, id, input),
  moveCard: async (section: "resources" | "telegram", id: string, direction: -1 | 1) =>
    createFreshmanMockApi(window.localStorage).moveCard(section, id, direction),
  selectFaq: async (index: number, faqId: string) => createFreshmanMockApi(window.localStorage).selectFaq(index, faqId),
}
