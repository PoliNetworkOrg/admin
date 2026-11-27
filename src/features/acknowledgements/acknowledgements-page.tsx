import { DragDropProvider } from "@dnd-kit/react"
import { useSortable } from "@dnd-kit/react/sortable"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { FolderPlus, GripVertical, HeartHandshake, Pencil, Plus, Trash2 } from "lucide-react"
import { useReducedMotion } from "motion/react"
import { useRef, useState } from "react"
import { flushSync } from "react-dom"

import {
  buttonMotion,
  ConfirmDialog,
  EmptyState,
  Hint,
  IconButton,
  RowActions,
  SegmentedControl,
  useFocusAfterRemoval,
} from "@/components/primitives"
import { appToast, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { droppedOrder, inOrder } from "../documents/documents-page"
import { DropSettle } from "../projects/projects-page"
import { AcknowledgementDialog, AcknowledgementGroupDialog } from "./acknowledgement-dialogs"
import { AcknowledgementIcon } from "./acknowledgement-icon"
import {
  deleteAcknowledgement,
  deleteAcknowledgementGroup,
  reorderAcknowledgementGroups,
  reorderAcknowledgements,
} from "./acknowledgements.functions"
import { acknowledgementsErrorMessage } from "./acknowledgements.validation"
import type { Acknowledgement, AcknowledgementGroup, AcknowledgementList, Acknowledgements } from "./types"

const SORT_TRANSITION = { duration: 160, easing: "cubic-bezier(0.45, 0, 0.2, 1)", idle: false }
const GROUP_SORT_GROUP = "acknowledgement-groups"
const ROW_SELECTOR = "[data-slot=acknowledgement-row]"

type Tab = "website" | "projects"
/** A list whose order can be saved: the groups, one group's people, or the projects list. */
type Scope = "groups" | "projects" | number
type GroupDialogState = { key: number; open: boolean; group: AcknowledgementGroup | null }
type EntryDialogState = { key: number; open: boolean; entry: Acknowledgement | null }

const people = (count: number) => `${formatNumber(count)} ${count === 1 ? "persona" : "persone"}`

function noop() {}

/**
 * Riconoscimenti: the credits of the website's acknowledgements page. "Sito web" lists the role groups beside the
 * chosen group's people; "Progetti" the people behind PoliNetwork's projects. Both are sortable.
 */
export function AcknowledgementsPage({ data }: { data: Acknowledgements }) {
  const router = useRouter()
  const canWrite = useCan("web:content:write")
  const deleteGroupFn = useServerFn(deleteAcknowledgementGroup)
  const reorderGroupsFn = useServerFn(reorderAcknowledgementGroups)
  const deleteEntryFn = useServerFn(deleteAcknowledgement)
  const reorderEntriesFn = useServerFn(reorderAcknowledgements)

  const [tab, setTab] = useState<Tab>("website")
  // The order shown for each list while its reorder is saving; cleared (back to the loader data) once it settles.
  const [optimistic, setOptimistic] = useState<ReadonlyMap<Scope, number[]>>(new Map())
  // The latest request per list: a newer reorder of the same list supersedes it, one of another list doesn't.
  const reorderRequest = useRef(new Map<Scope, number>())
  const reorderCount = useRef(0)
  const reorderQueue = useRef<Promise<unknown>>(Promise.resolve())

  const groups = inOrder(data.website, optimistic.get("groups"))
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const group = groups.find((item) => item.id === selectedId) ?? groups[0] ?? null
  const projects = inOrder(data.projects, optimistic.get("projects"))
  const list: AcknowledgementList | null =
    tab === "projects" ? { section: "projects" } : group ? { section: "website", groupId: group.id } : null
  const entries = tab === "projects" ? projects : group ? inOrder(group.entries, optimistic.get(group.id)) : []
  const websiteCount = groups.reduce((sum, item) => sum + item.entries.length, 0)
  const entryFocus = useFocusAfterRemoval<HTMLDivElement>(ROW_SELECTOR)

  const [groupDialog, setGroupDialog] = useState<GroupDialogState>({ key: 0, open: false, group: null })
  const [entryDialog, setEntryDialog] = useState<EntryDialogState>({ key: 0, open: false, entry: null })
  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false)
  const [deletingEntry, setDeletingEntry] = useState<Acknowledgement | null>(null)
  const [deleteEntryOpen, setDeleteEntryOpen] = useState(false)

  async function refresh(saved = true) {
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      appToast.warning(
        saved
          ? "La modifica è stata salvata, ma non è stato possibile ricaricare i riconoscimenti."
          : "Non è stato possibile ricaricare i riconoscimenti. Ricarica la pagina."
      )
    }
  }

  function openGroupDialog(target: AcknowledgementGroup | null) {
    setGroupDialog((current) => ({ key: current.key + 1, open: true, group: target }))
  }

  function openEntryDialog(target: Acknowledgement | null) {
    setEntryDialog((current) => ({ key: current.key + 1, open: true, entry: target }))
  }

  /** Reorders run one at a time, in the order they were made; only the latest one clears or reverts the order shown. */
  function reorder(scope: Scope, ids: number[]) {
    reorderCount.current += 1
    const request = reorderCount.current
    reorderRequest.current.set(scope, request)
    flushSync(() => {
      if (scope === "groups" && group && group.id !== selectedId) setSelectedId(group.id)
      setOptimistic((current) => new Map(current).set(scope, ids))
    })
    const operation = reorderQueue.current.then(() =>
      scope === "groups"
        ? reorderGroupsFn({ data: { ids } })
        : reorderEntriesFn({
            data: {
              list: scope === "projects" ? { section: "projects" } : { section: "website", groupId: scope },
              ids,
            },
          })
    )
    // The caller handles the failure; the queue only needs to know it settled.
    reorderQueue.current = operation.then(noop, noop)
    void settleReorder(scope, operation, request)
  }

  async function settleReorder(scope: Scope, operation: Promise<unknown>, request: number) {
    try {
      await operation
    } catch (error) {
      console.error(error)
      if (reorderRequest.current.get(scope) !== request) return
      clearOptimistic(scope)
      appToast.error(
        acknowledgementsErrorMessage(
          error,
          scope === "groups"
            ? "Non è stato possibile salvare l'ordine dei gruppi."
            : "Non è stato possibile salvare l'ordine delle persone."
        )
      )
      void refresh(false)
      return
    }
    if (reorderRequest.current.get(scope) !== request) return
    await refresh()
    if (reorderRequest.current.get(scope) === request) clearOptimistic(scope)
  }

  function clearOptimistic(scope: Scope) {
    setOptimistic((current) => {
      const next = new Map(current)
      next.delete(scope)
      return next
    })
  }

  const addEntryButton =
    list === null ? (
      <Hint label="Crea prima un gruppo">
        <span
          tabIndex={0}
          aria-label="Aggiungi persona (crea prima un gruppo)"
          className="inline-flex rounded-(--pn-r-3)"
        >
          <Button size="sm" disabled className={cn(buttonMotion, "h-10 px-3.5 text-[14px]")}>
            <Plus aria-hidden data-icon="inline-start" />
            Aggiungi persona
          </Button>
        </span>
      </Hint>
    ) : (
      <Button size="sm" className={buttonMotion} onClick={() => openEntryDialog(null)}>
        <Plus aria-hidden data-icon="inline-start" />
        Aggiungi persona
      </Button>
    )

  const segments = (
    <SegmentedControl
      label="Sezione della pagina"
      items={[
        { value: "website" as const, label: "Sito web", count: websiteCount },
        { value: "projects" as const, label: "Progetti", count: projects.length },
      ]}
      value={tab}
      onValueChange={setTab}
    />
  )

  const entryList = (
    <div
      ref={entryFocus.surfaceRef}
      tabIndex={-1}
      className="overflow-hidden rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-surface)"
    >
      {list === null ? (
        <EmptyState
          icon={HeartHandshake}
          title="Ancora nessun gruppo"
          // No action here: writers have "Nuovo gruppo" at the end of the group list beside it.
          text={
            canWrite
              ? "Crea un gruppo, ad esempio Designer o Developer, per iniziare ad aggiungere persone."
              : "I gruppi e le loro persone compaiono qui."
          }
        />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title={list.section === "projects" ? "Ancora nessuna persona" : "Nessuna persona in questo gruppo"}
          text={
            list.section === "projects"
              ? "Finché l'elenco è vuoto, la sezione dei progetti non compare sul sito."
              : "Finché il gruppo è vuoto, non compare sul sito."
          }
          action={
            canWrite ? (
              <Button variant="outline" size="sm" className={buttonMotion} onClick={() => openEntryDialog(null)}>
                <Plus aria-hidden data-icon="inline-start" />
                Aggiungi persona
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DragDropProvider
          onDragEnd={(event) => {
            const ordered = droppedOrder(event, entries)
            if (ordered)
              reorder(
                list.section === "projects" ? "projects" : list.groupId,
                ordered.map((item) => item.id)
              )
          }}
        >
          <DropSettle />
          <ul aria-label={list.section === "projects" ? "Persone dei progetti" : `Persone di ${group?.title ?? ""}`}>
            {entries.map((item, index) => (
              <EntryRow
                key={item.id}
                entry={item}
                index={index}
                group={list.section === "projects" ? "acknowledgements-projects" : `acknowledgements-${list.groupId}`}
                canWrite={canWrite}
                onEdit={(trigger) => {
                  entryFocus.capture(trigger)
                  openEntryDialog(item)
                }}
                onDelete={(trigger) => {
                  entryFocus.capture(trigger)
                  setDeletingEntry(item)
                  setDeleteEntryOpen(true)
                }}
              />
            ))}
          </ul>
        </DragDropProvider>
      )}
    </div>
  )

  return (
    <>
      <PageBar
        description={`Mostrati nella pagina Ringraziamenti del sito in quest'ordine${canWrite ? ", trascina per riordinare" : ""}`}
        left={<Toolbar filters={segments} />}
        right={canWrite ? addEntryButton : undefined}
      />
      <PageContent>
        {tab === "projects" ? (
          <div className="flex min-w-0 flex-col gap-3.5">
            <div className="flex min-w-0 flex-col">
              <h2 className="truncate text-[18px] leading-6 font-semibold">I progetti di PoliNetwork</h2>
              <span className="text-[13px] text-(--pn-fg-muted)">
                {people(projects.length)}, ciascuna con il progetto a cui ha contribuito
              </span>
            </div>
            {entryList}
          </div>
        ) : (
          <div className="grid items-start gap-5 min-[1100px]:grid-cols-[260px_minmax(0,1fr)]">
            {groups.length > 0 || canWrite ? (
              <DragDropProvider
                onDragEnd={(event) => {
                  const ordered = droppedOrder(event, groups)
                  if (ordered)
                    reorder(
                      "groups",
                      ordered.map((item) => item.id)
                    )
                }}
              >
                <DropSettle />
                <GroupList
                  groups={groups}
                  currentId={group?.id ?? null}
                  sortable={canWrite && groups.length > 1}
                  onSelect={setSelectedId}
                  onAdd={canWrite ? () => openGroupDialog(null) : undefined}
                />
              </DragDropProvider>
            ) : null}

            <div className="flex min-w-0 flex-col gap-3.5">
              {group ? (
                <div className="flex min-w-55 items-center gap-2.5">
                  <span className="grid size-9.5 shrink-0 place-items-center rounded-[9px] border border-(--pn-line) bg-(--pn-muted) text-(--pn-fg)">
                    <AcknowledgementIcon icon={group.icon} aria-hidden strokeWidth={1.75} className="size-4.5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h2 className="truncate text-[18px] leading-6 font-semibold">{group.title}</h2>
                    <span className="truncate text-[13px] text-(--pn-fg-muted)">{people(entries.length)}</span>
                  </div>
                  {canWrite ? (
                    <RowActions className="max-shell:ml-0">
                      <IconButton
                        label="Modifica gruppo"
                        ariaLabel={`Modifica ${group.title}`}
                        icon={Pencil}
                        onClick={() => openGroupDialog(group)}
                      />
                      <IconButton
                        label="Elimina gruppo"
                        ariaLabel={`Elimina ${group.title}`}
                        icon={Trash2}
                        tone="danger"
                        onClick={() => setDeleteGroupOpen(true)}
                      />
                    </RowActions>
                  ) : null}
                </div>
              ) : null}
              {entryList}
            </div>
          </div>
        )}
      </PageContent>

      {canWrite && (
        <>
          <AcknowledgementGroupDialog
            key={`group-${groupDialog.key}`}
            open={groupDialog.open}
            onOpenChange={(open) => setGroupDialog((current) => ({ ...current, open }))}
            group={groupDialog.group}
            onSaved={async (groupId) => {
              await refresh()
              appToast.success(groupDialog.group ? "Gruppo aggiornato." : "Gruppo creato.")
              if (!groupDialog.group) setSelectedId(groupId)
            }}
          />
          {list && (
            <AcknowledgementDialog
              key={`entry-${entryDialog.key}`}
              open={entryDialog.open}
              onOpenChange={(open) => setEntryDialog((current) => ({ ...current, open }))}
              entry={entryDialog.entry}
              list={list}
              groupTitle={group?.title}
              finalFocus={entryDialog.entry ? entryFocus.target : undefined}
              onSaved={async () => {
                await refresh()
                appToast.success(entryDialog.entry ? "Persona aggiornata." : "Persona aggiunta.")
              }}
            />
          )}
        </>
      )}
      <ConfirmDialog
        open={deleteGroupOpen}
        onOpenChange={setDeleteGroupOpen}
        title="Eliminare il gruppo?"
        description={
          group && group.entries.length > 0
            ? `${group.title} e ${group.entries.length === 1 ? "la sua persona vengono eliminati" : `le sue ${people(group.entries.length)} vengono eliminati`} dalla pagina Ringraziamenti. Non si può annullare.`
            : `${group?.title ?? "Il gruppo"} viene eliminato. Non si può annullare.`
        }
        confirmLabel="Elimina gruppo"
        cancelLabel="Annulla"
        onConfirm={async () => {
          if (!group) return
          try {
            await deleteGroupFn({ data: { id: group.id } })
          } catch (error) {
            console.error(error)
            throw new Error(acknowledgementsErrorMessage(error, "Non è stato possibile eliminare il gruppo."))
          }
          setSelectedId(null)
          await refresh()
          appToast.success("Gruppo eliminato.")
        }}
      />
      <ConfirmDialog
        open={deleteEntryOpen}
        onOpenChange={setDeleteEntryOpen}
        title="Eliminare la persona?"
        finalFocus={entryFocus.target}
        description={
          deletingEntry ? `${deletingEntry.name} viene tolta dalla pagina Ringraziamenti. Non si può annullare.` : ""
        }
        confirmLabel="Elimina persona"
        cancelLabel="Annulla"
        onConfirm={async () => {
          if (!deletingEntry) return
          try {
            await deleteEntryFn({ data: { id: deletingEntry.id } })
          } catch (error) {
            console.error(error)
            throw new Error(acknowledgementsErrorMessage(error, "Non è stato possibile eliminare la persona."))
          }
          await refresh()
          appToast.success("Persona eliminata.")
        }}
      />
    </>
  )
}

type SortableRefs = {
  itemRef: (element: Element | null) => void
  handleRef: (element: Element | null) => void
  lifted: boolean
}

type GroupListProps = {
  groups: AcknowledgementGroup[]
  currentId: number | null
  sortable: boolean
  onSelect: (groupId: number) => void
  /** Without write access there is no "Nuovo gruppo". */
  onAdd?: () => void
}

/**
 * The groups as a list beside their people (icon, title, count); below 1100px a scrolling row of pills. Writers drag
 * them to reorder. The current one is marked with `aria-current`.
 */
function GroupList({ groups, currentId, sortable, onSelect, onAdd }: GroupListProps) {
  return (
    <nav
      aria-label="Gruppi"
      className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none] max-shell:-mx-4 max-shell:px-4 min-[1100px]:flex-col min-[1100px]:gap-0.5 min-[1100px]:rounded-(--pn-r-5) min-[1100px]:border min-[1100px]:border-(--pn-line) min-[1100px]:bg-(--pn-surface) min-[1100px]:p-2"
    >
      <p className="px-3 pt-2 pb-1.5 text-xs font-medium text-(--pn-fg-muted) max-[1099px]:hidden">Gruppi</p>
      {groups.map((item, index) => (
        <GroupButton
          key={item.id}
          group={item}
          index={index}
          current={item.id === currentId}
          sortable={sortable}
          onSelect={() => onSelect(item.id)}
        />
      ))}
      {onAdd ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAdd}
          className={cn(
            buttonMotion,
            "h-9 shrink-0 rounded-full border border-dashed border-(--pn-line-strong) text-(--pn-fg-muted) hover:border-(--pn-hover-line) hover:text-(--pn-fg) min-[1100px]:mt-1.5 min-[1100px]:h-10 min-[1100px]:rounded-(--pn-r-3)"
          )}
        >
          <FolderPlus aria-hidden data-icon="inline-start" />
          Nuovo gruppo
        </Button>
      ) : null}
    </nav>
  )
}

