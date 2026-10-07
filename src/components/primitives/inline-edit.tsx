import { Check, CircleAlert, Pencil, X } from "lucide-react"
import type * as React from "react"
import { type KeyboardEvent, type ReactNode, useId } from "react"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { RowActions } from "./data-table"
import { FieldCounter, isCounterVisible } from "./field-counter"
import { IconButton } from "./icon-button"
import { InlineAlert } from "./inline-alert"
import { useModifierKey } from "./use-modifier-key"

type InlineEditProps = {
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  dirty: boolean
  valid: boolean
  saving: boolean
  /** Save failure; shown as an alert in the footer's left slot. */
  error?: ReactNode
  /** Validation message for the footer's left slot. */
  message?: ReactNode
  view: ReactNode
  /**
   * Cards: the view's top row (logo + title). The actions sit beside it and `view` spans the full card width below,
   * so view and edit bodies are equally wide. Without it the actions take a column next to the whole view.
   */
  viewHeader?: ReactNode
  edit: ReactNode
  /** Trailing view-mode actions (e.g. a `⋮` menu). */
  actions?: ReactNode
  /** Destructive view-mode action after Edit and before trailing actions. */
  deleteAction?: ReactNode
  /** Tooltip of the edit button ("Edit project"); also its accessible label unless `editAriaLabel` is set. */
  editLabel?: string
  /** Accessible label naming the record, e.g. "Edit PoliNetwork". */
  editAriaLabel?: string
  /** Drag handle for sortable cards, positioned by the caller against the card (`relative`). */
  handle?: ReactNode
  /** Viewers without write access: only `view` renders; no edit, delete, `actions` or `handle`. */
  readOnly?: boolean
  className?: string
}

function useEditKeys({ editing, readOnly, saving, valid, dirty, onCancel, onSave }: InlineEditProps) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (!editing || readOnly || !(event.target instanceof Node) || !event.currentTarget.contains(event.target)) return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    if (event.key === "Escape") {
      event.preventDefault()
      if (!saving) onCancel()
      return
    }
    if (event.key !== "Enter") return
    const inTextarea = event.target instanceof HTMLTextAreaElement
    const inInput = event.target instanceof HTMLInputElement
    if (!(inInput || (inTextarea && (event.metaKey || event.ctrlKey)))) return
    event.preventDefault()
    if (valid && dirty && !saving) onSave()
  }
}

function EditFooter({ onCancel, onSave, dirty, valid, saving, error, message }: InlineEditProps) {
  const modifier = useModifierKey()
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        {error ? (
          <InlineAlert className="py-2">{error}</InlineAlert>
        ) : message ? (
          <p role="alert" className="flex items-center gap-1.5 pt-2 text-xs text-(--pn-danger-fg)">
            <CircleAlert aria-hidden className="size-3.5 shrink-0" />
            {message}
          </p>
        ) : (
          <p className="flex min-h-9 flex-wrap items-center gap-1 text-xs text-(--pn-fg-muted) pointer-coarse:hidden">
            Press <Kbd>{modifier} + Enter</Kbd> to save, <Kbd>Esc</Kbd> to cancel
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <IconButton
          label="Cancel (Esc)"
          ariaLabel="Cancel"
          icon={X}
          tone="danger"
          appearance="tinted"
          disabled={saving}
          onClick={onCancel}
        />
        <IconButton
          label={`Save (${modifier} + Enter)`}
          ariaLabel="Save"
          icon={Check}
          tone="success"
          appearance="tinted"
          pending={saving}
          disabled={!valid || !dirty}
          focusableWhenDisabled
          onClick={onSave}
        />
      </div>
    </div>
  )
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-(--pn-r-1) border border-(--pn-line) bg-(--pn-muted) px-1 font-sans text-[11px] leading-4 text-(--pn-fg)">
      {children}
    </kbd>
  )
}

function ViewActions({ onEdit, actions, deleteAction, editLabel = "Edit", editAriaLabel }: InlineEditProps) {
  return (
    <RowActions className="shrink-0">
      <IconButton label={editLabel} ariaLabel={editAriaLabel} icon={Pencil} onClick={onEdit} />
      {deleteAction}
      {actions}
    </RowActions>
  )
}

/** Card that swaps text for same-line-box fields in place; the card keeps its width and position. */
export function InlineEditCard(props: InlineEditProps) {
  const onKeyDown = useEditKeys(props)
  const editing = props.editing && !props.readOnly
  return (
    <article
      onKeyDown={onKeyDown}
      className={cn(
        "flex flex-col gap-3 rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface) p-4 text-(--pn-fg)",
        props.className
      )}
    >
      {props.handle && (
        <span className="contents" hidden={props.readOnly || props.editing}>
          {props.handle}
        </span>
      )}
      {/* The body grows with a stretched grid cell, so a view's last block can sit at the bottom with `mt-auto`. */}
      {props.viewHeader && !editing ? (
        <>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">{props.viewHeader}</div>
            {!props.readOnly && <ViewActions {...props} />}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3">{props.view}</div>
        </>
      ) : (
        <div className="flex flex-1 items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-3 self-stretch">{editing ? props.edit : props.view}</div>
          {!editing && !props.readOnly && <ViewActions {...props} />}
        </div>
      )}
      {editing && <EditFooter {...props} />}
    </article>
  )
}

