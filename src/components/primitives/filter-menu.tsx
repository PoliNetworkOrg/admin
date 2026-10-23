import { Check, ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Toggle } from "@/components/ui/toggle"
import { cn } from "@/lib/utils"

import { Menu, MenuContent, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger } from "./menu"
import { buttonMotion } from "./motion"

/** The 40px outline look shared by toolbar filters. */
const toolbarControl =
  "h-10 shrink-0 rounded-[9px] border-(--pn-line-strong) bg-(--pn-surface) text-[14px] font-medium text-(--pn-fg)"
const activeControl = "border-[color-mix(in_oklab,var(--pn-accent)_40%,transparent)]"

export type FilterOption<T extends string> = { value: T; label: string; count?: number }

type FilterMenuProps<T extends string> = {
  label: string
  options: readonly FilterOption<T>[]
  /** Option labels in DM Mono, for identifiers such as years ("2026/27"). */
  mono?: boolean
} & (
  | {
      /** The first option, which clears the filter ("All statuses"). */
      allLabel: string
      value: T | null
      onChange: (value: T | null) => void
    }
  | { allLabel?: undefined; value: T; onChange: (value: T) => void }
)

/**
 * Single-choice toolbar filter: a 40px outline button naming the filter ("Role", or "Role: Member" once set) and a radio
 * menu. With `allLabel` it starts with that option and can be cleared; without, one option is always chosen.
 */
export function FilterMenu<T extends string>(props: FilterMenuProps<T>) {
  const { label, options, mono = false, value } = props
  const selected = options.find((option) => option.value === value)
  function choose(next: string) {
    const option = options.find((candidate) => candidate.value === next)
    if (props.allLabel !== undefined) props.onChange(option?.value ?? null)
    else if (option) props.onChange(option.value)
  }
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              buttonMotion,
              toolbarControl,
              "gap-1.5 px-3",
              selected && props.allLabel !== undefined && activeControl
            )}
          />
        }
      >
        <span>{label}</span>
        {selected ? (
          <span className={cn(props.allLabel !== undefined && "text-(--pn-accent)", mono && "font-mono")}>
            {selected.label}
          </span>
        ) : null}
        <ChevronDown aria-hidden strokeWidth={1.75} className="size-4 text-(--pn-fg-muted)" />
      </MenuTrigger>
      <MenuContent align="start" className="min-w-52">
        <MenuRadioGroup value={value ?? ""} onValueChange={choose}>
          {props.allLabel !== undefined ? (
            <>
              <MenuRadioItem value="">{props.allLabel}</MenuRadioItem>
              <MenuSeparator />
            </>
          ) : null}
          {options.map((option) => (
            <MenuRadioItem key={option.value} value={option.value}>
              <span className={cn("flex-1", mono && "font-mono")}>{option.label}</span>
              {option.count !== undefined ? (
                <span className="font-mono text-xs text-(--pn-fg-muted) tabular-nums">{option.count}</span>
              ) : null}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  )
}

/** On/off toolbar filter ("No groups", "Has licenses"), with an optional count. */
export function ToggleFilter({
  label,
  count,
  pressed,
  onPressedChange,
  className,
}: {
  label: string
  count?: number
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  className?: string
}) {
  return (
    <Toggle
      variant="outline"
      size="lg"
      pressed={pressed}
      onPressedChange={onPressedChange}
      className={cn(
        toolbarControl,
        "gap-2 px-3.5 transition-[background-color,color,border-color] duration-120 hover:bg-(--pn-hover) aria-pressed:border-[color-mix(in_oklab,var(--pn-accent)_40%,transparent)] aria-pressed:bg-(--pn-accent-soft) aria-pressed:text-(--pn-accent) aria-pressed:hover:bg-(--pn-accent-soft-hover)",
        className
      )}
    >
      {pressed ? <Check aria-hidden strokeWidth={2} className="size-4" /> : null}
      {label}
      {count !== undefined ? (
        <span className="font-mono text-xs font-normal text-(--pn-fg-muted) tabular-nums">{count}</span>
      ) : null}
    </Toggle>
  )
}
