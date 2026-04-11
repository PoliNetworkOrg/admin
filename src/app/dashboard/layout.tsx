import { redirect } from "next/navigation"
import { AdminHeader } from "@/components/admin-header"
import { getQueryClient, trpc } from "@/lib/trpc/server"
import { getServerSession } from "@/server/auth"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession()
  // console.log(session)
  if (!session.data) redirect("/login")

  const tgId = session.data.user.telegramId
  if (!tgId) redirect("/onboarding/link")
  // if (session?.user.role === USER_ROLE.INACTIVE) ;
  // if (session?.user.role === USER_ROLE.DISABLED) redirect("/dashboard/disabled");

  const qc = getQueryClient()
  const { roles } = await qc.fetchQuery(trpc.tg.permissions.getRoles.queryOptions({ userId: tgId }))
  if (!roles || roles.length === 0) redirect("/onboarding/no-role")
  if (roles.includes("creator")) redirect("/onboarding/unauthorized")

  // temp until we have route-based permissions check
  if (roles.includes("owner") || roles.includes("direttivo") || roles.includes("president"))
    redirect("/onboarding/unauthorized")

  return (
    <>
      <AdminHeader />
      {children}
    </>
  )
}
