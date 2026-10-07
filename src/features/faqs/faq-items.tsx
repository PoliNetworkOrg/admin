import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { ChevronDown, Pencil, Trash2 } from "lucide-react"
import { type KeyboardEvent, type RefObject, useEffect, useRef, useState } from "react"

import {
  Chip,
  IconButton,
  InlineEditInput,
  InlineEditRow,
  InlineEditTextarea,
  RowActions,
  TranslationGroup,
  TranslationPanel,
  TranslationText,
  Unset,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { AccordionItem } from "@/components/ui/accordion"
import type { FAQItem } from "@/lib/api/types"
import { cn } from "@/lib/utils"

export type FaqInput = Omit<FAQItem, "faqId">

export const EMPTY_FAQ: FaqInput = { titleIt: "", titleEn: "", descriptionIt: "", descriptionEn: "" }

type FaqField = keyof FaqInput

const FIELDS: Array<{ field: FaqField; label: string; required: string }> = [
  { field: "titleIt", label: "Question (Italian)", required: "Question (Italian) is required." },
  { field: "titleEn", label: "Question (English)", required: "Question (English) is required." },
  { field: "descriptionIt", label: "Answer (Italian)", required: "Answer (Italian) is required." },
  { field: "descriptionEn", label: "Answer (English)", required: "Answer (English) is required." },
]

export function toFaqInput(faq: FAQItem): FaqInput {
  return {
    titleIt: faq.titleIt,
    titleEn: faq.titleEn,
    descriptionIt: faq.descriptionIt,
    descriptionEn: faq.descriptionEn,
  }
}

function LanguageLine({ lang, children, muted }: { lang: "IT" | "EN"; children: string; muted?: boolean }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Chip size="tiny" className={cn("w-[26px] justify-center", muted && "text-(--pn-fg-muted)")}>
        {lang}
      </Chip>
      <span
        title={children}
        className={cn("truncate text-[13px] leading-5", muted ? "text-(--pn-fg-muted)" : "font-medium text-(--pn-fg)")}
      >
        {children}
      </span>
    </span>
  )
}

type FaqRowProps = {
  faq: FAQItem
  canWrite: boolean
  onEdit: () => void
  onDelete: (trigger: HTMLElement) => void
}

/** One accordion item in view mode: IT/EN questions, chevron, edit and delete. */
export function FaqRow({ faq, canWrite, onEdit, onDelete }: FaqRowProps) {
  return (
    // Hovering the header (the clickable part) tints the whole item, so an open item's answers are not left out.
    <AccordionItem
      value={faq.faqId}
      className="border-(--pn-line) transition-[background-color] duration-120 pointer-fine:has-[>h3:hover]:bg-(--pn-muted)"
    >
      <AccordionPrimitive.Header className="flex min-h-12 items-center gap-3 pr-3 pl-5">
        <AccordionPrimitive.Trigger className="group/trigger flex min-w-0 flex-1 items-center gap-3 self-stretch py-2 text-left outline-offset-[-2px]">
          <span className="flex min-w-0 flex-1 flex-col">
            <LanguageLine lang="IT">{faq.titleIt}</LanguageLine>
            {faq.titleEn && (
              <LanguageLine lang="EN" muted>
                {faq.titleEn}
              </LanguageLine>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-(--pn-fg-muted) transition-transform duration-150 ease-(--pn-ease-out) group-data-panel-open/trigger:rotate-180"
          />
        </AccordionPrimitive.Trigger>
        {canWrite && (
          <RowActions>
            <IconButton label="Edit FAQ" ariaLabel={`Edit ${faq.titleIt}`} icon={Pencil} onClick={onEdit} />
            <IconButton
              label="Delete FAQ"
              ariaLabel={`Delete ${faq.titleIt}`}
              icon={Trash2}
              tone="danger"
              onClick={(event) => onDelete(event.currentTarget)}
            />
          </RowActions>
        )}
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Panel className="grid grid-rows-[1fr] opacity-100 transition-[grid-template-rows,opacity] ease-(--pn-ease-move) [transition-duration:200ms,150ms] data-ending-style:grid-rows-[0fr] data-ending-style:opacity-0 data-starting-style:grid-rows-[0fr] data-starting-style:opacity-0">
        <div className="min-h-0 overflow-hidden">
          <div className="px-5 pt-1 pb-4">
            {/* A card-colored border keeps the panels distinct when the hovered item takes their background. */}
            <TranslationGroup>
              <TranslationPanel lang="it" className="border-(--pn-line)">
                <TranslationText>{faq.descriptionIt}</TranslationText>
              </TranslationPanel>
              <TranslationPanel lang="en" className="border-(--pn-line)">
                <TranslationText>{faq.descriptionEn || <Unset />}</TranslationText>
              </TranslationPanel>
            </TranslationGroup>
          </div>
        </div>
      </AccordionPrimitive.Panel>
    </AccordionItem>
  )
}

type EditableFaqProps = {
  faqId: number
  initial: FaqInput
  /** Mirrors whether the fields differ from `initial`, for the page's edit slot. */
  dirtyRef: RefObject<boolean>
  onCancel: () => void
  /** Throws to show its message in the footer. */
  onSave: (input: FaqInput) => Promise<void>
}

/** One accordion item in edit mode (§5.9): both questions and both answers, validated under each field. */
export function EditableFaq({ faqId, initial, dirtyRef, onCancel, onSave }: EditableFaqProps) {
  const [values, setValues] = useState(initial)
  const [touched, setTouched] = useState<Set<FaqField>>(() => new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstField = useRef<HTMLInputElement>(null)

  const dirty = FIELDS.some(({ field }) => values[field] !== initial[field])
  const valid = FIELDS.every(({ field }) => values[field].trim() !== "")

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty, dirtyRef])

  useEffect(() => {
    firstField.current?.focus()
    firstField.current?.scrollIntoView({ block: "nearest" })
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave({
        titleIt: values.titleIt.trim(),
        titleEn: values.titleEn.trim(),
        descriptionIt: values.descriptionIt.trim(),
        descriptionEn: values.descriptionEn.trim(),
      })
      appToast.success("FAQ saved.")
    } catch (caught) {
      console.error(caught)
      setError(caught instanceof Error ? caught.message : "Couldn't save the FAQ.")
    } finally {
      setSaving(false)
    }
  }

  /** Enter on an invalid form reveals every message instead of doing nothing. */
  function revealErrors(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" || valid) return
    const inTextarea = event.target instanceof HTMLTextAreaElement
    if (inTextarea && !(event.metaKey || event.ctrlKey)) return
    setTouched(new Set(FIELDS.map(({ field }) => field)))
  }

  function fieldProps(field: FaqField, label: string, required: string) {
    return {
      label,
      value: values[field],
      // The panel header names the language; the accessible label keeps it.
      placeholder: `${label.replace(/ \(.+\)$/, "")}…`,
      error: touched.has(field) && values[field].trim() === "" ? required : null,
      disabled: saving,
      onChange: (event: { target: { value: string } }) =>
        setValues((current) => ({ ...current, [field]: event.target.value })),
      onBlur: () => setTouched((current) => new Set(current).add(field)),
    }
  }

  const [questionIt, questionEn, answerIt, answerEn] = FIELDS.map(({ field, label, required }) =>
    fieldProps(field, label, required)
  )

  return (
    <AccordionItem value={faqId} className="border-(--pn-line) bg-(--pn-surface)">
      <InlineEditRow
        editing
        onEdit={() => undefined}
        onCancel={onCancel}
        onSave={() => void save()}
        dirty={dirty}
        valid={valid}
        saving={saving}
        error={error}
        view={null}
        edit={
          // One panel per language: its question, a hairline, its answer (§5.14).
          <div onKeyDown={revealErrors} className="w-full pt-1">
            <TranslationGroup>
              {questionIt && answerIt && (
                <TranslationPanel lang="it" editing>
                  <InlineEditInput bare ref={firstField} {...questionIt} className="font-medium" />
                  <div aria-hidden className="border-t border-(--pn-line)" />
                  <InlineEditTextarea bare {...answerIt} />
                </TranslationPanel>
              )}
              {questionEn && answerEn && (
                <TranslationPanel lang="en" editing>
                  <InlineEditInput bare {...questionEn} className="font-medium" />
                  <div aria-hidden className="border-t border-(--pn-line)" />
                  <InlineEditTextarea bare {...answerEn} />
                </TranslationPanel>
              )}
            </TranslationGroup>
          </div>
        }
        className="px-5 py-3"
      />
    </AccordionItem>
  )
}
