import { createServerFn } from "@tanstack/react-start"

import { webAdminMiddleware, webWriteAdminMiddleware } from "@/server/auth.middleware"

import {
  addFAQCategoryInput,
  addFAQInput,
  deleteFAQCategoryInput,
  deleteFAQInput,
  editFAQCategoryInput,
  editFAQInput,
} from "./faqs.validation"

export const listFAQs = createServerFn()
  .middleware([webAdminMiddleware])
  .handler(({ context }) => context.backend.web.faqs.getAllFaqs.query())

export const addFAQ = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(addFAQInput)
  .handler(async ({ data, context }) => {
    return context.backend.web.faqs.addFaqs.mutate({
      ...data,
      createdBy: context.telegramId,
    })
  })

export const editFAQ = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(editFAQInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.faqs.editFaqs.mutate({
      ...data,
      modifiedBy: context.telegramId,
    })
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const deleteFAQ = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(deleteFAQInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.faqs.deleteFaqs.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const addFAQCategory = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(addFAQCategoryInput)
  .handler(async ({ data, context }) => {
    return context.backend.web.faqs.addFaqsCategory.mutate({
      ...data,
      icon: data.icon ?? null,
      createdBy: context.telegramId,
    })
  })

export const editFAQCategory = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(editFAQCategoryInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.faqs.editFaqsCategory.mutate({
      ...data,
      icon: data.icon ?? null,
      modifiedBy: context.telegramId,
    })
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const deleteFAQCategory = createServerFn({ method: "POST" })
  .middleware([webWriteAdminMiddleware])
  .validator(deleteFAQCategoryInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.faqs.deleteFaqsCategory.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })
