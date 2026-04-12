"use client"
import { createColumnHelper, type Row } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import type { AzureMember } from "@/server/trpc/types"
import { SetAssocNumberDialog } from "./set-assoc-number-dialog"

const ch = createColumnHelper<AzureMember>()

export const columns = [
  ch.accessor("employeeId", {
    id: "number",
    header: "#",
    footer: (props) => props.column.id,
    cell: ({ getValue, row }) => {
      const value = getValue()
      return value ? <span>{value}</span> : <SetAssocNumberDialog userId={row.original.id} />
    },
  }),
  ch.accessor("displayName", {
    id: "displayName",
    header: "Full Name",
    cell: ({ getValue, row }) => (
      <>
        {row.original.isMember && <Badge className="mr-2">Socio</Badge>}
        <span>{getValue()}</span>
      </>
    ),
  }),
  ch.accessor("mail", { id: "mail", header: "Email" }),
  ch.accessor("assignedLicensesIds", {
    id: "licenses",
    header: "Licenses",
    cell: ({ getValue }) => {
      const licenses = getValue().sort((a, b) => a.localeCompare(b))
      return licenses.map((l) => (
        <Badge key={l} className="mr-1" variant={l === "OFFICE_365" ? "default" : "secondary"}>
          {l}
        </Badge>
      ))
    },
  }),
  ch.group({
    id: "actions",
    cell: (props) => <RowActions row={props.row} />,
  }),
]

function RowActions({ row: _ }: { row: Row<AzureMember> }) {
  return <div className="flex gap-2 justify-start items-center"></div>
}
