import Image from "next/image"
import { redirect } from "next/navigation"
import loginSvg2 from "@/assets/svg/login-2.svg"
import { Card } from "@/components/ui/card"
import { getUserRoles } from "@/server/actions/users"
import { getServerSession } from "@/server/auth"
import { Logout } from "../link/logout"

export default async function OnboardingNoRole() {
  const { data: session } = await getServerSession()
  if (!session) redirect("/login")
  if (!session.user.telegramId) redirect("/onboarding/link")

  const { roles } = await getUserRoles(session.user.telegramId)
  if (roles?.includes("creator")) redirect("/onboarding/unauthorized")
  if (roles && roles.length > 0) redirect("/dashboard")

  return (
    <main className="grid grow place-content-center">
      <Card className="relative grid h-140 min-w-120 grow items-center">
        <div className="flex flex-col gap-y-4 place-self-center justify-self-center">
          <Image
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            src={loginSvg2}
            width={200}
            alt="insert credentials"
          />
          <div className="text-center">
            <p className="text-primary text-lg font-bold dark:text-white">Your account is not enabled</p>
            <p className="text-muted-foreground text-sm">Please contact an IT member</p>
          </div>
        </div>

        <Logout email={session.user.email} />
      </Card>
    </main>
  )
}
