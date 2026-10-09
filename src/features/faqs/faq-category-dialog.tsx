import { useServerFn } from "@tanstack/react-start"
import { useId, useState } from "react"

import { FormDialog, Hint, InlineEditInput, TranslationGroup, TranslationPanel } from "@/components/primitives"
import { appToast } from "@/components/shell"
import type { FAQs } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { DEFAULT_FAQ_ICON, FAQ_ICONS_MAP, type FAQIconName, isFAQIconName } from "./faq-icon"
import { addFAQCategory, editFAQCategory } from "./faqs.functions"

type FaqCategory = FAQs[number]

const ICON_NAMES = Object.keys(FAQ_ICONS_MAP).filter(isFAQIconName)
const GRID_COLUMNS = 8
const ARROW_STEPS = new Map([
  ["ArrowRight", 1],
  ["ArrowLeft", -1],
  ["ArrowDown", GRID_COLUMNS],
  ["ArrowUp", -GRID_COLUMNS],
])

function iconLabel(name: string) {
  const words = name.replaceAll("-", " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

type Errors = { titleIt?: string; titleEn?: string }

function validate(titleIt: string, titleEn: string): Errors {
  return {
    titleIt: titleIt.trim() === "" ? "Title (Italian) is required." : undefined,
    titleEn: titleEn.trim() === "" ? "Title (English) is required." : undefined,
  }
}

type FaqCategoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Edit this category; `null` creates one. Mount with a fresh `key` per opening. */
  category: FaqCategory | null
  /** Runs after the dialog closed on success, with the saved category's id. */
  onSaved: (categoryId: number) => Promise<void>
}

/** "Add category" / "Edit category": icon grid plus both titles, all validated inline. */
export function FaqCategoryDialog({ open, onOpenChange, category, onSaved }: FaqCategoryDialogProps) {
  const addCategoryFn = useServerFn(addFAQCategory)
  const editCategoryFn = useServerFn(editFAQCategory)
  const initialIcon: FAQIconName = category?.icon && isFAQIconName(category.icon) ? category.icon : DEFAULT_FAQ_ICON
  const initialIt = category?.titleIt ?? ""
  const initialEn = category?.titleEn ?? ""
  const [icon, setIcon] = useState<FAQIconName>(initialIcon)
  const [titleIt, setTitleIt] = useState(initialIt)
  const [titleEn, setTitleEn] = useState(initialEn)
  const [shown, setShown] = useState<Errors>({})
  const iconLabelId = useId()
  const itId = useId()
  const enId = useId()

  const dirty = icon !== initialIcon || titleIt !== initialIt || titleEn !== initialEn

  function revalidate(field: keyof Errors, nextIt: string, nextEn: string) {
    if (!shown[field]) return
    setShown((current) => ({ ...current, [field]: validate(nextIt, nextEn)[field] }))
  }

  async function save(input: { icon: FAQIconName; titleIt: string; titleEn: string }) {
    try {
      if (category) {
        await editCategoryFn({ data: { id: category.categoryId, ...input } })
        return category.categoryId
      }
      const created = await addCategoryFn({ data: input })
      return created.id
    } catch (error) {
      console.error(error)
      throw new Error(category ? "Couldn't update the category." : "Couldn't add the category.")
    }
  }

  async function submit() {
    const errors = validate(titleIt, titleEn)
    setShown(errors)
    if (errors.titleIt || errors.titleEn) return
    const categoryId = await save({ icon, titleIt: titleIt.trim(), titleEn: titleEn.trim() })
    await onSaved(categoryId)
    onOpenChange(false)
    appToast.success(category ? "Category updated." : "Category added.")
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={category ? "Edit category" : "Add category"}
      noun="category"
      dirty={dirty}
      submitLabel={category ? "Save changes" : "Create category"}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-1.5">
        <span id={iconLabelId} className="text-[13px] leading-5 font-medium text-(--pn-fg)">
          Icon
        </span>
        <div role="radiogroup" aria-labelledby={iconLabelId} className="grid w-fit grid-cols-8 gap-1">
          {ICON_NAMES.map((name) => {
            const Icon = FAQ_ICONS_MAP[name]
            const selected = name === icon
            return (
              <Hint key={name} label={iconLabel(name)}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={iconLabel(name)}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setIcon(name)}
                  onKeyDown={(event) => {
                    const step = ARROW_STEPS.get(event.key)
                    if (step === undefined) return
                    event.preventDefault()
                    const index = ICON_NAMES.indexOf(name) + step
                    const next = ICON_NAMES[(index + ICON_NAMES.length) % ICON_NAMES.length]
                    if (next) setIcon(next)
                    const group = event.currentTarget.parentElement
                    requestAnimationFrame(() =>
                      group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus()
                    )
                  }}
                  className={cn(
                    "grid size-9 place-items-center rounded-(--pn-r-3) text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:bg-(--pn-muted) hover:text-(--pn-fg)",
                    selected &&
                      "bg-(--pn-accent-soft) text-(--pn-accent) ring-1 ring-(--pn-accent) ring-inset hover:bg-(--pn-accent-soft-hover) hover:text-(--pn-accent)"
                  )}
                >
                  <Icon aria-hidden strokeWidth={1.75} className="size-4" />
                </button>
              </Hint>
            )
          })}
        </div>
      </div>
      {/* One label for the pair; each language is its own panel, errors under the field. */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[13px] leading-5 font-medium text-(--pn-fg)">Title</p>
        <TranslationGroup>
          <TranslationPanel lang="it" editing>
            <InlineEditInput
              bare
              id={itId}
              label="Title (Italian)"
              value={titleIt}
              placeholder="e.g. Generali, Iscrizioni, Corsi…"
              error={shown.titleIt}
              onChange={(event) => {
                setTitleIt(event.target.value)
                revalidate("titleIt", event.target.value, titleEn)
              }}
              onBlur={() => revalidate("titleIt", titleIt, titleEn)}
            />
          </TranslationPanel>
          <TranslationPanel lang="en" editing>
            <InlineEditInput
              bare
              id={enId}
              label="Title (English)"
              value={titleEn}
              placeholder="e.g. General, Enrollment…"
              error={shown.titleEn}
              onChange={(event) => {
                setTitleEn(event.target.value)
                revalidate("titleEn", titleIt, event.target.value)
              }}
              onBlur={() => revalidate("titleEn", titleIt, titleEn)}
            />
          </TranslationPanel>
        </TranslationGroup>
      </div>
    </FormDialog>
  )
}
