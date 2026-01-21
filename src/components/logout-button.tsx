import { LogOut } from "lucide-react"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth"

export function LogoutButton() {
  return (
    <Button
      onClick={async () => {
        await signOut()
        redirect("/login")
      }}
      variant="destructive"
      type="submit"
    >
      <LogOut />
      Logout
    </Button>
  )
}
