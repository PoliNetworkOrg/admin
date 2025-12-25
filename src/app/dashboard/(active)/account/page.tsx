import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import { getServerSession } from "@/server/auth"
import { Telegram } from "./telegram"

export default async function Account() {
  const { data: session } = await getServerSession()
  if (!session) return

  const { user } = session

  return (
    <main className="container mx-auto px-4 py-8">
      <h2 className="text-accent-foreground mb-4 text-3xl font-bold">Account</h2>

      <div className="flex gap-4">
        <Avatar className="h-32 w-32 rounded-lg">
          {user.image && <AvatarImage src={user.image} alt={`propic of ${user.name}`} />}
          <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
        </Avatar>

        <div>
          <p>{user.name}</p>
          <p>{user.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-accent-foreground/70">Telegram: </p>
            <Telegram />
          </div>
        </div>
      </div>
    </main>
  )
}
