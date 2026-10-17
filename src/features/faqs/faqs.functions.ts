import { createServerFn } from "@tanstack/react-start"

import { adminMiddleware, webContentWriteMiddleware } from "@/server/auth.middleware"

import {
  addFAQCategoryInput,
  addFAQInput,
  deleteFAQCategoryInput,
  deleteFAQInput,
  editFAQCategoryInput,
  editFAQInput,
} from "./faqs.validation"

export const listFAQs = createServerFn()
  .middleware([adminMiddleware])
  .handler(({ context }) => context.backend.web.faqs.getAllFaqs.query())

export const addFAQ = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(addFAQInput)
  .handler(async ({ data, context }) => {
    return context.backend.web.faqs.addFaqs.mutate(data)
  })

export const editFAQ = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(editFAQInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.faqs.editFaqs.mutate(data)
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const deleteFAQ = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(deleteFAQInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.faqs.deleteFaqs.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })

export const addFAQCategory = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(addFAQCategoryInput)
  .handler(async ({ data, context }) => {
    return context.backend.web.faqs.addFaqsCategory.mutate({
      ...data,
      icon: data.icon ?? null,
    })
  })

export const editFAQCategory = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(editFAQCategoryInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.faqs.editFaqsCategory.mutate({
      ...data,
      icon: data.icon ?? null,
    })
    if ("error" in result) throw new Error(result.error)
    return result
  })

export const deleteFAQCategory = createServerFn({ method: "POST" })
  .middleware([webContentWriteMiddleware])
  .validator(deleteFAQCategoryInput)
  .handler(async ({ data, context }) => {
    const result = await context.backend.web.faqs.deleteFaqsCategory.mutate(data)
    if (result.error) throw new Error(result.error)
    return result
  })
