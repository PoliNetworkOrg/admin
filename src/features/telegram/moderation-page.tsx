import { Link } from "@tanstack/react-router"
import { History } from "lucide-react"
import { useMemo } from "react"

import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { Badge } from "@/components/ui/badge"
import { DataTableHead, Table, TableBody, TableCell, TableHeader, TableRow, TableSurface } from "@/components/ui/table"
import { createAppColumnHelper, useAppTable } from "@/lib/table"

import {
  MODERATION_ACTION_LABELS,
  MODERATION_STATUS_LABELS,
  moderationStatusBadgeVariant,
  moderationUserName,
  shouldShowDeletedMessageCount,
} from "./moderation.constants"
import type { ModerationAudit } from "./user-detail/types"

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

const auditColumnHelper = createAppColumnHelper<ModerationAudit>()

export function TelegramModerationPage({ audits }: { audits: ModerationAudit[] }) {
  const columns = useMemo(
    () =>
      auditColumnHelper.columns([
        auditColumnHelper.accessor("type", {
          header: "Action",
          cell: ({ row }) => (
            <div className="grid gap-1">
              <span className="font-medium">{MODERATION_ACTION_LABELS[row.original.type]}</span>
              <span className="font-mono text-[10px] text-muted-foreground">#{row.original.id}</span>
            </div>
          ),
        }),
        auditColumnHelper.accessor("targetId", {
          header: "Target",
          cell: ({ row }) => (
            <Link
              to="/dashboard/telegram/users/$userId"
              params={{ userId: String(row.original.targetId) }}
              className="grid rounded-sm outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/25"
            >
              <span className="font-medium">{moderationUserName(row.original.target, row.original.targetId)}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{row.original.targetId}</span>
            </Link>
          ),
        }),
        auditColumnHelper.accessor("adminId", {
          header: "Moderator",
          cell: ({ row }) => (
            <div className="grid gap-1">
              <span>{moderationUserName(row.original.admin, row.original.adminId)}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{row.original.adminId}</span>
            </div>
          ),
        }),
        auditColumnHelper.display({
          id: "scope",
          header: "Scope",
          cell: ({ row }) => (
            <div className="grid gap-1">
              <span>
                {row.original.groupTitle ?? (row.original.groupId ? `Chat ${row.original.groupId}` : "All groups")}
              </span>
              {row.original.totalGroupCount > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {row.original.successGroupCount} succeeded, {row.original.failedGroupCount} failed of{" "}
                  {row.original.totalGroupCount}
                </span>
              )}
            </div>
          ),
        }),
        auditColumnHelper.accessor("status", {
          header: "Result",
          cell: ({ row }) => (
            <div className="grid justify-items-start gap-1.5">
              <Badge variant={moderationStatusBadgeVariant(row.original.status)}>
                {MODERATION_STATUS_LABELS[row.original.status]}
              </Badge>
              {shouldShowDeletedMessageCount(row.original) && (
                <span className="text-[10px] text-muted-foreground">
                  {row.original.deletedMessageCount === null ? (
                    "Recent message count unavailable"
                  ) : (
                    <>
                      {row.original.deletedMessageCount} recent message
                      {row.original.deletedMessageCount === 1 ? "" : "s"} deleted
                    </>
                  )}
                </span>
              )}
            </div>
          ),
        }),
        auditColumnHelper.accessor("reason", {
          header: "Reason",
          cell: ({ getValue }) => (
            <p className="max-w-72 whitespace-normal text-xs leading-5 text-muted-foreground">
              {getValue() ?? "No reason provided"}
            </p>
          ),
        }),
        auditColumnHelper.accessor("createdAt", {
          header: "Created",
          cell: ({ getValue }) => (
            <time className="text-xs whitespace-nowrap text-muted-foreground">{formatDate(getValue())}</time>
          ),
        }),
      ]),
    []
  )

  const table = useAppTable({
    key: "telegram-moderation",
    columns,
    data: audits,
    initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
    globalFilterFn: (row, _columnId, value) => {
      const audit = row.original
      const query = String(value ?? "")
        .trim()
        .toLocaleLowerCase()
      const searchable = [
        MODERATION_ACTION_LABELS[audit.type],
        MODERATION_STATUS_LABELS[audit.status],
        audit.reason,
        audit.groupTitle,
        audit.groupId,
        audit.targetId,
        audit.adminId,
        moderationUserName(audit.target, audit.targetId),
        moderationUserName(audit.admin, audit.adminId),
        audit.target?.username,
        audit.admin?.username,
      ]
        .filter((entry) => entry !== null && entry !== undefined)
        .join(" ")
        .toLocaleLowerCase()
      return !query || searchable.includes(query.replace(/^@/, ""))
    },
  })
  const filteredCount = table.getFilteredRowModel().rows.length
  const hasSearch = Boolean(String(table.state.globalFilter ?? "").trim())

  return (
    <div className="animate-appear">
      <DataToolbar
        eyebrow="Telegram"
        title="Moderation log"
        description="Review moderation actions and BanAll execution alongside the existing Telegram logs."
        count={filteredCount}
        total={audits.length}
        searchPlaceholder="Search by action, person, group, or reason…"
        onSearch={(value) => {
          table.setGlobalFilter(value)
          table.setPageIndex(0)
        }}
      />
      {filteredCount ? (
        <>
          <TableSurface>
            <Table className="min-w-[1180px] text-left">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="border-0 hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <DataTableHead key={header.id}>
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
          icon={History}
          title={hasSearch ? "No moderation records match this search" : "No moderation records yet"}
          text={
            hasSearch
              ? "Clear the search or try a different person, group, or action."
              : "New actions will appear here."
          }
        />
      )}
    </div>
  )
}
