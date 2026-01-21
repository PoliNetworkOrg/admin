<<<<<<< HEAD
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { getServerSession } from "@/server/auth";
import { Telegram } from "./telegram";
import { SetName } from "./set-name";
import { CircleAlert, UserIcon } from "lucide-react";
=======
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import { getServerSession } from "@/server/auth"
import { Telegram } from "./telegram"
>>>>>>> main

export default async function Account() {
  const { data: session } = await getServerSession()
  if (!session) return

  const { user } = session

  return (
    <main className="container mx-auto px-4 py-8">
      <h2 className="text-accent-foreground mb-4 text-3xl font-bold">Account</h2>

      <div className="flex gap-4">
        <Avatar className="h-32 w-32 rounded-lg">
<<<<<<< HEAD
          {user.image && (
            <AvatarImage src={user.image} alt={`propic of ${user.name}`} />
          )}
          <AvatarFallback className="rounded-lg text-3xl">
            {user.name ? getInitials(user.name) : <UserIcon size={48} />}
          </AvatarFallback>
=======
          {user.image && <AvatarImage src={user.image} alt={`propic of ${user.name}`} />}
          <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
>>>>>>> main
        </Avatar>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {!user.name && <CircleAlert className="text-yellow-500" />}
            <span className="text-accent-foreground/70">Name:</span>
            {user.name ?
              <p>{user.name}</p>
              :
              <SetName />
            }
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
    </main>
  )
}
