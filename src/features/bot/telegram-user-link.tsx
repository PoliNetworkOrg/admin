import { Link } from "@tanstack/react-router"

export type TelegramUserRef = {
  telegramId: number
  firstName: string
  lastName?: string
  username?: string
}

export function telegramUserSearchText(user: TelegramUserRef) {
  return [user.firstName, user.lastName, user.username].filter(Boolean).join(" ")
}

export function TelegramUserLink({ user }: { user: TelegramUserRef }) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ")
  return (
    <Link
      to="/dashboard/telegram/users/$userId"
      params={{ userId: String(user.telegramId) }}
      className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
    >
      <span className="block font-medium">{name}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">
        {user.username ? `@${user.username}` : `Telegram ID ${user.telegramId}`}
      </span>
    </Link>
  )
}
