import { getUserRoles } from "@/server/actions/users"
import { getServerSession } from "@/server/auth"

export async function Telegram() {
  const { data } = await getServerSession()
  if (!data || !data.user.telegramId) return null

  const { roles } = await getUserRoles(data.user.telegramId)

  return (
    <>
      <span>@{data.user.telegramUsername}</span>
      {roles?.length && <span className="text-foreground/30 text-xs">(roles: {roles.join(", ")})</span>}
    </>
  )
}
