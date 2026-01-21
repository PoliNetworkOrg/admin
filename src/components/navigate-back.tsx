"use client"

import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "./ui/button"

export function NavigateBack() {
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        router.back()
      }}
    >
      <ArrowLeft />
    </Button>
  )
}
