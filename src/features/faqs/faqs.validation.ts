import { z } from "zod"

export const addFaqInput = z.object({
  titleIt: z.string().min(1),
  titleEn: z.string().min(1),
  descriptionIt: z.string().min(1),
  descriptionEn: z.string().min(1),
  categoryId: z.number().int().positive(),
})

export const editFaqInput = addFaqInput.extend({
  id: z.number().int().positive(),
})

export const deleteFaqInput = z.object({
  id: z.number().int().positive(),
})

export const addFaqCategoryInput = z.object({
  titleIt: z.string().min(1),
  titleEn: z.string().min(1),
  icon: z.string().nullable().optional(),
})

export const editFaqCategoryInput = addFaqCategoryInput.extend({
  id: z.number().int().positive(),
})

export const deleteFaqCategoryInput = z.object({
  id: z.number().int().positive(),
})
