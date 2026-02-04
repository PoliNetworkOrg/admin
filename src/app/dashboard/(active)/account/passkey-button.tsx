"use client"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function NewPasskeyButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  return (
    <Button
      disabled={isLoading}
      onClick={async () => {
        setIsLoading(true)
        const { data, error } = await auth.passkey.addPasskey({ name: "default" })
        setIsLoading(false)
        if (error) {
          console.error(error)
          toast.error("There was an unexpected error")
          return
        }

        toast.success("Passkey created!")
        console.log("passkey created", { data })
        router.refresh()
        return
      }}
    >
      New Passkey
    </Button>
  )
}
