"use client"
import { useQuery } from "@tanstack/react-query"
import { useSession } from "@/lib/auth"
import { useTRPC } from "@/lib/trpc/client"

export function Telegram() {
  const { data: session, isPending } = useSession()
  if (isPending || !session) return null

  const { user } = session
  if (!user.telegramUsername || !user.telegramId) return null

  return <ShowTelegram username={user.telegramUsername} userId={user.telegramId} />
}

function ShowTelegram({ username, userId }: { username: string; userId: number }) {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.tg.permissions.getRoles.queryOptions({ userId }))
  return (
    <>
      <span>@{username}</span>
      {!isLoading && data?.roles?.length && (
        <span className="text-foreground/30 text-xs">(roles: {data.roles.join(" ")})</span>
      )}
    </>
  )
}
