import type React from "react"
import { FiTrash2 } from "react-icons/fi"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { FaqButton } from "./faq-button"

export interface DeletePopoverProps {
  title: string
  description?: string
  onConfirm: (e: React.MouseEvent) => void
  triggerAriaLabel: string
  triggerOnClick?: (e: React.MouseEvent) => void
  confirmText?: string
}

export function DeletePopover({
  title,
  description,
  onConfirm,
  triggerAriaLabel,
  triggerOnClick,
  confirmText = "Conferma Eliminazione",
}: DeletePopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={<FaqButton icon={FiTrash2} onClick={triggerOnClick} color="destructive" ariaLabel={triggerAriaLabel} />}
      />
      <PopoverContent className="w-72 p-4" align="end">
        <PopoverHeader>
          <PopoverTitle className="text-sm font-semibold text-foreground">{title}</PopoverTitle>
        </PopoverHeader>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="destructive" onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
