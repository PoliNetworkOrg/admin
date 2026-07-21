"use client"
import { createColumnHelper } from "@tanstack/react-table"
import { format } from "date-fns"
import { DeleteGuide } from "./delete-guide"
import type { Guide } from "./types"

const ch = createColumnHelper<Guide>()

export const columns = (onDeleted: (id: number) => void) => [
  ch.accessor("version", {
    id: "version",
    header: "Version",
    cell: ({ getValue }) => <span>{getValue()}</span>,
  }),
  ch.accessor("date", {
    id: "date",
    header: "Date",
    cell: ({ getValue }) => format(new Date(getValue()), "dd/MM/yyyy"),
  }),
  ch.accessor("file", {
    id: "file",
    header: "File",
    cell: ({ getValue }) => (
      <a href={getValue()} target="_blank" rel="noreferrer" className="text-primary underline">
        Download
      </a>
    ),
  }),
  ch.group({
    id: "actions",
    cell: (props) => (
      <DeleteGuide id={props.row.original.id} version={props.row.original.version} onDeleted={onDeleted} />
    ),
  }),
]
