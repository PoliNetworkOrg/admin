import { z } from "zod"

const ERROR_FIELDS = ["message", "error", "code", "cause"] as const
const MAX_ERROR_DEPTH = 8

const errorRecordSchema = z.object({
  message: z.unknown().optional(),
  error: z.unknown().optional(),
  code: z.unknown().optional(),
  cause: z.unknown().optional(),
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
