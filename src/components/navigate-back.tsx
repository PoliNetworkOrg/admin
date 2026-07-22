"use client"

import { useRouter } from "next/navigation"
import { FiArrowLeft } from "react-icons/fi"
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
      <FiArrowLeft />
    </Button>
  )
}
