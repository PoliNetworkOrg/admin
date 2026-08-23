import { z } from "zod"

export const addFAQInput = z.object({
  titleIt: z.string().min(1),
  titleEn: z.string().min(1),
  descriptionIt: z.string().min(1),
  descriptionEn: z.string().min(1),
  categoryId: z.number().int().positive(),
})

export const editFAQInput = addFAQInput.extend({
  id: z.number().int().positive(),
})

export const deleteFAQInput = z.object({
  id: z.number().int().positive(),
})

export const addFAQCategoryInput = z.object({
  titleIt: z.string().min(1),
  titleEn: z.string().min(1),
  icon: z.string().nullable().optional(),
})

export const editFAQCategoryInput = addFAQCategoryInput.extend({
  id: z.number().int().positive(),
})

export const deleteFAQCategoryInput = z.object({
  id: z.number().int().positive(),
})
