import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { type ReactElement, type ReactNode, useRef, useState } from "react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"

import { InlineAlert } from "./inline-alert"
import { LoadingButton } from "./loading-button"
import { buttonMotion, dialogMotion, scrimClasses } from "./motion"

export const dialogPanel =
  "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-(--pn-r-5) bg-(--pn-surface-raised) text-(--pn-fg) shadow-(--pn-shadow-modal) outline-none after:pointer-events-none after:absolute after:inset-0 after:bg-(--pn-scrim) after:opacity-0 after:transition-opacity after:duration-200 data-nested-dialog-open:after:opacity-100"

export const dialogFooter =
  "flex shrink-0 flex-col-reverse gap-2 border-t border-(--pn-line) px-5 py-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-end"

export const dialogFooterButton = cn(buttonMotion, "w-full min-[480px]:w-auto")

export const FALLBACK_ERROR = "Something went wrong. Try again."

type ConfirmDialogProps = {
  /** Omit with `trigger` to let the dialog manage its own open state. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** "{Verb} {object}?" */
  title: string
  /** One sentence stating the consequence. */
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  tone?: "danger" | "primary"
  /** May throw; the message is shown inside the dialog and it stays open. */
  onConfirm: () => Promise<void>
  trigger?: ReactElement
  /** Element to focus on close, e.g. `useFocusAfterRemoval().target` when confirming removes the trigger's row. */
  finalFocus?: () => HTMLElement | null
}

/** 400px confirmation: focus on Cancel, spinner while confirming, closes on success, inline error on failure. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  trigger,
  finalFocus,
}: ConfirmDialogProps) {
  const [ownOpen, setOwnOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const isOpen = open ?? ownOpen

  function commitOpen(next: boolean) {
    setOwnOpen(next)
    onOpenChange?.(next)
  }

  async function confirm() {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      commitOpen(false)
    } catch (caught) {
      console.error(caught)
      setError(caught instanceof Error ? caught.message : FALLBACK_ERROR)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!pending) commitOpen(next)
      }}
      onOpenChangeComplete={(next) => {
        if (!next) setError(null)
      }}
    >
      {trigger && <AlertDialogTrigger render={trigger} />}
      <AlertDialogPortal>
        <AlertDialogOverlay className={scrimClasses} />
        <AlertDialogPrimitive.Popup
          initialFocus={cancelRef}
          finalFocus={finalFocus ? () => finalFocus() ?? true : undefined}
          className={cn(dialogPanel, dialogMotion, "max-w-[400px]")}
        >
          <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto p-5">
            <AlertDialogTitle className="text-[15px] leading-[22px] font-semibold tracking-[-0.005em] text-balance">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-5 text-pretty text-(--pn-fg-muted)">
              {description}
            </AlertDialogDescription>
            {error && <InlineAlert className="mt-3">{error}</InlineAlert>}
          </div>
          <div className={dialogFooter}>
            <AlertDialogCancel ref={cancelRef} disabled={pending} className={dialogFooterButton}>
              {cancelLabel}
            </AlertDialogCancel>
            <LoadingButton
              size="default"
              tone={tone === "danger" ? "dangerSolid" : "default"}
              pending={pending}
              onClick={confirm}
              className="w-full min-[480px]:w-auto"
            >
              {confirmLabel}
            </LoadingButton>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPortal>
    </AlertDialog>
  )
}
