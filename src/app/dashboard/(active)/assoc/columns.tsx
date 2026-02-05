"use client"
import { createColumnHelper, type Row } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ApiOutput } from "@/lib/trpc/types"
import { SetAssocNumberDialog } from "./_components/set-assoc-number-dialog"

type ParsedUser = ApiOutput["azure"]["members"]["getAll"][0]
const ch = createColumnHelper<ParsedUser>()

export const columns = [
  ch.accessor("employeeId", {
    id: "number",
    header: "#",
    footer: (props) => props.column.id,
    cell: ({ getValue, row }) => {
      const value = getValue()
      return value ? (
        <span>{value}</span>
      ) : (
        <SetAssocNumberDialog userId={row.original.id}>
          <Button size="sm" variant="outline">
            Set
          </Button>
        </SetAssocNumberDialog>
      )
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

function RowActions({ row }: { row: Row<ParsedUser> }) {
  return <div className="flex gap-2 justify-start items-center"></div>
}
