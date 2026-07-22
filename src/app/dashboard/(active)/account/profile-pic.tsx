"use client"

import type { User } from "better-auth"
import { useRouter } from "next/navigation"
import { forwardRef, useRef } from "react"
import { FiEdit2, FiUpload, FiUser, FiX } from "react-icons/fi"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { auth, useSession } from "@/lib/auth"
import { getInitials } from "@/lib/utils"
import { updateProfilePic } from "@/server/actions/users"

type Props = {
  user: User
}

export function ProfilePic({ user }: Props) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { refetch } = useSession()

  async function handleRemove() {
    const ok = confirm("Are you sure you want to reset your profile picture?")
    if (!ok) return

    const r = await auth.updateUser({ image: null })
    if (r.error) {
      toast.error("There was an error")
      console.error(r.error)
      return
    }

    toast.success("Profile picture removed successfully'")
    await refetch()
    router.refresh()
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Avatar className="h-32 w-32 rounded-full relative group peer">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <div className="absolute top-0 left-0 w-full h-full group-hover:opacity-100 opacity-0 bg-background/70 backdrop-blur-[1px] transition-all cursor-pointer z-10 grid place-content-center duration-100">
              <FiEdit2 size={32} />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => uploadRef.current?.click()}>
              <FiUpload /> Upload
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRemove} variant="destructive" disabled={!user.image}>
              <FiX /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <UploadProfilePicture ref={uploadRef} />

        <AvatarImage src={user.image || undefined} alt={`propic of ${user.name}`} />
        <AvatarFallback className="rounded-full text-3xl text-foreground">
          {user.name ? getInitials(user.name) : <FiUser size={48} />}
        </AvatarFallback>
      </Avatar>
      <p className="peer-hover:opacity-100 opacity-0 text-xs">Max 1MB</p>
    </div>
  )
}

const UploadProfilePicture = forwardRef<HTMLInputElement>((_, ref) => {
  const router = useRouter()
  const { refetch } = useSession()

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      const selectedFile = files[0]
      if (!selectedFile) return

      if (selectedFile.size > 1024 * 1024) {
        toast.error("The image must be no larger than 1 MB")
        return
      }

      if (selectedFile.type !== "image/png" && selectedFile.type !== "image/jpeg") {
        toast.error("The image must be jpeg or png")
        return
      }

      const { success } = await updateProfilePic(selectedFile)
      if (success) toast.success("Image changed successfully!")
      else toast.error("There was an error, try again")
      await refetch()
      router.refresh()
    }
  }
  return (
    <input
      className="hidden"
      type="file"
      ref={ref}
      onChange={handleFileChange}
      multiple={false}
      accept="image/png,image/jpeg"
      maxLength={1024 * 1024}
    />
  )
})
