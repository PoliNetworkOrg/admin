import { getOverviewCounts, getTelegramUserHistory } from "@/features/dashboard/overview.functions"

import { read } from "../operation"

export const overviewOperations = [
  read("overview.counts.get", getOverviewCounts, {
    guard: "adminMiddleware",
    description:
      "The Overview's counts: Telegram groups, Telegram users, open link reports and active grants. A count is absent without its read permission and null when its source failed.",
  }),
  read("overview.telegramUsers.history", getTelegramUserHistory, {
    guard: "adminMiddleware",
    description:
      "New Telegram users per day (Europe/Rome dates), for the Overview chart. Status forbidden without tg:users:read, unavailable when the backend can't serve it.",
  }),
]
