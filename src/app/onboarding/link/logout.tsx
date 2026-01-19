"use client"

import { auth } from "../../../lib/auth"
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function Logout({ email }: { email: string }) {
  const router = useRouter()

  async function handleLogout() {
    const { data, error } = await auth.signOut()
    if (data?.success || !error) {
      toast.success("Successfully logged out")
      return router.replace("/")
    }

    toast.error("There was an unexpected error")
    console.error({ error })
  }

  return <div className="text-xs text-muted-foreground text-center py-2">
    <p>Logged in as <span className="">{email}</span></p>
    <span>Wrong account?</span> <button onClick={handleLogout} className="cursor-pointer underline hover:text-accent-foreground">Logout</button>
  </div>
}
