"use client"

import { UserRoundPenIcon } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useSession } from "@/lib/auth"

export function CompleteProfile() {
  const { data, isPending } = useSession()

  if (!data || isPending) return null

  return (
    !data.user.name && (
      <div className="flex items-center p-2 pl-4 mb-4 gap-2 rounded-lg border text-accent-foreground bg-yellow-400/10 border-yellow-400">
        <UserRoundPenIcon size={16} />
        <p className="grow">Your profile is incomplete, please enter the missing information.</p>
        <Link href="/dashboard/account">
          <Button>Go complete</Button>
        </Link>
      </div>
    )
  )
}
