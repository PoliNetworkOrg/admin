"use client"

import { RefreshCcw, Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function SearchInput() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const q = searchParams.get("q") ?? ""
  const [value, setValue] = useState(q)

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set("q", value)
    } else {
      params.delete("q")
    }
    router.replace(`?${params.toString()}`)
  }
  useEffect(() => {
    setValue(q)
  }, [q])

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
