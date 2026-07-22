import { redirect } from "next/navigation"
import { FiLogOut } from "react-icons/fi"
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
      <FiLogOut />
      Logout
    </Button>
  )
}
