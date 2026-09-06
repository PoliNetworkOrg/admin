import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown, ShieldCheck } from "lucide-react"
import { useMemo } from "react"

import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { createAppColumnHelper, type dashboardFeatures, useAppTable } from "@/lib/table"

import type { AuditLogRow, AuditLogType } from "./audit-log.mock"
import { telegramUserSearchText, TelegramUserLink } from "./telegram-user-link"

const TYPE_LABEL = {
  ban: "Ban",
  unban: "Unban",
  kick: "Kick",
  mute: "Mute",
  unmute: "Unmute",
  ban_all: "Ban all",
  unban_all: "Unban all",
} satisfies Record<AuditLogType, string>

const TYPE_VARIANT = {
  ban: "destructive",
  unban: "secondary",
  kick: "destructive",
  mute: "outline",
  unmute: "secondary",
  ban_all: "destructive",
  unban_all: "secondary",
} satisfies Record<AuditLogType, "default" | "secondary" | "destructive" | "outline">

const columnHelper = createAppColumnHelper<AuditLogRow>()

function formatDate(value: Date) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(value)
}

export function AuditLogPage({ entries }: { entries: AuditLogRow[] }) {
  const columns = useMemo(() => {
    const sortableHeader = (
      label: string,
      column: Pick<Column<typeof dashboardFeatures, AuditLogRow>, "getIsSorted" | "getToggleSortingHandler">
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
        id: "target",
        header: "Target",
        cell: ({ row }) => <TelegramUserLink user={row.original.target} />,
      }),
      columnHelper.display({
        id: "admin",
        header: "Eseguita da",
        cell: ({ row }) => <TelegramUserLink user={row.original.admin} />,
      }),
      columnHelper.display({
        id: "group",
        header: "Gruppo",
        cell: ({ row }) =>
          row.original.groupTitle ?? <span className="italic text-muted-foreground">Tutti i gruppi</span>,
      }),
      columnHelper.display({
        id: "reason",
        header: "Motivo",
        cell: ({ row }) =>
          row.original.reason ? (
            <span className="text-muted-foreground">{row.original.reason}</span>
          ) : (
            <span className="italic text-muted-foreground">Non specificato</span>
          ),
      }),
      columnHelper.accessor((row) => row.createdAt.getTime(), {
        id: "createdAt",
        header: ({ column }) => sortableHeader("Data", column),
        cell: ({ row }) => (
          <div>
            <time className="block text-xs">{formatDate(row.original.createdAt)}</time>
            {row.original.until && (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Fino a {formatDate(row.original.until)}
              </span>
            )}
          </div>
        ),
      }),
    ])
  }, [])

  const table = useAppTable({
    key: "bot-audit-log",
    columns,
    data: entries,
    initialState: { sorting: [{ id: "createdAt", desc: true }], pagination: { pageIndex: 0, pageSize: 20 } },
    globalFilterFn: (row, _columnId, value) => {
      const { type, groupTitle, target, admin, reason } = row.original
      const query = String(value ?? "")
        .trim()
        .toLocaleLowerCase()
      const searchable = [
        TYPE_LABEL[type],
        groupTitle,
        telegramUserSearchText(target),
        telegramUserSearchText(admin),
        reason,
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
        title="Moderazione"
        description="Storico delle azioni di moderazione eseguite dal bot: ban, unban, kick, mute, unmute e ban/unban di massa."
        count={filteredCount}
        total={entries.length}
        searchPlaceholder="Cerca per utente, gruppo o motivo…"
        onSearch={(value) => {
          table.setGlobalFilter(value)
          table.setPageIndex(0)
        }}
      />
      {filteredCount ? (
        <>
          <TableSurface>
            <Table className="min-w-225 text-left">
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
          icon={ShieldCheck}
          title={hasSearch ? "Nessuna azione corrisponde alla ricerca" : "Nessuna azione registrata"}
          text={
            hasSearch
              ? "Prova a modificare i termini di ricerca."
              : "Non ci sono ancora azioni di moderazione registrate."
          }
        />
      )}
    </div>
  )
}
