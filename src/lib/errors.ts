import { z } from "zod"

const ERROR_FIELDS = ["message", "error", "code", "cause"] as const
const MAX_ERROR_DEPTH = 8

const errorRecordSchema = z.object({
  message: z.unknown().optional(),
  error: z.unknown().optional(),
  code: z.unknown().optional(),
  cause: z.unknown().optional(),
})

const zodFieldErrorsSchema = z.object({
  data: z.object({
    zodError: z.object({
      properties: z.record(
        z.string(),
        z.object({
          errors: z.array(z.string()),
        })
      ),
    }),
  }),
})

function errorMessages<Value>(value: Value, depth: number): string[] {
  const message = z.string().safeParse(value)
  if (message.success) return [message.data]
  if (depth >= MAX_ERROR_DEPTH) return []

  const record = errorRecordSchema.safeParse(value)
  if (!record.success) return []
  return ERROR_FIELDS.flatMap((field) => errorMessages(record.data[field], depth + 1))
}

export function errorHasCode(cause: unknown, code: string) {
  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const codePattern = new RegExp(`(^|[^A-Z0-9_])${escapedCode}($|[^A-Z0-9_])`)
  return errorMessages(cause, 0).some((message) => codePattern.test(message))
}

export function errorMessage(cause: unknown, fallback: string) {
  return errorMessages(cause, 0).find((message) => message.trim()) ?? fallback
}

function hasZodField<Value>(cause: Value, field: string, depth: number): boolean {
  const zodErrors = zodFieldErrorsSchema.safeParse(cause)
  if (zodErrors.success && zodErrors.data.data.zodError.properties[field]?.errors.some((error) => error.trim())) {
    return true
  }
  if (depth >= MAX_ERROR_DEPTH) return false

  const record = errorRecordSchema.safeParse(cause)
  if (!record.success) return false
  return hasZodField(record.data.error, field, depth + 1) || hasZodField(record.data.cause, field, depth + 1)
}

export function errorHasZodField(cause: unknown, field: string) {
  return hasZodField(cause, field, 0)
}
