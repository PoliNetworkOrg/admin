"use client"

import type { User } from "better-auth"
import { Pencil, UserIcon } from "lucide-react"
import { useRef } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import { updateProfilePic } from "@/server/actions/users"

type Props = {
  user: User
}

export function ProfilePic({ user }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      const selectedFile = files[0]
      if (!selectedFile) return
      const { success } = await updateProfilePic(user.id, selectedFile)
      console.log(success)
    }
  }

  return (
    <Avatar className="h-32 w-32 rounded-lg after:rounded-lg relative group">
      <div
        className="absolute top-0 left-0 w-full h-full group-hover:opacity-100 opacity-0 bg-background/80 transition-all cursor-pointer z-10 grid place-content-center duration-100"
        onClick={() => fileInputRef.current?.click()}
      >
        <Pencil />
        <input
          className="hidden"
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple={false}
          accept="image/png,image/jpeg"
        />
      </div>

      {user.image && <AvatarImage src={user.image} alt={`propic of ${user.name}`} />}
      <AvatarFallback className="rounded-lg text-3xl">
        {user.name ? getInitials(user.name) : <UserIcon size={48} />}
      </AvatarFallback>
    </Avatar>
  )
}
