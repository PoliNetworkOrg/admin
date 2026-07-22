"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { DataTable } from "@/components/data-table"
import { columns } from "./columns"
import { CreateGuide } from "./create-guide"
import type { Guide } from "./types"

export function GuideTable({ guides }: { guides: Guide[] }) {
  const router = useRouter()
  const [items, setItems] = useState(guides)

  function handleCreated(guide: Guide) {
    setItems((prev) => [guide, ...prev])
    router.refresh()
  }

  function handleDeleted(id: number) {
    setItems((prev) => prev.filter((g) => g.id !== id))
    router.refresh()
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <p>Guida della Matricola</p>
        <div className="grow" />
        <CreateGuide
          existingVersions={items.map((g) => g.version)}
          latestVersion={items[0]?.version}
          onCreated={handleCreated}
        />
      </div>

      <DataTable data={items} columns={columns(handleDeleted)} />
    </div>
  )
}