/** 44px list row variant of `InlineEditCard` (labels tree, FAQ items). */
export function InlineEditRow(props: InlineEditProps) {
  const onKeyDown = useEditKeys(props)
  if (!props.editing || props.readOnly) {
    return (
      <div onKeyDown={onKeyDown} className={cn("flex min-h-11 items-center gap-3 px-4", props.className)}>
        {!props.readOnly && props.handle}
        <div className="flex min-w-0 flex-1 items-center gap-3">{props.view}</div>
        {!props.readOnly && <ViewActions {...props} />}
      </div>
    )
  }
  return (
    <div onKeyDown={onKeyDown} className={cn("flex flex-col gap-3 px-4 py-2", props.className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-3">{props.edit}</div>
      <EditFooter {...props} />
    </div>
  )
}

const fieldClasses =
  "border-(--pn-line-strong) bg-(--pn-surface) text-sm leading-5 text-(--pn-fg) shadow-none placeholder:text-(--pn-fg-subtle) aria-invalid:border-(--pn-danger-solid) pointer-coarse:text-base dark:bg-(--pn-surface)"

/** §5.10 error line under an inline field: 12px danger text with a 14px icon. */
function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-center gap-1.5 text-xs text-(--pn-danger-fg)">
      <CircleAlert aria-hidden className="size-3.5 shrink-0" />
      {children}
    </p>
  )
}

type InlineEditInputProps = Omit<React.ComponentProps<"input">, "value"> & {
  label: string
  value: string
  /** Field error shown under the input; also sets `aria-invalid` and `aria-describedby`. */
  error?: string | null
}

/** 36px input: a 20px line box + 16px padding. Shows the counter in the last 20% of `maxLength`. */
export function InlineEditInput({ label, value, maxLength, error, className, ...props }: InlineEditInputProps) {
  const errorId = useId()
  const counting = maxLength !== undefined && isCounterVisible(value.length, maxLength)
  return (
    <div className="min-w-0 flex-1">
      <div className="relative">
        <Input
          aria-label={label}
          value={value}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn("h-9 px-2.5", fieldClasses, counting && "pr-20", className)}
          {...props}
        />
        {maxLength !== undefined && (
          <FieldCounter length={value.length} max={maxLength} className="absolute top-1/2 right-2.5 -translate-y-1/2" />
        )}
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}

type InlineEditTextareaProps = Omit<React.ComponentProps<"textarea">, "value"> & {
  label: string
  value: string
  /** Field error shown under the textarea; also sets `aria-invalid` and `aria-describedby`. */
  error?: string | null
  /**
   * No box of its own: the surrounding edit-mode `TranslationPanel` is the field, and the text sits exactly where
   * the read-only text sat (13/20, no padding, one line minimum).
   */
  bare?: boolean
}

const bareTextareaClasses =
  "min-h-5 resize-none rounded-none border-0 bg-transparent p-0 text-[13px] leading-5 text-(--pn-fg) shadow-none placeholder:text-(--pn-fg-subtle) focus-visible:border-0 focus-visible:ring-0 aria-invalid:ring-0 pointer-coarse:text-base md:text-[13px] dark:bg-transparent"

/** Auto-growing textarea, three rows minimum (`bare`: one line, inside a `TranslationPanel`). */
export function InlineEditTextarea({
  label,
  value,
  maxLength,
  error,
  bare = false,
  className,
  ...props
}: InlineEditTextareaProps) {
  const errorId = useId()
  if (bare) {
    return (
      <div className="flex min-w-0 flex-col">
        <Textarea
          aria-label={label}
          value={value}
          maxLength={maxLength}
          rows={1}
          // The panel's border shows focus; the global input focus ring would draw a box inside it.
          data-focus-ring="none"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(bareTextareaClasses, className)}
          {...props}
        />
        {maxLength !== undefined && <FieldCounter length={value.length} max={maxLength} className="mt-1 self-end" />}
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </div>
    )
  }
  return (
    <div className="min-w-0 flex-1">
      <div className="relative">
        <Textarea
          aria-label={label}
          value={value}
          maxLength={maxLength}
          rows={3}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn("min-h-[76px] px-2.5 pb-6", fieldClasses, className)}
          {...props}
        />
        {maxLength !== undefined && (
          <FieldCounter length={value.length} max={maxLength} className="absolute right-2.5 bottom-1.5" />
        )}
      </div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}