type GroupButtonProps = {
  group: AcknowledgementGroup
  index: number
  current: boolean
  sortable: boolean
  onSelect: () => void
}

/** Read-only users get a plain button: dnd-kit marks every registered item as a disabled drag source otherwise. */
function GroupButton(props: GroupButtonProps) {
  return props.sortable ? <SortableGroupButton {...props} /> : <GroupPill {...props} />
}

function SortableGroupButton(props: GroupButtonProps) {
  const reduceMotion = useReducedMotion()
  // Only the grip drags, so the group button keeps selecting with Enter/Space.
  const { ref, handleRef, isDragging, isDropping } = useSortable({
    id: props.group.id,
    index: props.index,
    group: GROUP_SORT_GROUP,
    transition: reduceMotion ? null : SORT_TRANSITION,
  })
  return <GroupPill {...props} sortableRefs={{ itemRef: ref, handleRef, lifted: isDragging || isDropping }} />
}

function GroupPill({ group, current, onSelect, sortableRefs }: GroupButtonProps & { sortableRefs?: SortableRefs }) {
  return (
    <div
      ref={sortableRefs?.itemRef}
      className={cn(
        "group/cat relative flex shrink-0 rounded-full min-[1100px]:w-full min-[1100px]:rounded-[9px]",
        sortableRefs?.lifted && "z-10 bg-(--pn-surface) shadow-(--pn-shadow-float)"
      )}
    >
      {sortableRefs ? (
        <button
          ref={sortableRefs.handleRef}
          type="button"
          aria-label={`Riordina ${group.title}`}
          className="absolute inset-y-0 left-0 z-1 flex w-8 cursor-grab items-center justify-center rounded-l-full text-(--pn-fg-subtle) outline-offset-[-2px] select-none group-hover/cat:text-(--pn-fg-muted) active:cursor-grabbing min-[1100px]:rounded-l-[9px]"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      ) : null}
      <button
        type="button"
        aria-current={current ? "true" : undefined}
        onClick={onSelect}
        className={cn(
          "relative flex h-9 w-full items-center gap-2.5 rounded-full border border-(--pn-line) bg-(--pn-surface) px-3 text-[14px] font-medium whitespace-nowrap text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:text-(--pn-fg) min-[1100px]:h-11 min-[1100px]:rounded-[9px] min-[1100px]:border-0 min-[1100px]:bg-transparent min-[1100px]:hover:bg-(--pn-hover)",
          current &&
            "text-(--pn-fg) min-[1100px]:bg-(--pn-muted) min-[1100px]:shadow-[inset_0_0_0_1px_var(--pn-line-strong)] max-[1099px]:border-(--pn-line-strong) max-[1099px]:bg-(--pn-muted) max-[1099px]:text-(--pn-fg)",
          sortableRefs && "pl-8"
        )}
      >
        <AcknowledgementIcon
          icon={group.icon}
          aria-hidden
          className={cn("size-4.5 shrink-0", current ? "text-(--pn-accent)" : "text-(--pn-fg-muted)")}
        />
        <span className="min-w-0 truncate">{group.title}</span>
        <span className="ml-auto font-mono text-xs font-normal text-(--pn-fg-muted) tabular-nums max-[1099px]:ml-1">
          {formatNumber(group.entries.length)}
        </span>
      </button>
    </div>
  )
}

