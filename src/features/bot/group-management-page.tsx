import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, Database } from "lucide-react"
import { useMemo } from "react"

import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"

import type { GroupManagementLogRow, GroupManagementType } from "./group-management.mock"
import { telegramUserSearchText, TelegramUserLink } from "./telegram-user-link"

const TYPE_LABEL = {
  CREATE: "Gruppo creato",
  UPDATE: "Gruppo aggiornato",
  DELETE: "Gruppo eliminato",
  LEAVE: "Bot uscito",
  LEAVE_FAIL: "Uscita fallita",
  CREATE_FAIL: "Creazione fallita",
  UPDATE_FAIL: "Aggiornamento fallito",
  REGENERATE_LINKS_START: "Rigenerazione link avviata",
  REGENERATE_LINKS_COMPLETE: "Rigenerazione link completata",
  REGENERATE_LINKS_ABORTED: "Rigenerazione link annullata",
} satisfies Record<GroupManagementType, string>

const TYPE_VARIANT = {
  CREATE: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
  LEAVE: "outline",
  LEAVE_FAIL: "destructive",
  CREATE_FAIL: "destructive",
  UPDATE_FAIL: "destructive",
  REGENERATE_LINKS_START: "secondary",
  REGENERATE_LINKS_COMPLETE: "default",
  REGENERATE_LINKS_ABORTED: "destructive",
} satisfies Record<GroupManagementType, "default" | "secondary" | "destructive" | "outline">

const columnHelper = createAppColumnHelper<GroupManagementLogRow>()

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value)
}

export function GroupManagementPage({ entries }: { entries: GroupManagementLogRow[] }) {
  const columns = useMemo(() => {
    const sortableHeader = (
      label: string,
      column: Pick<Column<typeof dashboardFeatures, GroupManagementLogRow>, "getIsSorted" | "getToggleSortingHandler">
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
        header: "Azione",
        cell: ({ getValue }) => <Badge variant={TYPE_VARIANT[getValue()]}>{TYPE_LABEL[getValue()]}</Badge>,
      }),
      columnHelper.display({
        id: "group",
        header: "Gruppo",
        cell: ({ row }) =>
          row.original.groupTitle ?? <span className="italic text-muted-foreground">Tutti i gruppi</span>,
      }),
      columnHelper.display({
        id: "performedBy",
        header: "Eseguita da",
        cell: ({ row }) => <TelegramUserLink user={row.original.performedBy} />,
      }),
      columnHelper.display({
        id: "detail",
        header: "Dettagli",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.detail}</span>,
      }),
      columnHelper.accessor((row) => row.createdAt.getTime(), {
        id: "createdAt",
        header: ({ column }) => sortableHeader("Data", column),
        cell: ({ row }) => <time className="text-xs">{formatDate(row.original.createdAt)}</time>,
      }),
    ])
  }, [])

  const table = useAppTable({
    key: "bot-group-management",
    columns,
    data: entries,
    initialState: { sorting: [{ id: "createdAt", desc: true }], pagination: { pageIndex: 0, pageSize: 20 } },
    globalFilterFn: (row, _columnId, value) => {
      const { type, groupTitle, performedBy, detail } = row.original
      const query = String(value ?? "")
        .trim()
        .toLocaleLowerCase()
      const searchable = [TYPE_LABEL[type], groupTitle, telegramUserSearchText(performedBy), detail]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
      return !query || searchable.includes(query)
    },
  })
  const filteredCount = table.getFilteredRowModel().rows.length
  const hasSearch = Boolean(String(table.state.globalFilter ?? "").trim())

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Bot"
        title="Gestione gruppi"
        description="Storico delle azioni del bot sui gruppi Telegram: creazione, aggiornamento, rimozione e rigenerazione dei link di invito."
        count={filteredCount}
        total={entries.length}
        searchPlaceholder="Cerca per gruppo, azione o responsabile…"
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
          icon={Database}
          title={hasSearch ? "Nessun evento corrisponde alla ricerca" : "Nessun evento registrato"}
          text={
            hasSearch
              ? "Prova a modificare i termini di ricerca."
              : "Non ci sono ancora eventi di gestione gruppi registrati."
          }
        />
      )}
    </div>
  )
}
