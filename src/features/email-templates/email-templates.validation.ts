import { z } from "zod"

export const addEmailTemplateInput = z.object({
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
})

export const editEmailTemplateInput = addEmailTemplateInput.extend({
  id: z.number().int().positive(),
})

export const deleteEmailTemplateInput = z.object({
  id: z.number().int().positive(),
})
