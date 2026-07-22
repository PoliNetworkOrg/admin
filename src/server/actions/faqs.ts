"use server"
import { requireRole } from "../auth"
import { trpc } from "../trpc"
import type { FAQs } from "../trpc/types"

export async function listFAQs(): Promise<FAQs> {
  return await trpc.web.faqs.getAllFaqs.query()
}

export async function addFAQ(input: {
  questionIt: string
  questionEn?: string
  answerIt: string
  answerEn?: string
  categoryId?: number
}) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president", "admin", "creator", "hr"])
  if (!allowed) {
    throw new Error("UNAUTHORIZED")
  }

  const qIt = input.questionIt
  const qEn = input.questionEn?.trim() || qIt
  const aIt = input.answerIt
  const aEn = input.answerEn?.trim() || aIt

  return trpc.web.faqs.addFaqs.mutate({
    titleIt: qIt,
    titleEn: qEn,
    descriptionIt: aIt,
    descriptionEn: aEn,
    categoryId: input.categoryId ?? 1,
    createdBy: telegramId,
  })
}

export async function editFAQ(input: {
  id: number
  questionIt: string
  questionEn?: string
  answerIt: string
  answerEn?: string
  categoryId?: number
}) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president", "admin", "creator", "hr"])
  if (!allowed) {
    throw new Error("UNAUTHORIZED")
  }

  const qIt = input.questionIt
  const qEn = input.questionEn?.trim() || qIt
  const aIt = input.answerIt
  const aEn = input.answerEn?.trim() || aIt

  return trpc.web.faqs.editFaqs.mutate({
    id: input.id,
    titleIt: qIt,
    titleEn: qEn,
    descriptionIt: aIt,
    descriptionEn: aEn,
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

export async function addFAQCategory(input: { titleIt: string; titleEn?: string; icon?: string | null }) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president", "admin", "creator", "hr"])
  if (!allowed) {
    throw new Error("UNAUTHORIZED")
  }

  return trpc.web.faqs.addFaqsCategory.mutate({
    titleIt: input.titleIt,
    titleEn: input.titleEn || input.titleIt,
    icon: input.icon ?? null,
    createdBy: telegramId,
  })
}

export async function editFAQCategory(input: { id: number; titleIt: string; titleEn?: string; icon?: string | null }) {
  const { allowed, telegramId } = await requireRole(["owner", "direttivo", "president", "admin", "creator", "hr"])
  if (!allowed) {
    throw new Error("UNAUTHORIZED")
  }

  return trpc.web.faqs.editFaqsCategory.mutate({
    id: input.id,
    titleIt: input.titleIt,
    titleEn: input.titleEn || input.titleIt,
    icon: input.icon ?? null,
    modifiedBy: telegramId,
  })
}

export async function deleteFAQCategory(input: { id: number }) {
  const { allowed } = await requireRole(["owner", "direttivo", "president", "admin", "creator", "hr"])
  if (!allowed) {
    throw new Error("UNAUTHORIZED")
  }

  return trpc.web.faqs.deleteFaqsCategory.mutate({ id: input.id })
}
