import { Link } from "@tanstack/react-router"
import { FilePlus2, ListChecks, ScrollText } from "lucide-react"
import { useDeferredValue, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  IconButton,
  RowActions,
  SegmentedControl,
  useOpenGeneration,
} from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { NewDraftDialog, type NewDraftTarget } from "./new-draft-dialog"
import { baseLabel, formatDay, isFinalState, ROLE_LABELS } from "./regulations-format"
import { DraftKindMark, DraftSecretMark, DraftStateBadge } from "./regulations-ui"
import type { DocumentInfo, DraftSummary, Me } from "./regulations.contract"

type Filter = "open" | "closed"

/**
 * Regolamenti › Bozze: every draft for the Direttivo and `regulations:read`; for anyone else, only the drafts they're
 * assigned to and the rettifiche they started on a delega. A row opens the editor.
 */
export function DraftsPage({ drafts, me, documents }: { drafts: DraftSummary[]; me: Me; documents: DocumentInfo[] }) {
  const canWrite = useCan("regulations:write")
  const [filter, setFilter] = useState<Filter>("open")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [dialog, setDialog] = useState<{ open: boolean; target: NewDraftTarget | null }>({ open: false, target: null })
  const generation = useOpenGeneration(dialog.open)
  const assignee = !me.permissions.read

  const inFilter = drafts.filter((draft) => (filter === "open") === !isFinalState(draft.state))
  const rows = inFilter.filter(
    (draft) =>
      !deferredQuery ||
      [draft.title, draft.createdBy.name].some((value) => value.toLocaleLowerCase().includes(deferredQuery))
  )
  const open = drafts.filter((draft) => !isFinalState(draft.state)).length
  // Only documents that take drafts (not sola consultazione, uploads or ones still in creation).
  const draftable = documents.filter((document) => document.editable)

  const columns: DataTableColumn<DraftSummary>[] = [
    {
      id: "title",
      label: "Bozza",
      fill: true,
      minWidth: 240,
      mobile: "main",
      cell: (draft) => (
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium">{draft.title}</span>
            <DraftKindMark kind={draft.kind} />
            <DraftSecretMark secret={draft.secret} />
          </span>
          <span className="truncate text-xs text-(--pn-fg-muted)">di {draft.createdBy.name}</span>
        </span>
      ),
    },
    {
      id: "state",
      label: "Stato",
      width: 150,
      mobile: "meta",
      cell: (draft) => <DraftStateBadge state={draft.state} />,
    },
    ...(assignee
      ? [
          {
            id: "role",
            label: "Il tuo accesso",
            width: 150,
            mobile: "meta",
            cell: (draft: DraftSummary) => <span className="whitespace-nowrap">{ROLE_LABELS[draft.myRole]}</span>,
          } satisfies DataTableColumn<DraftSummary>,
        ]
      : []),
    {
      id: "base",
      label: "Parte da",
      width: 220,
      priority: 3,
      mobile: "hidden",
      cell: (draft) => <span className="block truncate">{baseLabel(draft.base)}</span>,
    },
    {
      id: "updated",
      label: "Aggiornata",
      width: 120,
      priority: 2,
      mobile: "meta",
      cell: (draft) => <span className="whitespace-nowrap tabular-nums">{formatDay(draft.updatedAt)}</span>,
    },
  ]

  return (
    <>
      <PageBar
        description={
          assignee
            ? "Le bozze a cui ti hanno invitato e le rettifiche che hai avviato."
            : `${open === 1 ? "1 bozza aperta" : `${open} bozze aperte`} su tutti i documenti.`
        }
        right={
          <>
            {me.rectifiable.length > 0 && (
              <Button
                variant="outline"
                className={buttonMotion}
                onClick={() => setDialog({ open: true, target: { kind: "rettifica", documents: me.rectifiable } })}
              >
                Nuova rettifica
              </Button>
            )}
            {canWrite && draftable.length > 0 && (
              <Button
                className={buttonMotion}
                onClick={() =>
                  setDialog({
                    open: true,
                    target: { kind: "modifica", documents: draftable.map(({ key, title }) => ({ key, title })) },
                  })
                }
              >
                <FilePlus2 aria-hidden />
                Nuova bozza
              </Button>
            )}
          </>
        }
        left={
          <Toolbar
            search={{ value: query, onChange: setQuery, placeholder: "Cerca per titolo o autore…" }}
            filters={
              <SegmentedControl
                label="Stato delle bozze"
                value={filter}
                onValueChange={setFilter}
                items={[
                  { value: "open", label: "Aperte", count: open },
                  { value: "closed", label: "Concluse", count: drafts.length - open },
                ]}
              />
            }
            count={
              deferredQuery ? (
                <Count locale="it" value={rows.length} total={inFilter.length} noun="bozza" plural="bozze" />
              ) : undefined
            }
          />
        }
      />
      <PageContent>
        <DataTable
          locale="it"
          label="Bozze"
          columns={columns}
          rows={rows}
          getRowId={(draft) => draft.id}
          rowLabel={(draft) => draft.title}
          rowHref={(draft) => `/dashboard/regulations/drafts/${draft.id}`}
          actionsWidth={64}
          actions={(draft) => (
            <RowActions>
              <IconButton
                label="Procedura"
                ariaLabel={`Procedura di ${draft.title}`}
                icon={ListChecks}
                nativeButton={false}
                render={<Link to="/dashboard/regulations/drafts/$draftId/procedure" params={{ draftId: draft.id }} />}
              />
            </RowActions>
          )}
          empty={
            deferredQuery ? (
              <EmptyState
                icon={ScrollText}
                title="Nessuna bozza corrisponde"
                text="Prova con un altro titolo o autore."
                action={
                  <Button variant="ghost" className={buttonMotion} onClick={() => setQuery("")}>
                    Cancella la ricerca
                  </Button>
                }
              />
            ) : filter === "closed" ? (
              <EmptyState
                icon={ScrollText}
                title="Nessuna bozza conclusa"
                text="Le bozze emanate o pubblicate restano qui con la loro cronologia."
              />
            ) : (
              <EmptyState
                icon={ScrollText}
                title="Nessuna bozza aperta"
                text={
                  assignee
                    ? "Quando qualcuno del Direttivo ti invita a una bozza, la trovi qui."
                    : "Una bozza parte da una versione pubblicata o da un'altra bozza."
                }
              />
            )
          }
        />
      </PageContent>
      {dialog.target && (
        <NewDraftDialog
          key={generation}
          open={dialog.open}
          onOpenChange={(next) => setDialog((current) => ({ ...current, open: next }))}
          target={dialog.target}
        />
      )}
    </>
  )
}
