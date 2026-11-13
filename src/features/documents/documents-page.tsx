import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"
import { isSortable, useSortable } from "@dnd-kit/react/sortable"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ChevronDown, Download, FileText, FolderPlus, GripVertical, Pencil, Plus, Trash2, Upload } from "lucide-react"
import { useReducedMotion } from "motion/react"
import { useRef, useState } from "react"
import { flushSync } from "react-dom"

import {
  buttonMotion,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Hint,
  IconButton,
  RowActions,
  StatusBadge,
  useFocusAfterRemoval,
} from "@/components/primitives"
import { appToast, PageBar, PageContent, useCan } from "@/components/shell"
import { Accordion, AccordionItem } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { formatDate, formatNumber, pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { DropSettle } from "../projects/projects-page"
import { DocumentCategoryDialog, DocumentDialog, DocumentVersionDialog } from "./document-dialogs"
import {
  deleteDocument,
  deleteDocumentCategory,
  deleteDocumentVersion,
  reorderDocumentCategories,
  reorderDocuments,
} from "./documents.functions"
import { documentsErrorMessage } from "./documents.validation"
import type { DocumentCategory, DocumentVersion, WebDocument } from "./types"

const SORT_TRANSITION = { duration: 160, easing: "cubic-bezier(0.45, 0, 0.2, 1)", idle: false }
const CATEGORY_GROUP = "document-categories"

/** `items` in the order of `ids`; items missing from `ids` (just created) keep their place at the end. */
function inOrder<T extends { id: number }>(items: T[], ids: number[] | undefined) {
  if (!ids) return items
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered = ids.flatMap((id) => byId.get(id) ?? [])
  return [...ordered, ...items.filter((item) => !ids.includes(item.id))]
}

/** The list after a finished drag, or null when nothing moved. */
function droppedOrder<T>(event: DragEndEvent, items: T[]) {
  const { source } = event.operation
  if (event.canceled || !source || !isSortable(source)) return null
  const { initialIndex, index } = source
  if (initialIndex === index) return null
  const ordered = [...items]
  const [moved] = ordered.splice(initialIndex, 1)
  if (moved === undefined) return null
  ordered.splice(index, 0, moved)
  return ordered
}

function displayDate(date: string) {
  return formatDate(new Date(date))
}

function noop() {}

type Order = { scope: "categories" | number; ids: number[] }
type CategoryDialogState = { key: number; open: boolean; category: DocumentCategory | null }
type DocumentDialogState = { key: number; open: boolean; document: WebDocument | null }
type VersionDialogState = { key: number; open: boolean; document: WebDocument | null }
type DeletingVersion = { document: WebDocument; version: DocumentVersion }

/** Website documents: categories beside their documents, each document with its dated PDF versions. */
export function DocumentsPage({ categories: loaded }: { categories: DocumentCategory[] }) {
  const router = useRouter()
  const canWrite = useCan("web:content:write")
  const deleteCategoryFn = useServerFn(deleteDocumentCategory)
  const reorderCategoriesFn = useServerFn(reorderDocumentCategories)
  const deleteDocumentFn = useServerFn(deleteDocument)
  const reorderDocumentsFn = useServerFn(reorderDocuments)
  const deleteVersionFn = useServerFn(deleteDocumentVersion)

  // The order shown for each scope while its reorder is saving; cleared (back to the loader data) once it settles.
  const [optimistic, setOptimistic] = useState<ReadonlyMap<Order["scope"], number[]>>(new Map())
  // The latest request per scope: a newer reorder of the same list supersedes it, one of another list doesn't.
  const reorderRequest = useRef(new Map<Order["scope"], number>())
  const reorderCount = useRef(0)
  const reorderQueue = useRef<Promise<unknown>>(Promise.resolve())

  const categories = inOrder(loaded, optimistic.get("categories"))
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const category = categories.find((item) => item.id === selectedId) ?? categories[0] ?? null
  const documents = category ? inOrder(category.documents, optimistic.get(category.id)) : []
  const [openIds, setOpenIds] = useState<number[]>([])
  const documentFocus = useFocusAfterRemoval<HTMLDivElement>("[data-slot=accordion-item]")

  const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState>({ key: 0, open: false, category: null })
  const [documentDialog, setDocumentDialog] = useState<DocumentDialogState>({ key: 0, open: false, document: null })
  const [versionDialog, setVersionDialog] = useState<VersionDialogState>({ key: 0, open: false, document: null })
  const [deleteCategoryOpen, setDeleteCategoryOpen] = useState(false)
  const [deletingDocument, setDeletingDocument] = useState<WebDocument | null>(null)
  const [deleteDocumentOpen, setDeleteDocumentOpen] = useState(false)
  const [deletingVersion, setDeletingVersion] = useState<DeletingVersion | null>(null)
  const [deleteVersionOpen, setDeleteVersionOpen] = useState(false)

  const totalDocuments = categories.reduce((sum, item) => sum + item.documents.length, 0)

  async function refresh(saved = true) {
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      appToast.warning(
        saved
          ? "Your change was saved, but the latest documents could not be loaded."
          : "The latest documents could not be loaded. Reload the page."
      )
    }
  }

  function selectCategory(categoryId: number) {
    if (categoryId === category?.id) return
    setSelectedId(categoryId)
    setOpenIds([])
  }

  function openCategoryDialog(target: DocumentCategory | null) {
    setCategoryDialog((current) => ({ key: current.key + 1, open: true, category: target }))
  }

  function openDocumentDialog(target: WebDocument | null) {
    setDocumentDialog((current) => ({ key: current.key + 1, open: true, document: target }))
  }

  function openVersionDialog(target: WebDocument) {
    setVersionDialog((current) => ({ key: current.key + 1, open: true, document: target }))
  }

  /** Reorders run one at a time, in the order they were made; only the latest one clears or reverts the order shown. */
  function reorder(scope: Order["scope"], ids: number[]) {
    reorderCount.current += 1
    const request = reorderCount.current
    reorderRequest.current.set(scope, request)
    flushSync(() => setOptimistic((current) => new Map(current).set(scope, ids)))
    const operation = reorderQueue.current.then(() =>
      scope === "categories"
        ? reorderCategoriesFn({ data: { ids } })
        : reorderDocumentsFn({ data: { categoryId: scope, ids } })
    )
    // The caller handles the failure; the queue only needs to know it settled.
    reorderQueue.current = operation.then(noop, noop)
    void settleReorder(scope, operation, request)
  }

  async function settleReorder(scope: Order["scope"], operation: Promise<unknown>, request: number) {
    try {
      await operation
    } catch (error) {
      console.error(error)
      if (reorderRequest.current.get(scope) !== request) return
      clearOptimistic(scope)
      appToast.error(
        documentsErrorMessage(
          error,
          scope === "categories" ? "category" : "document",
          scope === "categories" ? "Couldn't save the category order." : "Couldn't save the document order."
        )
      )
      void refresh(false)
      return
    }
    if (reorderRequest.current.get(scope) !== request) return
    await refresh()
    if (reorderRequest.current.get(scope) === request) clearOptimistic(scope)
  }

  function clearOptimistic(scope: Order["scope"]) {
    setOptimistic((current) => {
      const next = new Map(current)
      next.delete(scope)
      return next
    })
  }

  const addDocumentButton =
    category === null ? (
      <Hint label="Create a category first">
        <span
          tabIndex={0}
          aria-label="Add document (create a category first)"
          className="inline-flex rounded-(--pn-r-3)"
        >
          <Button size="sm" disabled className={cn(buttonMotion, "h-10 px-3.5 text-[14px]")}>
            <Plus aria-hidden data-icon="inline-start" />
            Add document
          </Button>
        </span>
      </Hint>
    ) : (
      <Button size="sm" className={buttonMotion} onClick={() => openDocumentDialog(null)}>
        <Plus aria-hidden data-icon="inline-start" />
        Add document
      </Button>
    )

  const documentList = (
    <div
      ref={documentFocus.surfaceRef}
      tabIndex={-1}
      className="overflow-hidden rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-surface)"
    >
      {category === null ? (
        <EmptyState
          icon={FileText}
          title="No categories yet"
          // No action here: writers have "Add category" at the end of the category list beside it.
          text={
            canWrite ? "Create a category to start adding documents." : "Categories and their documents appear here."
          }
        />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents in this category"
          text="Add a document, then upload its first PDF version."
          action={
            canWrite ? (
              <Button variant="outline" size="sm" className={buttonMotion} onClick={() => openDocumentDialog(null)}>
                <Plus aria-hidden data-icon="inline-start" />
                Add document
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DragDropProvider
          onDragEnd={(event) => {
            const ordered = droppedOrder(event, documents)
            if (ordered)
              reorder(
                category.id,
                ordered.map((item) => item.id)
              )
          }}
        >
          <DropSettle />
          <Accordion multiple value={openIds} onValueChange={(next) => setOpenIds(next.map(Number))}>
            {documents.map((item, index) => (
              <DocumentRow
                key={item.id}
                document={item}
                index={index}
                group={`documents-${category.id}`}
                canWrite={canWrite}
                onUpload={() => openVersionDialog(item)}
                onEdit={(trigger) => {
                  documentFocus.capture(trigger)
                  openDocumentDialog(item)
                }}
                onDelete={(trigger) => {
                  documentFocus.capture(trigger)
                  setDeletingDocument(item)
                  setDeleteDocumentOpen(true)
                }}
                onDeleteVersion={(version, trigger) => {
                  documentFocus.capture(trigger)
                  setDeletingVersion({ document: item, version })
                  setDeleteVersionOpen(true)
                }}
              />
            ))}
          </Accordion>
        </DragDropProvider>
      )}
    </div>
  )

  return (
    <>
      <PageBar
        description={`${pluralize(totalDocuments, "document")} in ${pluralize(categories.length, "category")}, shown on the website in this order${canWrite ? " — drag to reorder" : ""}`}
        right={canWrite ? addDocumentButton : undefined}
      />
      <PageContent>
        <div className="grid items-start gap-5 min-[1100px]:grid-cols-[260px_minmax(0,1fr)]">
          {categories.length > 0 || canWrite ? (
            <DragDropProvider
              onDragEnd={(event) => {
                const ordered = droppedOrder(event, categories)
                if (ordered)
                  reorder(
                    "categories",
                    ordered.map((item) => item.id)
                  )
              }}
            >
              <DropSettle />
              <CategoryList
                categories={categories}
                currentId={category?.id ?? null}
                sortable={canWrite && categories.length > 1}
                onSelect={selectCategory}
                onAdd={canWrite ? () => openCategoryDialog(null) : undefined}
              />
            </DragDropProvider>
          ) : null}

          <div className="flex min-w-0 flex-col gap-3.5">
            {category ? (
              <div className="flex min-w-55 items-start gap-2.5">
                <span className="grid size-9.5 shrink-0 place-items-center rounded-[9px] border border-(--pn-line) bg-(--pn-muted) text-(--pn-fg)">
                  <FileText aria-hidden strokeWidth={1.75} className="size-4.5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <h2 className="truncate text-[18px] leading-6 font-semibold">{category.title}</h2>
                  <span className="truncate text-[13px] text-(--pn-fg-muted)">
                    <span className="font-mono">{category.slug}</span>, {pluralize(documents.length, "document")}
                  </span>
                  {category.description ? (
                    <p className="mt-1.5 text-[14px] whitespace-pre-line wrap-anywhere text-(--pn-fg-muted)">
                      {category.description}
                    </p>
                  ) : null}
                </div>
                {canWrite ? (
                  <RowActions className="max-shell:ml-0">
                    <IconButton
                      label="Edit category"
                      ariaLabel={`Edit ${category.title}`}
                      icon={Pencil}
                      onClick={() => openCategoryDialog(category)}
                    />
                    <IconButton
                      label="Delete category"
                      ariaLabel={`Delete ${category.title}`}
                      icon={Trash2}
                      tone="danger"
                      onClick={() => setDeleteCategoryOpen(true)}
                    />
                  </RowActions>
                ) : null}
              </div>
            ) : null}
            {documentList}
          </div>
        </div>
      </PageContent>

      {canWrite && (
        <>
          <DocumentCategoryDialog
            key={`category-${categoryDialog.key}`}
            open={categoryDialog.open}
            onOpenChange={(open) => setCategoryDialog((current) => ({ ...current, open }))}
            category={categoryDialog.category}
            onSaved={async (categoryId) => {
              await refresh()
              appToast.success(categoryDialog.category ? "Category updated." : "Category added.")
              if (!categoryDialog.category) selectCategory(categoryId)
            }}
          />
          {category && (
            <DocumentDialog
              key={`document-${documentDialog.key}`}
              open={documentDialog.open}
              onOpenChange={(open) => setDocumentDialog((current) => ({ ...current, open }))}
              document={documentDialog.document}
              finalFocus={documentDialog.document ? documentFocus.target : undefined}
              categoryId={category.id}
              categories={categories}
              onSaved={async (saved) => {
                await refresh()
                const target = categories.find((item) => item.id === saved.categoryId)
                if (!documentDialog.document) {
                  appToast.success("Document added. Upload its first version to show it on the website.")
                  selectCategory(saved.categoryId)
                  setOpenIds([saved.id])
                } else if (saved.categoryId !== category.id) {
                  appToast.success(`Document moved to ${target?.title ?? "another category"}.`)
                } else {
                  appToast.success("Document updated.")
                }
              }}
            />
          )}
          {versionDialog.document && (
            <DocumentVersionDialog
              key={`version-${versionDialog.key}`}
              open={versionDialog.open}
              onOpenChange={(open) => setVersionDialog((current) => ({ ...current, open }))}
              document={versionDialog.document}
              onUploaded={async (version) => {
                const documentId = versionDialog.document?.id
                await refresh()
                if (documentId !== undefined)
                  setOpenIds((current) => (current.includes(documentId) ? current : [...current, documentId]))
                appToast.success(`Version ${version.version} uploaded.`)
              }}
            />
          )}
        </>
      )}
      <ConfirmDialog
        open={deleteCategoryOpen}
        onOpenChange={setDeleteCategoryOpen}
        title="Delete category?"
        description={
          category && category.documents.length > 0
            ? `${category.title} still has ${pluralize(category.documents.length, "document")}: move or delete them first, since only an empty category can be deleted.`
            : `${category?.title ?? "This category"} is removed from the website. This cannot be undone.`
        }
        confirmLabel="Delete category"
        onConfirm={async () => {
          if (!category) return
          try {
            await deleteCategoryFn({ data: { id: category.id } })
          } catch (error) {
            console.error(error)
            throw new Error(documentsErrorMessage(error, "category", "Couldn't delete the category."))
          }
          setSelectedId(null)
          setOpenIds([])
          await refresh()
          appToast.success("Category deleted.")
        }}
      />
      <ConfirmDialog
        open={deleteDocumentOpen}
        onOpenChange={setDeleteDocumentOpen}
        title="Delete document?"
        finalFocus={documentFocus.target}
        description={
          deletingDocument
            ? deletingDocument.versions.length === 0
              ? `${deletingDocument.title} is deleted. It has no versions, so it isn't on the website. This cannot be undone.`
              : `${deletingDocument.title} and ${deletingDocument.versions.length === 1 ? "its only version" : `all ${pluralize(deletingDocument.versions.length, "version")}`} are deleted with their PDFs, and its link on the website stops working. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete document"
        onConfirm={async () => {
          if (!deletingDocument) return
          try {
            await deleteDocumentFn({ data: { id: deletingDocument.id } })
          } catch (error) {
            console.error(error)
            throw new Error(documentsErrorMessage(error, "document", "Couldn't delete the document."))
          }
          await refresh()
          setOpenIds((current) => current.filter((id) => id !== deletingDocument.id))
          appToast.success("Document deleted.")
        }}
      />
      <ConfirmDialog
        open={deleteVersionOpen}
        onOpenChange={setDeleteVersionOpen}
        title="Delete version?"
        finalFocus={documentFocus.target}
        description={deletingVersion ? deleteVersionConsequence(deletingVersion) : ""}
        confirmLabel="Delete version"
        onConfirm={async () => {
          if (!deletingVersion) return
          try {
            await deleteVersionFn({ data: { id: deletingVersion.version.id } })
          } catch (error) {
            console.error(error)
            throw new Error(documentsErrorMessage(error, "version", "Couldn't delete the version."))
          }
          await refresh()
          appToast.success("Version deleted.")
        }}
      />
    </>
  )
}

function deleteVersionConsequence({ document, version }: DeletingVersion) {
  const deleted = `Version ${version.version} and its PDF are deleted.`
  const [current, next] = document.versions
  if (document.versions.length === 1) {
    return `${deleted} It is the only version, so ${document.title} disappears from the website until a new version is uploaded.`
  }
  if (current?.id === version.id && next) {
    return `${deleted} Version ${next.version} of ${displayDate(next.date)} becomes the current one on the website.`
  }
  return `${deleted} This cannot be undone.`
}

type CategoryListProps = {
  categories: DocumentCategory[]
  currentId: number | null
  sortable: boolean
  onSelect: (categoryId: number) => void
  /** Without write access there is no "Add category". */
  onAdd?: () => void
}

/**
 * The categories as a list beside the documents (title, document count); below 1100px a scrolling row of pills.
 * Writers drag them to reorder. The current one is marked with `aria-current`.
 */
function CategoryList({ categories, currentId, sortable, onSelect, onAdd }: CategoryListProps) {
  return (
    <nav
      aria-label="Document categories"
      className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none] max-shell:-mx-4 max-shell:px-4 min-[1100px]:flex-col min-[1100px]:gap-0.5 min-[1100px]:rounded-(--pn-r-5) min-[1100px]:border min-[1100px]:border-(--pn-line) min-[1100px]:bg-(--pn-surface) min-[1100px]:p-2"
    >
      <p className="px-3 pt-2 pb-1.5 text-xs font-medium text-(--pn-fg-muted) max-[1099px]:hidden">Categories</p>
      {categories.map((item, index) => (
        <CategoryButton
          key={item.id}
          category={item}
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
          Add category
        </Button>
      ) : null}
    </nav>
  )
}

type CategoryButtonProps = {
  category: DocumentCategory
  index: number
  current: boolean
  sortable: boolean
  onSelect: () => void
}

type SortableRefs = {
  itemRef: (element: Element | null) => void
  handleRef: (element: Element | null) => void
  lifted: boolean
}

/** Read-only users get a plain button: dnd-kit marks every registered item as a disabled drag source otherwise. */
function CategoryButton(props: CategoryButtonProps) {
  return props.sortable ? <SortableCategoryButton {...props} /> : <CategoryPill {...props} />
}

function SortableCategoryButton(props: CategoryButtonProps) {
  const reduceMotion = useReducedMotion()
  // Only the grip drags (a pointer after 5px, touch after a 250ms press, the keyboard with Space/Enter), so the
  // category button keeps selecting with Enter/Space.
  const { ref, handleRef, isDragging, isDropping } = useSortable({
    id: props.category.id,
    index: props.index,
    group: CATEGORY_GROUP,
    transition: reduceMotion ? null : SORT_TRANSITION,
  })
  return <CategoryPill {...props} sortableRefs={{ itemRef: ref, handleRef, lifted: isDragging || isDropping }} />
}

function CategoryPill({
  category,
  current,
  onSelect,
  sortableRefs,
}: CategoryButtonProps & { sortableRefs?: SortableRefs }) {
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
          aria-label={`Reorder ${category.title}`}
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
        <span className="min-w-0 truncate">{category.title}</span>
        <span className="ml-auto font-mono text-xs font-normal text-(--pn-fg-muted) tabular-nums max-[1099px]:ml-1">
          {formatNumber(category.documents.length)}
        </span>
      </button>
    </div>
  )
}

type DocumentRowProps = {
  document: WebDocument
  index: number
  group: string
  canWrite: boolean
  onUpload: () => void
  onEdit: (trigger: HTMLElement) => void
  onDelete: (trigger: HTMLElement) => void
  onDeleteVersion: (version: DocumentVersion, trigger: HTMLElement) => void
}

/** One document: title, public slug and current version; opens to its description and version history. */
function DocumentRow(props: DocumentRowProps) {
  return props.canWrite ? <SortableDocumentRow {...props} /> : <DocumentRowView {...props} />
}

function SortableDocumentRow(props: DocumentRowProps) {
  const reduceMotion = useReducedMotion()
  // Only the grip drags, so the accordion trigger, the actions and the open panel keep their own keys and clicks.
  const { ref, handleRef, isDragging, isDropping } = useSortable({
    id: props.document.id,
    index: props.index,
    group: props.group,
    transition: reduceMotion ? null : SORT_TRANSITION,
  })
  return <DocumentRowView {...props} sortableRefs={{ itemRef: ref, handleRef, lifted: isDragging || isDropping }} />
}

function DocumentRowView({
  document,
  canWrite,
  onUpload,
  onEdit,
  onDelete,
  onDeleteVersion,
  sortableRefs,
}: DocumentRowProps & { sortableRefs?: SortableRefs }) {
  const current = document.versions[0]

  const columns: DataTableColumn<DocumentVersion>[] = [
    {
      id: "version",
      label: "Version",
      minWidth: 160,
      cell: (version) => (
        <span className="flex min-w-0 items-center gap-2">
          <Hint overflowOnly label={version.version}>
            <span className="truncate font-mono">{version.version}</span>
          </Hint>
          {version.id === current?.id && <StatusBadge tone="brand">Current</StatusBadge>}
        </span>
      ),
    },
    {
      id: "date",
      label: "Date",
      cell: (version) => <span className="whitespace-nowrap tabular-nums">{displayDate(version.date)}</span>,
    },
    {
      id: "file",
      label: "File",
      cell: (version) => (
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          aria-label={`Open version ${version.version} PDF`}
          render={<a href={version.file} target="_blank" rel="noreferrer" />}
          className={cn(
            buttonMotion,
            "h-9 gap-1.5 rounded-(--pn-r-2) px-2.5 text-[13px] has-data-[icon=inline-start]:pl-2 [&_svg]:text-(--pn-fg-muted)"
          )}
        >
          <Download aria-hidden data-icon="inline-start" />
          PDF
        </Button>
      ),
    },
  ]

  return (
    <AccordionItem
      ref={sortableRefs?.itemRef}
      value={document.id}
      className={cn(
        "relative border-(--pn-line) bg-(--pn-surface) transition-[background-color] duration-120 pointer-fine:has-[>h3:hover]:bg-(--pn-hover)",
        sortableRefs?.lifted && "z-10 shadow-(--pn-shadow-float)"
      )}
    >
      <AccordionPrimitive.Header className="flex min-h-14 items-center gap-3 pr-3 pl-5">
        {sortableRefs ? (
          <button
            ref={sortableRefs.handleRef}
            type="button"
            aria-label={`Reorder ${document.title}`}
            className="-my-2 -mr-2 -ml-4 flex size-8 shrink-0 cursor-grab items-center justify-center rounded-(--pn-r-2) text-(--pn-fg-subtle) select-none hover:text-(--pn-fg-muted) active:cursor-grabbing"
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
        ) : null}
        <AccordionPrimitive.Trigger className="group/trigger flex min-w-0 flex-1 items-center gap-3 self-stretch py-3 text-left outline-offset-[-2px]">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Hint overflowOnly label={document.title}>
              <span className="truncate text-[14px] leading-5 font-medium text-(--pn-fg)">{document.title}</span>
            </Hint>
            <span className="truncate font-mono text-xs text-(--pn-fg-muted)">/documents/view/{document.slug}</span>
            {!current && (
              <StatusBadge tone="warning" className="mt-1 max-w-full self-start whitespace-normal shell:hidden">
                Not on the website
              </StatusBadge>
            )}
          </span>
          {current ? (
            <span className="flex shrink-0 flex-col items-end gap-0.5 text-right max-shell:hidden">
              <Hint overflowOnly label={current.version}>
                <span className="max-w-40 truncate font-mono text-[13px] text-(--pn-fg)">{current.version}</span>
              </Hint>
              <span className="text-xs whitespace-nowrap text-(--pn-fg-muted) tabular-nums">
                {displayDate(current.date)}
              </span>
            </span>
          ) : (
            <StatusBadge tone="warning" className="shrink-0 max-shell:hidden">
              Not on the website
            </StatusBadge>
          )}
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-(--pn-fg-muted) transition-transform duration-150 ease-(--pn-ease-out) group-data-panel-open/trigger:rotate-180"
          />
        </AccordionPrimitive.Trigger>
        {canWrite && (
          <RowActions>
            <IconButton
              label="Upload version"
              ariaLabel={`Upload a version of ${document.title}`}
              icon={Upload}
              onClick={onUpload}
            />
            <IconButton
              label="Edit document"
              ariaLabel={`Edit ${document.title}`}
              icon={Pencil}
              onClick={(event) => onEdit(event.currentTarget)}
            />
            <IconButton
              label="Delete document"
              ariaLabel={`Delete ${document.title}`}
              icon={Trash2}
              tone="danger"
              onClick={(event) => onDelete(event.currentTarget)}
            />
          </RowActions>
        )}
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Panel className="grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] ease-(--pn-ease-move) [transition-duration:200ms,150ms] data-ending-style:grid-rows-[0fr] data-ending-style:opacity-0 data-starting-style:grid-rows-[0fr] data-starting-style:opacity-0">
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 px-5 pt-1 pb-4">
            {document.description ? (
              <p className="text-[14px] whitespace-pre-line wrap-anywhere text-(--pn-fg-muted)">
                {document.description}
              </p>
            ) : null}
            <DataTable
              label={`Versions of ${document.title}`}
              compactMobile
              columns={columns}
              rows={document.versions}
              getRowId={(version) => String(version.id)}
              actionsWidth={60}
              actions={
                canWrite
                  ? (version) => (
                      <IconButton
                        label="Delete version"
                        ariaLabel={`Delete version ${version.version}`}
                        icon={Trash2}
                        tone="danger"
                        onClick={(event) => onDeleteVersion(version, event.currentTarget)}
                      />
                    )
                  : undefined
              }
              empty={
                <EmptyState
                  icon={FileText}
                  title="No versions yet"
                  text="The document appears on the website once its first PDF version is uploaded."
                  action={
                    canWrite ? (
                      <Button variant="outline" size="sm" className={buttonMotion} onClick={onUpload}>
                        <Upload aria-hidden data-icon="inline-start" />
                        Upload version
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          </div>
        </div>
      </AccordionPrimitive.Panel>
    </AccordionItem>
  )
}
