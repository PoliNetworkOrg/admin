export type ExceptionType = "BOT_ERROR" | "HTTP_ERROR" | "GENERIC" | "UNHANDLED_PROMISE" | "UNKNOWN"

export type ExceptionRow = {
  id: string
  type: ExceptionType
  message: string
  context?: string
  createdAt: Date
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000)

export const MOCK_EXCEPTIONS: ExceptionRow[] = [
  {
    id: "1",
    type: "BOT_ERROR",
    message: "400: Bad Request - message to delete not found",
    context: "Moderation.deleteMessages",
    createdAt: minutesAgo(12),
  },
  {
    id: "2",
    type: "HTTP_ERROR",
    message: "FetchError: request to api.telegram.org failed, reason: ETIMEDOUT",
    context: "TgLogger.forward",
    createdAt: minutesAgo(90),
  },
  {
    id: "3",
    type: "UNHANDLED_PROMISE",
    message: "TypeError: Cannot read properties of undefined (reading 'id')",
    context: "modules/moderation/ban-all-executor.ts",
    createdAt: minutesAgo(240),
  },
  {
    id: "4",
    type: "GENERIC",
    message: "Redis connection lost, falling back to in-memory store",
    context: "RedisFallbackAdapter",
    createdAt: minutesAgo(360),
  },
  {
    id: "5",
    type: "BOT_ERROR",
    message: "403: Forbidden - bot was kicked from the group chat",
    context: "TgLogger.groupManagement",
    createdAt: minutesAgo(500),
  },
  {
    id: "6",
    type: "UNKNOWN",
    message: 'Non-Error value thrown: "rate limited"',
    context: "commands/moderation/banall.ts",
    createdAt: minutesAgo(720),
  },
]
