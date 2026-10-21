import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"
import { type LucideIcon, TriangleAlert } from "lucide-react"
import { type ReactElement, type ReactNode, useRef, useState } from "react"

import { CustomScrollbar } from "@/components/primitives/custom-scrollbar"
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

/**
 * Centered 14px-radius panel; below 760px a bottom sheet (full width, rounded top, sliding up). A nested dialog dims
 * the panel underneath.
 */
export const dialogPanel =
  "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[14px] bg-(--pn-surface-raised) text-(--pn-fg) shadow-(--pn-shadow-modal) outline-none after:pointer-events-none after:absolute after:inset-0 after:bg-(--pn-scrim) after:opacity-0 after:transition-opacity after:duration-200 data-nested-dialog-open:after:opacity-100 max-shell:top-auto max-shell:bottom-0 max-shell:left-0 max-shell:max-h-[calc(100dvh-24px)] max-shell:w-full max-shell:max-w-none! max-shell:translate-x-0 max-shell:translate-y-0 max-shell:rounded-t-[18px] max-shell:rounded-b-none max-shell:pb-[env(safe-area-inset-bottom)] max-shell:data-open:slide-in-from-bottom-6 max-shell:data-closed:slide-out-to-bottom-6"

export const dialogFooter =
  "flex shrink-0 items-center justify-end gap-2 border-t border-(--pn-line) px-5.5 py-3.5 max-shell:[&>*]:flex-1"

export const dialogFooterButton = buttonMotion

/** Dialog title and description type, shared by `ConfirmDialog` and `FormDialog`. */
export const dialogTitleText = "text-[18px] leading-6 font-semibold tracking-[-0.01em] text-balance"
export const dialogDescriptionText = "text-[14px] leading-5 text-pretty text-(--pn-fg-muted)"

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
  /** The tile before the title; destructive confirmations default to a warning sign. */
  icon?: LucideIcon
}

/**
 * 460px confirmation (a bottom sheet below 760px): an icon tile, "{Verb} {object}?" and its consequence; focus on
 * Cancel, spinner while confirming, closes on success, inline error on failure.
 */
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
  icon,
}: ConfirmDialogProps) {
  const Icon = icon ?? (tone === "danger" ? TriangleAlert : null)
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
          className={cn(dialogPanel, dialogMotion, "max-w-[460px]")}
        >
          <CustomScrollbar className="min-h-0 flex-1" viewportClassName="flex items-start gap-3.5 px-5.5 pt-5 pb-5">
            {Icon ? (
              <span
                aria-hidden
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-(--pn-r-4) border",
                  tone === "danger"
                    ? "border-[color-mix(in_oklab,var(--pn-danger-fg)_30%,transparent)] bg-(--pn-danger-bg) text-(--pn-danger-fg)"
                    : "border-(--pn-line) bg-(--pn-muted) text-(--pn-fg)"
                )}
              >
                <Icon strokeWidth={1.75} className="size-4.5" />
              </span>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <AlertDialogTitle className={dialogTitleText}>{title}</AlertDialogTitle>
              <AlertDialogDescription className={dialogDescriptionText}>{description}</AlertDialogDescription>
              {error && <InlineAlert className="mt-3">{error}</InlineAlert>}
            </div>
          </CustomScrollbar>
          <div className={dialogFooter}>
            <AlertDialogCancel ref={cancelRef} disabled={pending} className={dialogFooterButton}>
              {cancelLabel}
            </AlertDialogCancel>
            <LoadingButton
              size="default"
              tone={tone === "danger" ? "dangerSolid" : "default"}
              pending={pending}
              onClick={confirm}
            >
              {confirmLabel}
            </LoadingButton>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPortal>
    </AlertDialog>
  )
}