type EntryRowProps = {
  entry: Acknowledgement
  index: number
  group: string
  canWrite: boolean
  onEdit: (trigger: HTMLElement) => void
  onDelete: (trigger: HTMLElement) => void
}

/** One person: the name, the detail under it as on the website, and the row actions. */
function EntryRow(props: EntryRowProps) {
  return props.canWrite ? <SortableEntryRow {...props} /> : <EntryRowView {...props} />
}

function SortableEntryRow(props: EntryRowProps) {
  const reduceMotion = useReducedMotion()
  // Only the grip drags, so the actions keep their own keys and clicks.
  const { ref, handleRef, isDragging, isDropping } = useSortable({
    id: props.entry.id,
    index: props.index,
    group: props.group,
    transition: reduceMotion ? null : SORT_TRANSITION,
  })
  return <EntryRowView {...props} sortableRefs={{ itemRef: ref, handleRef, lifted: isDragging || isDropping }} />
}

function EntryRowView({
  entry,
  canWrite,
  onEdit,
  onDelete,
  sortableRefs,
}: EntryRowProps & { sortableRefs?: SortableRefs }) {
  return (
    <li
      ref={sortableRefs?.itemRef}
      data-slot="acknowledgement-row"
      className={cn(
        "relative flex min-h-14 items-center gap-3 border-b border-(--pn-line) bg-(--pn-surface) py-2 pr-3 pl-5 last:border-b-0",
        sortableRefs?.lifted && "z-10 shadow-(--pn-shadow-float)"
      )}
    >
      {sortableRefs ? (
        <button
          ref={sortableRefs.handleRef}
          type="button"
          aria-label={`Riordina ${entry.name}`}
          className="-my-2 -mr-2 -ml-4 flex size-8 shrink-0 cursor-grab items-center justify-center rounded-(--pn-r-2) text-(--pn-fg-subtle) select-none hover:text-(--pn-fg-muted) active:cursor-grabbing"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Hint overflowOnly label={entry.name}>
          <span className="truncate text-[14px] leading-5 font-medium text-(--pn-fg)">{entry.name}</span>
        </Hint>
        {entry.detail ? (
          <span className="truncate text-xs font-medium tracking-wide text-(--pn-fg-muted) uppercase">
            {entry.detail}
          </span>
        ) : null}
      </span>
      {canWrite && (
        <RowActions>
          <IconButton
            label="Modifica"
            ariaLabel={`Modifica ${entry.name}`}
            icon={Pencil}
            onClick={(event) => onEdit(event.currentTarget)}
          />
          <IconButton
            label="Elimina"
            ariaLabel={`Elimina ${entry.name}`}
            icon={Trash2}
            tone="danger"
            onClick={(event) => onDelete(event.currentTarget)}
          />
        </RowActions>
      )}
    </li>
  )
}
