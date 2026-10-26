import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { type LucideIcon, TriangleAlert, X } from "lucide-react"
import { type KeyboardEvent, type ReactElement, type ReactNode, useRef, useState } from "react"

import { CustomScrollbar } from "@/components/primitives/custom-scrollbar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import {
  ConfirmDialog,
  dangerTile,
  dialogDescriptionText,
  dialogFooter,
  dialogFooterButton,
  dialogPanel,
  dialogTitleText,
  FALLBACK_ERROR,
} from "./confirm-dialog"
import { IconButton } from "./icon-button"
import { InlineAlert } from "./inline-alert"
import { LoadingButton } from "./loading-button"
import { dialogMotion, scrimClasses } from "./motion"

const sizes = {
  md: "max-w-[480px]",
  lg: "max-w-[640px]",
}

const FIELD_SELECTOR =
  "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), [data-slot=combobox-input]:not([disabled])"

type FormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  size?: keyof typeof sizes
  title: string
  description?: ReactNode
  /** Names the record in "Your edits to this {noun} will be lost." */
  noun: string
  /** Values differ from the initial ones; closing then asks to discard. */
  dirty: boolean
  /** Omit on steps without a submit (a chooser): the footer then shows Cancel only. */
  submitLabel?: string
  /** May throw; the message appears above the footer. Close the dialog yourself on success. */
  onSubmit: () => Promise<void> | void
  canSubmit?: boolean
  /**
   * Enter in a single-line input submits (default). Turn off for steps whose inputs use Enter themselves,
   * such as a lookup field; ⌘/Ctrl+Enter in textareas still submits.
   */
  submitOnEnter?: boolean
  /** Page-provided submit error, shown as a danger alert above the footer. */
  error?: ReactNode
  /** Any other alert above the footer (partial-save warning, info). */
  notice?: ReactNode
  /** Footer content on the left, e.g. a "Back" ghost button in a stepper. */
  footerStart?: ReactNode
  /** Immediate filters may replace Cancel/Submit with their clear action and count. */
  footer?: ReactNode
  trigger?: ReactElement
  /** Element to focus on close instead of the trigger, e.g. the text that now states the outcome. */
  finalFocus?: () => HTMLElement | null
  /**
   * "danger" for a form that confirms something destructive (declining a request): the confirmation's danger tile
   * before the title, `icon` in it, and a red submit.
   */
  tone?: "danger"
  icon?: LucideIcon
  children: ReactNode
}

/** Form dialog: header, scrolling body, Cancel + primary footer, keyboard submit, dirty-close confirmation. */
export function FormDialog({
  open,
  onOpenChange,
  size = "md",
  title,
  description,
  noun,
  dirty,
  submitLabel,
  onSubmit,
  canSubmit = true,
  submitOnEnter = true,
  error,
  notice,
  footerStart,
  footer,
  trigger,
  finalFocus,
  tone,
  icon: Icon = TriangleAlert,
  children,
}: FormDialogProps) {
  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLElement>(null)
  const shownError = error ?? submitError

  function requestClose() {
    if (pending) return
    if (dirty) setConfirmingDiscard(true)
    else onOpenChange(false)
  }

  async function submit() {
    if (pending || !canSubmit || submitLabel === undefined) return
    setPending(true)
    setSubmitError(null)
    try {
      await onSubmit()
    } catch (caught) {
      console.error(caught)
      setSubmitError(caught instanceof Error ? caught.message : FALLBACK_ERROR)
    } finally {
      setPending(false)
    }
  }

  function onFormKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter") return
    if (event.target instanceof HTMLTextAreaElement) {
      if (!(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      event.currentTarget.requestSubmit()
      return
    }
    // Stops the browser's implicit submission; the input's own handler still sees the key.
    if (!submitOnEnter && event.target instanceof HTMLInputElement) event.preventDefault()
  }

  function initialFocus() {
    if (!window.matchMedia("(pointer: fine)").matches) return popupRef.current
    return bodyRef.current?.querySelector<HTMLElement>(FIELD_SELECTOR) ?? true
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}
      onOpenChangeComplete={(next) => {
        if (!next) setSubmitError(null)
      }}
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogPortal>
        <DialogOverlay className={scrimClasses} />
        <DialogPrimitive.Popup
          ref={popupRef}
          initialFocus={initialFocus}
          finalFocus={finalFocus ? () => finalFocus() ?? true : undefined}
          className={cn(dialogPanel, dialogMotion, sizes[size])}
        >
          <header className="relative flex shrink-0 items-start gap-3.5 px-5.5 pt-5 pr-14">
            {tone === "danger" && (
              <span aria-hidden className={dangerTile}>
                <Icon strokeWidth={1.75} className="size-4.5" />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DialogTitle className={dialogTitleText}>{title}</DialogTitle>
              {description && <DialogDescription className={dialogDescriptionText}>{description}</DialogDescription>}
            </div>
            <IconButton label="Close" icon={X} onClick={requestClose} className="absolute top-3 right-3" />
          </header>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
            onKeyDown={onFormKeyDown}
            className="flex min-h-0 flex-1 flex-col"
          >
            <CustomScrollbar
              scrollRef={bodyRef}
              className="min-h-0 flex-1"
              viewportClassName="flex flex-col gap-4 px-5.5 py-4.5"
            >
              {children}
            </CustomScrollbar>
            {(shownError || notice) && (
              <div className="flex shrink-0 flex-col gap-2 px-5.5 pb-4">
                {notice}
                {shownError && <InlineAlert>{shownError}</InlineAlert>}
              </div>
            )}
            {footer ?? (
              <div className={dialogFooter}>
                {footerStart && <div className="mr-auto flex gap-2 max-shell:flex-none">{footerStart}</div>}
                <Button type="button" variant="outline" onClick={requestClose} className={dialogFooterButton}>
                  Cancel
                </Button>
                {submitLabel !== undefined && (
                  <LoadingButton
                    type="submit"
                    size="default"
                    tone={tone === "danger" ? "dangerSolid" : "default"}
                    pending={pending}
                    disabled={!canSubmit}
                  >
                    {submitLabel}
                  </LoadingButton>
                )}
              </div>
            )}
          </form>
          <ConfirmDialog
            open={confirmingDiscard}
            onOpenChange={setConfirmingDiscard}
            title="Discard changes?"
            description={`Your edits to this ${noun} will be lost.`}
            confirmLabel="Discard"
            cancelLabel="Keep editing"
            onConfirm={async () => onOpenChange(false)}
          />
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}
