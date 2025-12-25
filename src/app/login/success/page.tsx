import { redirect } from "next/navigation"
import { getQueryClient, trpc } from "@/lib/trpc/server"
import { getServerSession } from "@/server/auth"

export default async function LoginSuccess() {
  const session = await getServerSession()
  if (!session.data) redirect("/login")

  const tgId = session.data.user.telegramId
  if (!tgId) redirect("/onboarding/link")
  // if (session?.user.role === USER_ROLE.INACTIVE) ;
  // if (session?.user.role === USER_ROLE.DISABLED) redirect("/dashboard/disabled");

  const qc = getQueryClient()
  const { role } = await qc.fetchQuery(trpc.tg.permissions.getRole.queryOptions({ userId: tgId }))
  if (role === "user") redirect("/onboarding/no-role")
  if (role === "creator") redirect("/onboarding/unauthorized")
  return redirect("/dashboard")
}
