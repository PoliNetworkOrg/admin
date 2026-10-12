import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { CircleQuestionMark, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react"
import { useDeferredValue, useRef, useState } from "react"

import {
  buttonMotion,
  ConfirmDialog,
  EmptyState,
  Hint,
  IconButton,
  RowActions,
  useEditSlot,
  useFocusAfterRemoval,
} from "@/components/primitives"
import { appToast, Count, PageBar, PageContent, SearchField, useCan } from "@/components/shell"
import { Accordion } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import type { FAQItem, FAQs } from "@/lib/api/types"
import { formatNumber, pluralize } from "@/lib/format"
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

/** FAQs: one category at a time, an accordion of IT/EN questions edited inline. */
export function FAQsPage({ categories }: { categories: FAQs }) {
  const router = useRouter()
  const addFAQFn = useServerFn(addFAQ)
  const editFAQFn = useServerFn(editFAQ)
  const deleteFAQFn = useServerFn(deleteFAQ)
  const deleteCategoryFn = useServerFn(deleteFAQCategory)
  const canWrite = useCan("web:content:write")
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
          {/* The Hint's span sits between the header and the button, so it takes the header's 40px itself. */}
          <Button size="sm" disabled className={cn(buttonMotion, "h-10 px-3.5 text-[14px]")}>
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

  // The page primary stays in the header bar; the empty state repeats it as outline.
  const emptyAddFaqButton = (
    <Button variant="outline" size="sm" className={buttonMotion} onClick={() => startEdit(DRAFT_ID)}>
      <Plus aria-hidden data-icon="inline-start" />
      Add FAQ
    </Button>
  )

  const totalFaqs = categories.reduce((sum, item) => sum + item.faqs.length, 0)

  const faqList = (
    <div
      ref={faqFocus.surfaceRef}
      tabIndex={-1}
      className="overflow-hidden rounded-(--pn-r-5) border border-(--pn-line) bg-(--pn-surface)"
    >
      {category === null ? (
        <EmptyState
          icon={CircleQuestionMark}
          title="No categories yet"
          // No action here: writers have "Add category" at the end of the category list beside it.
          text="Create a category to start adding FAQs."
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
  )

  return (
    <>
      <PageBar
        description={`${pluralize(totalFaqs, "question")} in ${pluralize(categories.length, "category")}, in Italian and English`}
        right={canWrite ? addFaqButton : undefined}
      />
      <PageContent>
        <div className="grid items-start gap-5 min-[1100px]:grid-cols-[260px_minmax(0,1fr)]">
          {categories.length > 0 || canWrite ? (
            <CategoryList
              categories={categories}
              currentId={category?.categoryId ?? null}
              onSelect={selectCategory}
              onAdd={canWrite ? () => openCategoryDialog(null) : undefined}
            />
          ) : null}

          <div className="flex min-w-0 flex-col gap-3.5">
            {category ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-55 flex-1 items-center gap-2.5">
                  <span className="grid size-9.5 shrink-0 place-items-center rounded-[9px] border border-(--pn-line) bg-(--pn-muted) text-(--pn-fg)">
                    <FAQCategoryIcon icon={category.icon} aria-hidden className="size-4.5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h2 className="truncate text-[18px] leading-6 font-semibold">{category.titleIt}</h2>
                    <span className="truncate text-[13px] text-(--pn-fg-muted)">
                      <span lang="en">{category.titleEn}</span> · {pluralize(faqs.length, "FAQ")}
                    </span>
                  </div>
                  {canWrite ? (
                    <RowActions className="max-shell:ml-0">
                      <IconButton
                        label="Edit category"
                        ariaLabel={`Edit ${category.titleIt}`}
                        icon={Pencil}
                        onClick={() => openCategoryDialog(category)}
                      />
                      <IconButton
                        label="Delete category"
                        ariaLabel={`Delete ${category.titleIt}`}
                        icon={Trash2}
                        tone="danger"
                        onClick={() => setDeleteCategoryOpen(true)}
                      />
                    </RowActions>
                  ) : null}
                </div>
                <div className="flex flex-[1_1_260px] items-center gap-3 shell:max-w-80">
                  <SearchField value={query} onChange={setQuery} placeholder="Search questions…" className="flex-1" />
                  {deferredQuery ? <Count value={visible.length} total={faqs.length} noun="FAQ" /> : null}
                </div>
              </div>
            ) : null}
            {faqList}
          </div>
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

type CategoryListProps = {
  categories: FAQs
  currentId: number | null
  onSelect: (categoryId: number) => void
  /** Without write access there is no "Add category". */
  onAdd?: () => void
}

/**
 * The categories as a list beside the questions (icon, Italian title, FAQ count); below 1100px a scrolling row of
 * pills. The current one is marked with `aria-current`.
 */
function CategoryList({ categories, currentId, onSelect, onAdd }: CategoryListProps) {
  return (
    <nav
      aria-label="FAQ categories"
      className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none] min-[1100px]:flex-col min-[1100px]:gap-0.5 min-[1100px]:rounded-(--pn-r-5) min-[1100px]:border min-[1100px]:border-(--pn-line) min-[1100px]:bg-(--pn-surface) min-[1100px]:p-2"
    >
      <p className="px-3 pt-2 pb-1.5 text-xs font-medium text-(--pn-fg-muted) max-[1099px]:hidden">Categories</p>
      {categories.map((item) => {
        const current = item.categoryId === currentId
        return (
          <button
            key={item.categoryId}
            type="button"
            aria-current={current ? "true" : undefined}
            onClick={() => onSelect(item.categoryId)}
            className={cn(
              "group/cat flex h-9 shrink-0 items-center gap-2.5 rounded-full border border-(--pn-line) bg-(--pn-surface) px-3 text-[14px] font-medium whitespace-nowrap text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:text-(--pn-fg) min-[1100px]:h-11 min-[1100px]:w-full min-[1100px]:rounded-[9px] min-[1100px]:border-0 min-[1100px]:bg-transparent min-[1100px]:hover:bg-[color-mix(in_oklch,var(--pn-muted)_55%,var(--pn-surface))]",
              current &&
                "text-(--pn-fg) min-[1100px]:bg-(--pn-muted) min-[1100px]:shadow-[inset_0_0_0_1px_var(--pn-line-strong)] max-[1099px]:border-(--pn-line-strong) max-[1099px]:bg-(--pn-muted) max-[1099px]:text-(--pn-fg)"
            )}
          >
            <FAQCategoryIcon
              icon={item.icon}
              aria-hidden
              className={cn("size-4.5 shrink-0", current ? "text-(--pn-accent)" : "text-(--pn-fg-muted)")}
            />
            <span className="min-w-0 truncate">{item.titleIt}</span>
            <span className="ml-auto font-mono text-xs font-normal text-(--pn-fg-muted) tabular-nums max-[1099px]:ml-1">
              {formatNumber(item.faqs.length)}
            </span>
          </button>
        )
      })}
      {onAdd ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onAdd}
          className={cn(
            buttonMotion,
            "h-9 shrink-0 rounded-full border border-dashed border-(--pn-line-strong) text-(--pn-fg-muted) hover:border-(--pn-fg-subtle) hover:text-(--pn-fg) min-[1100px]:mt-1.5 min-[1100px]:h-10 min-[1100px]:rounded-(--pn-r-3)"
          )}
        >
          <FolderPlus aria-hidden data-icon="inline-start" />
          Add category
        </Button>
      ) : null}
    </nav>
  )
}
