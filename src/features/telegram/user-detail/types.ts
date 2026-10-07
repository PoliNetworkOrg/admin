import type { getTelegramUserDetails } from "@/features/telegram/users.functions"

export type TelegramUserDetail = Awaited<ReturnType<typeof getTelegramUserDetails>>
