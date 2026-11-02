import { useServerFn } from "@tanstack/react-start"
import { KeyRound, Plus, X } from "lucide-react"
import { useState } from "react"

import {
  buttonMotion,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  RowActions,
  SegmentedControl,
  StatusBadge,
  Unset,
  useOpenGeneration,
} from "@/components/primitives"
import { PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { DelegaDialog } from "./delega-dialog"
import { formatDay } from "./regulations-format"
import { failureMessage, useRefreshAfter } from "./regulations-hooks"
import { revokeDelega } from "./regulations-rectify.functions"
import type { Delega, DocumentInfo } from "./regulations.contract"

type Filter = "active" | "all"

function delegaState(delega: Delega) {
  if (delega.revokedAt) return { tone: "neutral" as const, label: "Revocata" }
  if (!delega.active) return { tone: "warning" as const, label: "Scaduta" }
  return { tone: "success" as const, label: "Attiva" }
}

/**
 * Regolamenti › Deleghe: the Segretario's deleghe to rectify. Creating or revoking one emails the Direttivo; the
 * Segretario is notified of every rettifica made under one.
 */
export function DeleghePage({ deleghe, documents }: { deleghe: Delega[]; documents: DocumentInfo[] }) {
  const canRectify = useCan("regulations:rectify")
  const revoke = useServerFn(revokeDelega)
  const refresh = useRefreshAfter()
  const [filter, setFilter] = useState<Filter>("active")
  const [createOpen, setCreateOpen] = useState(false)
  const createGeneration = useOpenGeneration(createOpen)
  const [revoking, setRevoking] = useState<Delega | null>(null)
  const [revokeOpen, setRevokeOpen] = useState(false)

  const active = deleghe.filter((delega) => delega.active)
  const rows = filter === "active" ? active : deleghe
  const documentTitle = (key: string | null) =>
    key === null ? "Tutti i documenti" : (documents.find((document) => document.key === key)?.title ?? key)

  const columns: DataTableColumn<Delega>[] = [
    {
      id: "grantee",
      label: "Delegato",
      fill: true,
      minWidth: 220,
      mobile: "main",
      cell: (delega) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{delega.grantee.name}</span>
          {delega.grantee.email && (
            <span className="truncate font-mono text-xs text-(--pn-fg-muted)">{delega.grantee.email}</span>
          )}
        </span>
      ),
    },
    {
      id: "document",
      label: "Documento",
      width: 240,
      mobile: "full",
      cell: (delega) => <span className="block truncate">{documentTitle(delega.documentKey)}</span>,
    },
    {
      id: "expires",
      label: "Scade il",
      width: 120,
      mobile: "meta",
      cell: (delega) =>
        delega.expiresAt ? (
          <span className="whitespace-nowrap tabular-nums">{formatDay(delega.expiresAt)}</span>
        ) : (
          <Unset />
        ),
    },
    {
      id: "state",
      label: "Stato",
      width: 120,
      mobile: "meta",
      cell: (delega) => {
        const state = delegaState(delega)
        return <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
      },
    },
    {
      id: "granted",
      label: "Concessa",
      width: 200,
      priority: 3,
      mobile: "hidden",
      cell: (delega) => (
        <span className="block truncate">
          {delega.grantedBy.name}, {formatDay(delega.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageBar
        description="Chi può rettificare i regolamenti per conto del Segretario."
        right={
          canRectify ? (
            <Button className={buttonMotion} onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden />
              Nuova delega
            </Button>
          ) : undefined
        }
        left={
          <Toolbar
            filters={
              <SegmentedControl
                label="Deleghe da mostrare"
                value={filter}
                onValueChange={setFilter}
                items={[
                  { value: "active", label: "Attive", count: active.length },
                  { value: "all", label: "Tutte", count: deleghe.length },
                ]}
              />
            }
          />
        }
      />
      <PageContent>
        <DataTable
          label="Deleghe"
          columns={columns}
          rows={rows}
          getRowId={(delega) => delega.id}
          actionsWidth={64}
          actions={(delega) =>
            canRectify && delega.active ? (
              <RowActions>
                <IconButton
                  label="Revoca delega"
                  ariaLabel={`Revoca la delega a ${delega.grantee.name}`}
                  icon={X}
                  tone="danger"
                  onClick={() => {
                    setRevoking(delega)
                    setRevokeOpen(true)
                  }}
                />
              </RowActions>
            ) : null
          }
          empty={
            <EmptyState
              icon={KeyRound}
              title={filter === "active" ? "Nessuna delega attiva" : "Nessuna delega"}
              text="Una delega permette a qualcun altro di emanare rettifiche per conto del Segretario."
            />
          }
        />
      </PageContent>
      <DelegaDialog key={createGeneration} open={createOpen} onOpenChange={setCreateOpen} documents={documents} />
      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        title="Revocare la delega?"
        description={
          revoking ? `${revoking.grantee.name} non potrà più emanare rettifiche. Il Direttivo riceve una email.` : ""
        }
        confirmLabel="Revoca delega"
        cancelLabel="Annulla"
        onConfirm={async () => {
          if (!revoking) return
          try {
            await revoke({ data: { delegaId: revoking.id } })
          } catch (caught) {
            console.error(caught)
            throw new Error(failureMessage(caught, "Non è stato possibile revocare la delega."), { cause: caught })
          }
          await refresh("Delega revocata.")
        }}
      />
    </>
  )
}
