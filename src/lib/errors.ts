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
