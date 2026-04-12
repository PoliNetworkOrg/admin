import Image from "next/image"
import Link from "next/link"
import azureSvg from "@/assets/svg/azure.svg"
import telegramSvg from "@/assets/svg/telegram.svg"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getServerSession } from "@/server/auth"
import { CompleteProfile } from "./complete-profile"

export default async function AdminHome() {
  const { data: session } = await getServerSession()
  return (
    session && (
      <div className="container py-8 px-2">
        <CompleteProfile user={session.user} />
        <h2 className="text-accent-foreground mb-4 text-3xl font-bold">Home</h2>

        <div className="gap-4 flex justify-start flex-wrap items-center">
          <Link href="/dashboard/azure">
            <Card className="w-90 hover:bg-accent transition-colors">
              <CardHeader>
                <CardTitle className="flex gap-2">
                  <Image alt="azure logo" src={azureSvg} className="size-5" />
                  Azure
                </CardTitle>
                <CardDescription>Manage Azure related things</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/dashboard/telegram">
            <Card className="w-90 hover:bg-accent transition-colors">
              <CardHeader>
                <CardTitle className="flex gap-2">
                  <Image alt="telegram logo" src={telegramSvg} className="size-5" />
                  Telegram
                </CardTitle>
                <CardDescription>Manage Telegram related things</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    )
  )
}
