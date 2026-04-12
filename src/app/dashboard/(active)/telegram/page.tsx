import { Group, Shield, Sparkle, Users } from "lucide-react"
import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function TelegramIndex() {
  return (
    <div className="container py-8 px-2 flex flex-col gap-4">
      <h2 className="text-accent-foreground text-3xl font-bold">Telegram</h2>
      <div className="gap-4 flex justify-start flex-wrap items-center">
        <Link href="/dashboard/telegram/groups">
          <Card className="w-90 hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <Group size={20} />
                Groups
              </CardTitle>
              <CardDescription>Search groups and get links</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/dashboard/telegram/user-details">
          <Card className="w-90 hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <Shield size={20} />
                User Details
              </CardTitle>
              <CardDescription>Manage user roles and group admins</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/dashboard/telegram/user-list">
          <Card className="w-90 hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <Users size={20} />
                User List
              </CardTitle>
              <CardDescription>See list of all our users</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/dashboard/telegram/grants">
          <Card className="w-90 hover:bg-accent transition-colors">
            <CardHeader>
              <CardTitle className="flex gap-2 items-center">
                <Sparkle size={20} />
                Grants
              </CardTitle>
              <CardDescription>Manage grants</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
