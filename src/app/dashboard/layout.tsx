import { SidebarProvider } from "@/components/ui/sidebar"
import { getServerSession } from "@/server/auth"
import { redirect } from "next/navigation"
import { getQueryClient, trpc } from "@/lib/trpc/server"

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

  return <SidebarProvider>{children}</SidebarProvider>
}
