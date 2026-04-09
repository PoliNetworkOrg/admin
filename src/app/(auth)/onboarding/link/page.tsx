import Image from "next/image"
import { redirect } from "next/navigation"
import loginSvg2 from "@/assets/svg/login-2.svg"
import { Card } from "@/components/ui/card"
import { env } from "@/env"
import { getServerSession } from "@/server/auth"
import { Logout } from "./logout"
import { TelegramLink } from "./telegram"

const BOT_USERNAME = env.NODE_ENV === "production" ? "pn_ts_dev_bot" : "pn_ts_devlocal_bot"

export default async function OnboardingLink() {
  const { data: session } = await getServerSession()
  if (!session || session.user.telegramId) redirect("/dashboard")

  return (
    <main className="grid grow place-content-center">
      <Card className="relative grid h-140 min-w-120 grow grid-rows-[5fr_auto_4fr] items-center">
        <div className="flex flex-col gap-y-4 place-self-center justify-self-center">
          <Image
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            src={loginSvg2}
            width={200}
            alt="insert credentials"
          />
          <div className="text-center">
            <p className="text-primary text-lg font-bold dark:text-white">Link your Telegram account</p>
            <p className="text-muted-foreground text-sm">This allows to verify your role</p>
          </div>
        </div>
        <hr />
        <TelegramLink botUsername={BOT_USERNAME} />
        <hr />
        <Logout email={session.user.email} />
      </Card>
    </main>
  )
}
