import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, TriangleAlert } from "lucide-react"
import { useMemo } from "react"

import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"

import type { ExceptionRow, ExceptionType } from "./exceptions.mock"

const TYPE_LABEL = {
  BOT_ERROR: "Bot error",
  HTTP_ERROR: "HTTP error",
  GENERIC: "Generico",
  UNHANDLED_PROMISE: "Promise non gestita",
  UNKNOWN: "Sconosciuto",
} satisfies Record<ExceptionType, string>

const TYPE_VARIANT = {
  BOT_ERROR: "destructive",
  HTTP_ERROR: "destructive",
  GENERIC: "outline",
  UNHANDLED_PROMISE: "destructive",
  UNKNOWN: "outline",
} satisfies Record<ExceptionType, "default" | "secondary" | "destructive" | "outline">

const columnHelper = createAppColumnHelper<ExceptionRow>()

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value)
}

export function ExceptionsPage({ entries }: { entries: ExceptionRow[] }) {
  const columns = useMemo(() => {
    const sortableHeader = (
      label: string,
      column: Pick<Column<typeof dashboardFeatures, ExceptionRow>, "getIsSorted" | "getToggleSortingHandler">
    ) => {
      const sorted = column.getIsSorted()
      const Icon = !sorted ? ChevronsUpDown : sorted === "asc" ? ArrowUp : ArrowDown
      return (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={column.getToggleSortingHandler()}
          aria-label={`${label}, ${sorted ? `sorted ${sorted === "asc" ? "ascending" : "descending"}` : "not sorted"}`}
        >
          {label}
          <Icon data-icon="inline-end" />
        </Button>
      )
    }

    return columnHelper.columns([
      columnHelper.accessor((row) => row.type, {
        id: "type",
        header: "Tipo",
        cell: ({ getValue }) => <Badge variant={TYPE_VARIANT[getValue()]}>{TYPE_LABEL[getValue()]}</Badge>,
      }),
      columnHelper.display({
        id: "message",
        header: "Messaggio",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.message}</span>,
      }),
      columnHelper.display({
        id: "context",
        header: "Contesto",
        cell: ({ row }) =>
          row.original.context ?? <span className="italic text-muted-foreground">Non specificato</span>,
      }),
      columnHelper.accessor((row) => row.createdAt.getTime(), {
        id: "createdAt",
        header: ({ column }) => sortableHeader("Data", column),
        cell: ({ row }) => <time className="text-xs">{formatDate(row.original.createdAt)}</time>,
      }),
    ])
  }, [])

  const table = useAppTable({
    key: "bot-exceptions",
    columns,
    data: entries,
    initialState: { sorting: [{ id: "createdAt", desc: true }], pagination: { pageIndex: 0, pageSize: 20 } },
    globalFilterFn: (row, _columnId, value) => {
      const { type, message, context } = row.original
      const query = String(value ?? "")
        .trim()
        .toLocaleLowerCase()
      const searchable = [TYPE_LABEL[type], message, context].filter(Boolean).join(" ").toLocaleLowerCase()
      return !query || searchable.includes(query)
    },
  })
  const filteredCount = table.getFilteredRowModel().rows.length
  const hasSearch = Boolean(String(table.state.globalFilter ?? "").trim())

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Bot"
        title="Errori"
        description="Eccezioni ed errori registrati durante l'esecuzione del bot Telegram."
        count={filteredCount}
        total={entries.length}
        searchPlaceholder="Cerca per tipo, messaggio o contesto…"
        onSearch={(value) => {
          table.setGlobalFilter(value)
          table.setPageIndex(0)
        }}
      />
      {filteredCount ? (
        <>
          <TableSurface>
            <Table className="min-w-[900px] text-left">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="border-0 hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <DataTableHead
                        key={header.id}
                        aria-sort={
                          header.column.getIsSorted() === "asc"
                            ? "ascending"
                            : header.column.getIsSorted() === "desc"
                              ? "descending"
                              : undefined
                        }
                      >
                        {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                      </DataTableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id} className="px-4 py-3.5 text-sm">
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableSurface>
          <Pagination
            page={table.state.pagination.pageIndex + 1}
            pageCount={table.getPageCount()}
            pageSize={table.state.pagination.pageSize}
            total={filteredCount}
            onPageChange={(page) => table.setPageIndex(page - 1)}
            onPageSizeChange={(pageSize) => table.setPageSize(pageSize)}
          />
        </>
      ) : (
        <EmptyState
          icon={TriangleAlert}
          title={hasSearch ? "Nessun errore corrisponde alla ricerca" : "Nessun errore registrato"}
          text={hasSearch ? "Prova a modificare i termini di ricerca." : "Non ci sono ancora errori registrati."}
        />
      )}
    </div>
  )
}
