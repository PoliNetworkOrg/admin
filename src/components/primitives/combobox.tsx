import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete"
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

/**
 * Combobox input: 36px field with a chevron trigger named after the list. The field draws the input's focus ring and
 * anchors the list; the chevron is out of the Tab order, since the arrow keys open the list too.
 */
export function ComboboxInput({ listLabel, disabled = false, className, ...props }: ComboboxInputProps) {
  return (
    <ComboboxPrimitive.InputGroup
      render={
        <InputGroup
          className={cn(
            "h-9 w-full rounded-(--pn-r-3) has-[[data-slot=input-group-control]:focus-visible]:ring-(--pn-focus)/25",
            fieldControl,
            className
          )}
        />
      }
    >
      <ComboboxPrimitive.Input render={<InputGroupInput disabled={disabled} data-focus-ring="none" />} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-sm"
          variant="ghost"
          render={<ComboboxPrimitive.Trigger />}
          disabled={disabled}
          tabIndex={-1}
          aria-label={`Show ${listLabel}`}
          className="data-pressed:bg-transparent"
        >
          <ChevronDown aria-hidden className="pointer-events-none size-4 text-(--pn-fg-muted)" />
        </InputGroupButton>
      </InputGroupAddon>
    </ComboboxPrimitive.InputGroup>
  )
}

/** Raised list surface, 160/120ms from the input. */
export function ComboboxContent({ className, ...props }: React.ComponentProps<typeof UiComboboxContent>) {
  return <UiComboboxContent className={cn(raisedSurface, floatingMotion, "rounded-(--pn-r-4)", className)} {...props} />
}

/** 36px, 13px item highlighted on `--pn-hover` (pointer or arrow keys); selected check on the right. */
export function ComboboxItem({ className, ...props }: React.ComponentProps<typeof UiComboboxItem>) {
  return (
    <UiComboboxItem
      className={cn(
        "min-h-9 rounded-(--pn-r-2) text-[13px] text-(--pn-fg) data-highlighted:bg-(--pn-hover) data-highlighted:text-(--pn-fg)",
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

/**
 * `Combobox` picks one of a fixed set of items; `Autocomplete` is free text with suggestions. Both take the same
 * input, content, list, item and empty parts.
 */
const Autocomplete = AutocompletePrimitive.Root

export { Autocomplete, Combobox, ComboboxList }
