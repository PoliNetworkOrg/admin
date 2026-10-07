import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { CircleQuestionMark, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react"
import { useDeferredValue, useRef, useState } from "react"

import {
  buttonMotion,
  ConfirmDialog,
  EmptyState,
  floatingMotion,
  Hint,
  IconButton,
  raisedSurface,
  useEditSlot,
  useFocusAfterRemoval,
} from "@/components/primitives"
import { appToast, Count, PageBar, PageContent, Toolbar, useCanWrite } from "@/components/shell"
import { Accordion } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { FAQItem, FAQs } from "@/lib/api/types"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

import { FaqCategoryDialog } from "./faq-category-dialog"
import { FAQCategoryIcon } from "./faq-icon"
import { EditableFaq, EMPTY_FAQ, type FaqInput, FaqRow, toFaqInput } from "./faq-items"
import { addFAQ, deleteFAQ, deleteFAQCategory, editFAQ } from "./faqs.functions"

type FaqCategory = FAQs[number]

/** `faqId` of the unsaved item appended by "Add FAQ". */
const DRAFT_ID = -1

function matches(faq: FAQItem, query: string) {
  const needle = query.toLocaleLowerCase()
  return [faq.titleIt, faq.titleEn, faq.descriptionIt, faq.descriptionEn].some((text) =>
    text.toLocaleLowerCase().includes(needle)
  )
}

type CategoryDialogState = { key: number; category: FaqCategory | null }

/** FAQs (docs/design.md §7.13): one category at a time, an accordion of IT/EN questions edited inline. */
export function FAQsPage({ categories }: { categories: FAQs }) {
  const router = useRouter()
  const addFAQFn = useServerFn(addFAQ)
  const editFAQFn = useServerFn(editFAQ)
  const deleteFAQFn = useServerFn(deleteFAQ)
  const deleteCategoryFn = useServerFn(deleteFAQCategory)
  const canWrite = useCanWrite("web")
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim())
  const [openIds, setOpenIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const edit = useEditSlot<number>("FAQ", saving)
  const editDirty = useRef(false)
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialogState>({ key: 0, category: null })
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [deleteCategoryOpen, setDeleteCategoryOpen] = useState(false)
  const [deletingFaq, setDeletingFaq] = useState<FAQItem | null>(null)
  const [deleteFaqOpen, setDeleteFaqOpen] = useState(false)
  const faqFocus = useFocusAfterRemoval<HTMLDivElement>("[data-slot=accordion-item]")

  const category = categories.find((item) => item.categoryId === selectedId) ?? categories[0] ?? null
  const faqs = category?.faqs ?? []
  const visible = deferredQuery
    ? faqs.filter((faq) => faq.faqId === edit.editingId || matches(faq, deferredQuery))
    : faqs
  const drafting = edit.editingId === DRAFT_ID && category !== null

  function selectCategory(categoryId: number) {
    if (categoryId === category?.categoryId) return
    // A dirty edit asks "Discard changes?" first; the category switches only once the user discards.
    edit.start(null, editDirty.current, () => {
      editDirty.current = false
      setSelectedId(categoryId)
      setOpenIds([])
    })
  }

  function openCategoryDialog(target: FaqCategory | null) {
    setCategoryDialog((current) => ({ key: current.key + 1, category: target }))
    setCategoryDialogOpen(true)
  }

  function startEdit(faqId: number) {
    edit.start(faqId, editDirty.current)
  }

  function finishEdit(savedId: number | null) {
    edit.stop()
    editDirty.current = false
    if (savedId !== null) setOpenIds((current) => (current.includes(savedId) ? current : [...current, savedId]))
  }

  async function saveFaq(faqId: number, categoryId: number, input: FaqInput) {
    setSaving(true)
    try {
      let savedId = faqId
      try {
        if (faqId === DRAFT_ID) {
          savedId = (await addFAQFn({ data: { ...input, categoryId } })).id
        } else {
          await editFAQFn({ data: { id: faqId, ...input, categoryId } })
        }
      } catch (error) {
        console.error(error)
        throw new Error("Couldn't save the FAQ.")
      }
      await router.invalidate({ sync: true })
      finishEdit(savedId)
    } finally {
      setSaving(false)
    }
  }

  const addFaqButton =
    categories.length === 0 ? (
      <Hint label="Create a category first">
        <span tabIndex={0} aria-label="Add FAQ (create a category first)" className="inline-flex rounded-(--pn-r-3)">
          <Button size="sm" disabled className={buttonMotion}>
            <Plus aria-hidden data-icon="inline-start" />
            Add FAQ
          </Button>
        </span>
      </Hint>
    ) : (
      <Button size="sm" className={buttonMotion} onClick={() => startEdit(DRAFT_ID)}>
        <Plus aria-hidden data-icon="inline-start" />
        Add FAQ
      </Button>
    )

  // The page primary stays in the header bar; the empty state repeats it as outline (§8.4).
  const emptyAddFaqButton = (
    <Button variant="outline" size="sm" className={buttonMotion} onClick={() => startEdit(DRAFT_ID)}>
      <Plus aria-hidden data-icon="inline-start" />
      Add FAQ
    </Button>
  )

  const addCategoryButton = (
    <Button variant="outline" size="sm" className={buttonMotion} onClick={() => openCategoryDialog(null)}>
      <FolderPlus aria-hidden data-icon="inline-start" />
      Add category
    </Button>
  )

  const left = (
    <Toolbar
      lead={
        // One surface for everything that acts on the category: its picker and its edit/delete actions.
        <div
          role="group"
          aria-label="Category"
          className="flex h-9 shrink-0 items-stretch rounded-(--pn-r-3) border border-(--pn-line-strong) bg-(--pn-surface)"
        >
          <span
            aria-hidden
            className="flex items-center border-r border-(--pn-line) px-3 text-xs font-medium text-(--pn-fg-muted)"
          >
            Category
          </span>
          <CategorySelect
            categories={categories}
            category={category}
            onSelect={selectCategory}
            lastInGroup={!(canWrite && category)}
          />
          {canWrite && category && (
            <div className="flex items-stretch border-l border-(--pn-line)">
              <IconButton
                label="Edit category"
                ariaLabel={`Edit ${category.titleIt}`}
                icon={Pencil}
                onClick={() => openCategoryDialog(category)}
                className={groupedAction}
              />
              <IconButton
                label="Delete category"
                ariaLabel={`Delete ${category.titleIt}`}
                icon={Trash2}
                tone="danger"
                onClick={() => setDeleteCategoryOpen(true)}
                className={cn(groupedAction, "rounded-r-[calc(var(--pn-r-3)-1px)]")}
              />
            </div>
          )}
        </div>
      }
      search={
        category
          ? {
              value: query,
              onChange: setQuery,
              placeholder: "Search questions…",
              className: "min-w-28 lg:flex-[0_1_auto]",
            }
          : undefined
      }
      count={category && <Count value={visible.length} total={deferredQuery ? faqs.length : undefined} noun="FAQ" />}
    />
  )

  return (
    <>
      <PageBar
        left={left}
        right={
          canWrite ? (
            <>
              {addCategoryButton}
              {addFaqButton}
            </>
          ) : undefined
        }
      />
      <PageContent>
        <div
          ref={faqFocus.surfaceRef}
          tabIndex={-1}
          className="overflow-hidden rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface)"
        >
          {category === null ? (
            <EmptyState
              icon={CircleQuestionMark}
              title="No categories yet"
              text="Create a category to start adding FAQs."
              action={canWrite ? addCategoryButton : undefined}
            />
          ) : visible.length === 0 && !drafting ? (
            deferredQuery ? (
              <EmptyState
                icon={CircleQuestionMark}
                title="No FAQs match"
                text="Try a different question or keyword."
                action={
                  <Button variant="ghost" size="sm" className={buttonMotion} onClick={() => setQuery("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={CircleQuestionMark}
                title="No FAQs in this category"
                text="Add the first question and answer."
                action={canWrite ? emptyAddFaqButton : undefined}
              />
            )
          ) : (
            <Accordion multiple value={openIds} onValueChange={(next) => setOpenIds(next.map(Number))}>
              {visible.map((faq) =>
                faq.faqId === edit.editingId ? (
                  <EditableFaq
                    key={faq.faqId}
                    faqId={faq.faqId}
                    initial={toFaqInput(faq)}
                    dirtyRef={editDirty}
                    onCancel={() => finishEdit(null)}
                    onSave={(input) => saveFaq(faq.faqId, category.categoryId, input)}
                  />
                ) : (
                  <FaqRow
                    key={faq.faqId}
                    faq={faq}
                    canWrite={canWrite}
                    onEdit={() => startEdit(faq.faqId)}
                    onDelete={(trigger) => {
                      faqFocus.capture(trigger)
                      setDeletingFaq(faq)
                      setDeleteFaqOpen(true)
                    }}
                  />
                )
              )}
              {drafting && (
                <EditableFaq
                  key={`draft-${category.categoryId}`}
                  faqId={DRAFT_ID}
                  initial={EMPTY_FAQ}
                  dirtyRef={editDirty}
                  onCancel={() => finishEdit(null)}
                  onSave={(input) => saveFaq(DRAFT_ID, category.categoryId, input)}
                />
              )}
            </Accordion>
          )}
        </div>
      </PageContent>

      {edit.discardDialog}
      {canWrite && (
        <FaqCategoryDialog
          key={categoryDialog.key}
          open={categoryDialogOpen}
          onOpenChange={setCategoryDialogOpen}
          category={categoryDialog.category}
          onSaved={async (categoryId) => {
            await router.invalidate({ sync: true })
            // A new category opens unless that would drop an edit in progress.
            if (edit.editingId === null) setSelectedId(categoryId)
          }}
        />
      )}
      <ConfirmDialog
        open={deleteCategoryOpen}
        onOpenChange={setDeleteCategoryOpen}
        title="Delete category?"
        description={`${category?.titleIt ?? "This category"} and all its FAQs are deleted. This cannot be undone.`}
        confirmLabel="Delete category"
        onConfirm={async () => {
          if (!category) return
          try {
            await deleteCategoryFn({ data: { id: category.categoryId } })
          } catch (error) {
            console.error(error)
            throw new Error("Couldn't delete the category.")
          }
          edit.stop()
          editDirty.current = false
          setSelectedId(null)
          setOpenIds([])
          await router.invalidate({ sync: true })
          appToast.success("Category deleted.")
        }}
      />
      <ConfirmDialog
        open={deleteFaqOpen}
        onOpenChange={setDeleteFaqOpen}
        title="Delete FAQ?"
        description="The question and both answers are deleted."
        finalFocus={faqFocus.target}
        confirmLabel="Delete FAQ"
        onConfirm={async () => {
          if (!deletingFaq) return
          try {
            await deleteFAQFn({ data: { id: deletingFaq.faqId } })
          } catch (error) {
            console.error(error)
            throw new Error("Couldn't delete the FAQ.")
          }
          await router.invalidate({ sync: true })
          setOpenIds((current) => current.filter((id) => id !== deletingFaq.faqId))
          appToast.success("FAQ deleted.")
        }}
      />
    </>
  )
}

const selectItemClasses =
  "h-9 gap-2 rounded-(--pn-r-2) pl-2 text-[13px] focus:bg-(--pn-muted) focus:text-(--pn-fg) not-data-[variant=destructive]:focus:**:text-(--pn-fg)"

/** Icon buttons inside the category surface: as tall as it, square, no own rounding except at its right edge. */
const groupedAction = "h-full w-9 rounded-none"

type CategorySelectProps = {
  categories: FAQs
  category: FaqCategory | null
  onSelect: (categoryId: number) => void
  /** Without edit/delete (read-only viewers, no category) the trigger ends the group and takes its right rounding. */
  lastInGroup: boolean
}

/** The page-scoping category picker: icon + Italian title; items add the English title and the FAQ count. */
function CategorySelect({ categories, category, onSelect, lastInGroup }: CategorySelectProps) {
  return (
    <Select
      value={category?.categoryId ?? null}
      disabled={categories.length === 0}
      onValueChange={(value) => {
        if (value !== null) onSelect(Number(value))
      }}
    >
      <SelectTrigger
        aria-label="Category"
        className={cn(
          "h-full max-w-60 min-w-36 shrink-0 gap-2 rounded-none border-0 bg-transparent px-2.5 text-[13px] text-(--pn-fg) transition-[background-color] duration-120 hover:bg-(--pn-muted) data-[size=default]:h-full dark:bg-transparent dark:hover:bg-(--pn-muted)",
          lastInGroup && "rounded-r-[calc(var(--pn-r-3)-1px)]"
        )}
      >
        <SelectValue className="min-w-0">
          {() =>
            category ? (
              <>
                <FAQCategoryIcon icon={category.icon} aria-hidden className="size-4 text-(--pn-fg-muted)" />
                <span className="truncate">{category.titleIt}</span>
              </>
            ) : (
              <span className="text-(--pn-fg-subtle)">No categories</span>
            )
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        className={cn(raisedSurface, floatingMotion, "w-auto min-w-72 rounded-(--pn-r-4) p-1")}
      >
        {categories.map((item) => (
          <SelectItem key={item.categoryId} value={item.categoryId} className={selectItemClasses}>
            <FAQCategoryIcon icon={item.icon} aria-hidden className="size-4 text-(--pn-fg-muted)" />
            <span>{item.titleIt}</span>
            <span className="text-(--pn-fg-muted)">{item.titleEn}</span>
            <span className="ml-auto pl-4 text-xs leading-5 text-(--pn-fg-muted) tabular-nums">
              {formatNumber(item.faqs.length)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
