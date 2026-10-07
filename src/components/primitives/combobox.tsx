import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { ChevronDown } from "lucide-react"
import type * as React from "react"

import {
  Combobox,
  ComboboxContent as UiComboboxContent,
  ComboboxEmpty as UiComboboxEmpty,
  ComboboxItem as UiComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

import { fieldControl } from "./form-field"
import { floatingMotion, raisedSurface } from "./motion"

type ComboboxInputProps = ComboboxPrimitive.Input.Props & {
  /** What the list holds, plural ("roles", "groups"): the trigger reads "Show {listLabel}". */
  listLabel: string
}

/** §5.8 combobox input: 36px field with a chevron trigger named after the list. */
export function ComboboxInput({ listLabel, disabled = false, className, ...props }: ComboboxInputProps) {
  return (
    <InputGroup className={cn("h-9 w-full rounded-(--pn-r-3)", fieldControl, className)}>
      <ComboboxPrimitive.Input render={<InputGroupInput disabled={disabled} />} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-sm"
          variant="ghost"
          render={<ComboboxPrimitive.Trigger />}
          disabled={disabled}
          aria-label={`Show ${listLabel}`}
          className="data-pressed:bg-transparent"
        >
          <ChevronDown aria-hidden className="pointer-events-none size-4 text-(--pn-fg-muted)" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

/** Raised list surface, 160/120ms from the input. */
export function ComboboxContent({ className, ...props }: React.ComponentProps<typeof UiComboboxContent>) {
  return <UiComboboxContent className={cn(raisedSurface, floatingMotion, "rounded-(--pn-r-4)", className)} {...props} />
}

/** 36px, 13px item highlighted on `--pn-muted`; selected check on the right. */
export function ComboboxItem({ className, ...props }: React.ComponentProps<typeof UiComboboxItem>) {
  return (
    <UiComboboxItem
      className={cn(
        "min-h-9 rounded-(--pn-r-2) text-[13px] text-(--pn-fg) data-highlighted:bg-(--pn-muted) data-highlighted:text-(--pn-fg)",
        className
      )}
      {...props}
    />
  )
}

/** "No {things} match" row. */
export function ComboboxEmpty({ className, ...props }: React.ComponentProps<typeof UiComboboxEmpty>) {
  return <UiComboboxEmpty className={cn("py-3 text-[13px] text-(--pn-fg-muted) empty:hidden", className)} {...props} />
}

export { Combobox, ComboboxList }
