import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, Flag } from "lucide-react"
import { useCallback, useMemo, useState } from "react"

import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"

import { MOCK_PEOPLE } from "./mock-people"
import { BanAllDialog, BanDialog } from "./report-action-dialogs"
import type { ReportRow } from "./reports.mock"
import { telegramUserSearchText, TelegramUserLink } from "./telegram-user-link"

const CURRENT_ADMIN = MOCK_PEOPLE.giulia

const columnHelper = createAppColumnHelper<ReportRow>()

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value)
}

export function ReportsPage({ entries: initialEntries }: { entries: ReportRow[] }) {
  const [entries, setEntries] = useState(initialEntries)

  const resolveReport = useCallback((reportId: string, resolution: string, reason?: string) => {
    setEntries((current) =>
      current.map((entry) =>
        entry.id === reportId
          ? { ...entry, status: "resolved", resolution, resolvedBy: CURRENT_ADMIN, resolutionReason: reason }
          : entry
      )
    )
  }, [])

  const columns = useMemo(() => {
    const sortableHeader = (
      label: string,
      column: Pick<Column<typeof dashboardFeatures, ReportRow>, "getIsSorted" | "getToggleSortingHandler">
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
      columnHelper.accessor((row) => row.status, {
        id: "status",
        header: "Stato",
        cell: ({ getValue }) =>
          getValue() === "pending" ? (
            <Badge variant="destructive">In attesa</Badge>
          ) : (
            <Badge variant="secondary">Risolta</Badge>
          ),
      }),
      columnHelper.display({
        id: "group",
        header: "Gruppo",
        cell: ({ row }) => row.original.groupTitle,
      }),
      columnHelper.display({
        id: "target",
        header: "Segnalato",
        cell: ({ row }) => <TelegramUserLink user={row.original.target} />,
      }),
      columnHelper.display({
        id: "reporter",
        header: "Segnalato da",
        cell: ({ row }) => <TelegramUserLink user={row.original.reporter} />,
      }),
      columnHelper.display({
        id: "messagePreview",
        header: "Messaggio",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.messagePreview}</span>,
      }),
      columnHelper.display({
        id: "resolution",
        header: "Esito",
        cell: ({ row }) =>
          row.original.status === "resolved" && row.original.resolvedBy ? (
            <div>
              <span className="block">{row.original.resolution}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                da {telegramUserSearchText(row.original.resolvedBy)}
              </span>
              {row.original.resolutionReason && (
                <span className="mt-0.5 block text-xs text-muted-foreground italic">
                  {row.original.resolutionReason}
                </span>
              )}
            </div>
          ) : (
            <span className="italic text-muted-foreground">In attesa</span>
          ),
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) =>
          row.original.status === "pending" ? (
            <div className="flex gap-2">
              <BanDialog
                report={row.original}
                onResolve={(resolution, reason) => resolveReport(row.original.id, resolution, reason)}
              />
              <BanAllDialog
                report={row.original}
                onResolve={(resolution, reason) => resolveReport(row.original.id, resolution, reason)}
              />
            </div>
          ) : null,
      }),
      columnHelper.accessor((row) => row.createdAt.getTime(), {
        id: "createdAt",
        header: ({ column }) => sortableHeader("Data", column),
        cell: ({ row }) => <time className="text-xs">{formatDate(row.original.createdAt)}</time>,
      }),
    ])
  }, [resolveReport])

  const table = useAppTable({
    key: "bot-reports",
    columns,
    data: entries,
    initialState: { sorting: [{ id: "createdAt", desc: true }], pagination: { pageIndex: 0, pageSize: 20 } },
    globalFilterFn: (row, _columnId, value) => {
      const { groupTitle, target, reporter, messagePreview, status } = row.original
      const query = String(value ?? "")
        .trim()
        .toLocaleLowerCase()
      const searchable = [
        groupTitle,
        telegramUserSearchText(target),
        telegramUserSearchText(reporter),
        messagePreview,
        status,
      ]
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
        title="Report"
        description="Segnalazioni inviate dagli utenti tramite il bot Telegram, con l'esito con cui sono state risolte."
        count={filteredCount}
        total={entries.length}
        searchPlaceholder="Cerca per gruppo, utente o messaggio…"
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
          icon={Flag}
          title={hasSearch ? "Nessuna segnalazione corrisponde alla ricerca" : "Nessuna segnalazione registrata"}
          text={hasSearch ? "Prova a modificare i termini di ricerca." : "Non ci sono ancora segnalazioni registrate."}
        />
      )}
    </div>
  )
}
