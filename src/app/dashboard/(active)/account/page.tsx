import { Calendar, CircleAlert, KeyIcon, UserIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import { getServerSession } from "@/server/auth"
import { SetName } from "./set-name"
import { Telegram } from "./telegram"
import { NewPasskeyButton } from "./passkey-button"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { Button } from "@/components/ui/button"

export default async function Account() {
  const { data: session } = await getServerSession()
  if (!session) return

  const { data: passkeys, error } = await auth.passkey.listUserPasskeys({
    fetchOptions: {
      headers: await headers(),
    },
  })

  console.log(passkeys, error)

  const { user } = session

  return (
    <main className="container mx-auto px-4 py-8">
      <h2 className="text-accent-foreground mb-4 text-3xl font-bold">Account</h2>
      <div className="flex gap-4 mb-12">
        <Avatar className="h-32 w-32 rounded-lg">
          {user.image && <AvatarImage src={user.image} alt={`propic of ${user.name}`} />}
          <AvatarFallback className="rounded-lg text-3xl">
            {user.name ? getInitials(user.name) : <UserIcon size={48} />}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {!user.name && <CircleAlert className="text-yellow-500" />}
            <span className="text-accent-foreground/70">Name:</span>
            {user.name ? <p>{user.name}</p> : <SetName />}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-accent-foreground/70">Email:</span>
            <p>{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-accent-foreground/70">Telegram:</span>
            <Telegram />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4 justify-start items-start">
        <h3>Passkeys</h3>
        {passkeys?.map((p) => (
          <div className="grid grid-cols-[auto_1fr_auto] w-full gap-4 items-center" key={p.id}>
            <div className="bg-primary/30 h-full aspect-square flex justify-center items-center rounded-lg">
              <KeyIcon size={16} />
            </div>
            <div>
              <p>{p.name}</p>
              <p className="text-muted-foreground text-xs flex justify-start items-center gap-1">
                <Calendar size={12} />
                Created on {p.createdAt.toLocaleDateString()}
              </p>
            </div>
            <Button variant="destructive">Delete</Button>
          </div>
        ))}
        <NewPasskeyButton />
      </div>
    </main>
  )
}
