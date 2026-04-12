"use client"

import { RefreshCcw, Search, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = searchParams.get("q")
  const [value, setValue] = useState(searchParams.get("q") ?? "")

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("q", value)
    } else {
      params.delete("q")
    }
    router.replace(`?${params.toString()}`)
  }

  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        placeholder="Search..."
      />
      <Button onClick={handleSearch}>
        <Search />
        Search
      </Button>
      <Button onClick={() => router.refresh()} variant="outline">
        <RefreshCcw />
        Refresh
      </Button>
    </div>
  )
}
