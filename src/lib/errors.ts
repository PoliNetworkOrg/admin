const ERROR_FIELDS = ["message", "error", "code", "cause"] as const

function errorMessages(value: unknown, seen: Set<object>): string[] {
  if (typeof value === "string") return [value]
  if (!value || typeof value !== "object" || seen.has(value)) return []

  seen.add(value)
  const record = value as Record<string, unknown>
  return ERROR_FIELDS.flatMap((field) => errorMessages(record[field], seen))
}

export function errorHasCode(cause: unknown, code: string) {
  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const codePattern = new RegExp(`(^|[^A-Z0-9_])${escapedCode}($|[^A-Z0-9_])`)
  return errorMessages(cause, new Set()).some((message) => codePattern.test(message))
}

export function errorMessage(cause: unknown, fallback: string) {
  return errorMessages(cause, new Set()).find((message) => message.trim()) ?? fallback
}

function hasZodField(cause: unknown, field: string, seen: Set<object>): boolean {
  if (!cause || typeof cause !== "object" || seen.has(cause)) return false
  seen.add(cause)

  const record = cause as Record<string, unknown>
  const data = record.data
  if (data && typeof data === "object") {
    const zodError = (data as Record<string, unknown>).zodError
    if (zodError && typeof zodError === "object") {
      const properties = (zodError as Record<string, unknown>).properties
      if (properties && typeof properties === "object") {
        const fieldError = (properties as Record<string, unknown>)[field]
        if (fieldError && typeof fieldError === "object") {
          const errors = (fieldError as Record<string, unknown>).errors
          if (Array.isArray(errors) && errors.some((error) => typeof error === "string" && error.trim())) return true
        }
      }
    }
  }

  return hasZodField(record.error, field, seen) || hasZodField(record.cause, field, seen)
}

export function errorHasZodField(cause: unknown, field: string) {
  return hasZodField(cause, field, new Set())
}
