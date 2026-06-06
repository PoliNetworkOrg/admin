"use client"

import { useState } from "react"
import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { AzureMember } from "@/server/trpc/types"
import { columns } from "./columns"
import { CreateAssocUser } from "./create-assoc-member"

function sortByAssocNumber(users: AzureMember[]) {
  if (!users || users.length === 0) return users
  if (users.every((u) => !u.employeeId))
    return users.sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""))

  return users.sort((a, b) => {
    if (a.employeeId && b.employeeId) {
      const aInt = parseInt(a.employeeId, 10)
      const bInt = parseInt(b.employeeId, 10)
      if (Number.isNaN(aInt) && Number.isNaN(bInt)) return 0
      if (Number.isNaN(aInt)) return 1
      if (Number.isNaN(bInt)) return -1
      return aInt - bInt
    }
    if (a.employeeId) return -1
    if (b.employeeId) return 1
    return 0
  })
}

export function AssocTable({ members }: { members: AzureMember[] }) {
  const [sociFilter, setSociFilter] = useState(false)
  const users = sociFilter ? members.filter((v) => v.isMember) : members

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <p>Utenti MS @polinetwork.org</p>
        <Badge
          className="cursor-pointer data-active:ring ring-white"
          data-active={sociFilter}
          onClick={() => setSociFilter((v) => !v)}
        >
          {members.filter((d) => d.isMember).length} Soci
        </Badge>
        <Badge variant="secondary">{members.filter((d) => !d.isMember).length} fuori</Badge>
        <Badge>{users.filter((u) => u.assignedLicensesIds.includes("OFFICE_365")).length} licenze Office</Badge>
        <div className="grow" />
        <CreateAssocUser />
      </div>

      <DataTable
        data={sortByAssocNumber(users)}
        // @ts-expect-error idk what is going on here
        columns={columns}
      />
    </div>
  )
}

export function SkeletonAssocTable() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center">
        <p>Utenti MS @polinetwork.org</p>
        <Badge className="animate-pulse w-15" />
        <Badge className="animate-pulse w-15" variant="secondary" />
        <Badge className="animate-pulse w-30" />
        <div className="grow" />
        <CreateAssocUser />
      </div>

      <Skeleton className="h-[70vh] w-full" />
    </div>
  )
}
