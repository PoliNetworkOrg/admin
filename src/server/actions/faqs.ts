"use server"
import { requireRole } from "../auth"
import { trpc } from "../trpc"
import type { FAQs } from "../trpc/types"

export async function listFAQs(): Promise<FAQs> {
  return await trpc.web.faqs.getAllFaqs.query()
}

export async function addFAQ(input: { question: string; answer: string; categoryId?: number }) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president", "admin", "creator", "hr"])
  if (!allowed) {
    throw new Error("UNAUTHORIZED")
  }

  return trpc.web.faqs.addFaqs.mutate({
    titleIt: input.question,
    titleEn: input.question,
    descriptionIt: input.answer,
    descriptionEn: input.answer,
    categoryId: input.categoryId ?? 1,
    createdBy: telegramId,
  })
}

export async function editFAQ(input: { id: number; question: string; answer: string; categoryId?: number }) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president", "admin", "creator", "hr"])
  if (!allowed) {
    throw new Error("UNAUTHORIZED")
  }

  return trpc.web.faqs.editFaqs.mutate({
    id: input.id,
    titleIt: input.question,
    titleEn: input.question,
    descriptionIt: input.answer,
    descriptionEn: input.answer,
    categoryId: input.categoryId ?? 1,
    modifiedBy: telegramId,
  })
}

export async function deleteFAQ(input: { id: number }) {
  const { allowed } = await requireRole(["owner", "direttivo", "president", "admin", "creator", "hr"])
  if (!allowed) {
    throw new Error("UNAUTHORIZED")
  }

  return trpc.web.faqs.deleteFaqs.mutate({ id: input.id })
}
