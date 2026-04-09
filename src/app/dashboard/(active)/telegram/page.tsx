import { UsersRound } from "lucide-react"
import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TelegramIndex() {
  return (
    <div className="container py-8 px-2 flex flex-col gap-4">
      <h2 className="text-accent-foreground text-3xl font-bold">Telegram</h2>
      <div className="gap-4 flex justify-start flex-wrap items-center">
        <Link href="/dashboard/telegram/audit">
          <Card className="w-90 hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <UsersRound size={20} />
                Audit Log
              </CardTitle>
              <CardDescription>See all recent mod actions</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
