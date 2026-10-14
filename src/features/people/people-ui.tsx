import { Check, ChevronDown } from "lucide-react"
import type { ReactNode } from "react"

import {
  buttonMotion,
  Chip,
  initialsOf,
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  floatingMotion,
  raisedSurface,
  StatusBadge,
  type StatusTone,
} from "@/components/primitives"
import { Hint } from "@/components/primitives/hint"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"
import { cn } from "@/lib/utils"

/** 32px initials avatar, name and an optional 12px secondary line; muted when the person has no roles left. */
export function PersonCell({
  name,
  secondary,
  secondaryMono = false,
  muted = false,
}: {
  name: string
  secondary?: string | null
  secondaryMono?: boolean
  muted?: boolean
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <PersonAvatar name={name} muted={muted} />
      <span className="flex min-w-0 flex-col">
        <Hint overflowOnly label={name}>
          <span className={cn("truncate font-medium", muted && "text-(--pn-fg-muted)")}>{name}</span>
        </Hint>
        {secondary ? (
          <Hint overflowOnly label={secondary}>
            <span
              className={cn("truncate text-xs text-(--pn-fg-muted)", secondaryMono && "font-mono tracking-[-0.01em]")}
            >
              {secondary}
            </span>
          </Hint>
        ) : null}
      </span>
    </span>
  )
}

const avatarSizes = {
  24: "size-6 text-[10px]",
  32: "size-8 text-[11px]",
  40: "size-10 text-[13px]",
  64: "size-16 text-xl",
}

export function PersonAvatar({
  name,
  size = 32,
  muted = false,
}: {
  name: string
  size?: keyof typeof avatarSizes
  muted?: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-(--pn-line-strong) bg-(--pn-muted) font-semibold text-(--pn-fg-muted)",
        avatarSizes[size],
        muted && "opacity-60"
      )}
    >
      {initialsOf(name)}
    </span>
  )
}

/** A state badge from a `{ label, tone }` table entry. */
export function StateBadge({ state }: { state: { label: string; tone: StatusTone } }) {
  return <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
}

/** Identifiers (member numbers, person IDs) as a mono chip. */
export function MonoChip({ children }: { children: ReactNode }) {
  return <Chip className="font-mono tabular-nums">{children}</Chip>
}

export type FilterOption<T extends string> = { value: T; label: string; count?: number }

/**
 * Single-choice filter: a 40px outline button naming the filter ("Role", or "Role: Member" once set) and a radio menu
 * with "All …" first.
 */
export function FilterMenu<T extends string>({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string
  allLabel: string
  options: readonly FilterOption<T>[]
  value: T | null
  onChange: (value: T | null) => void
}) {
  const selected = options.find((option) => option.value === value)
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              buttonMotion,
              "h-10 shrink-0 gap-1.5 rounded-[9px] border-(--pn-line-strong) bg-(--pn-surface) px-3 text-[14px] font-medium",
              selected && "border-[color-mix(in_oklab,var(--pn-accent)_40%,transparent)]"
            )}
          />
        }
      >
        <span>{label}</span>
        {selected ? <span className="text-(--pn-accent)">{selected.label}</span> : null}
        <ChevronDown aria-hidden strokeWidth={1.75} className="size-4 text-(--pn-fg-muted)" />
      </MenuTrigger>
      <MenuContent align="start" className="min-w-52">
        <MenuRadioGroup
          value={value ?? ""}
          onValueChange={(next: string) => onChange(options.find((option) => option.value === next)?.value ?? null)}
        >
          <MenuRadioItem value="">{allLabel}</MenuRadioItem>
          <MenuSeparator />
          {options.map((option) => (
            <MenuRadioItem key={option.value} value={option.value}>
              <span className="flex-1">{option.label}</span>
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

/** On/off filter in the toolbar ("No groups"), with its count. */
export function ToggleFilter({
  label,
  count,
  pressed,
  onPressedChange,
}: {
  label: string
  count?: number
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
}) {
  return (
    <Toggle
      variant="outline"
      size="lg"
      pressed={pressed}
      onPressedChange={onPressedChange}
      className="h-10 shrink-0 gap-2 rounded-[9px] border-(--pn-line-strong) bg-(--pn-surface) px-3.5 text-[14px] font-medium text-(--pn-fg) transition-[background-color,color,border-color] duration-120 hover:bg-(--pn-hover) aria-pressed:border-[color-mix(in_oklab,var(--pn-accent)_40%,transparent)] aria-pressed:bg-(--pn-accent-soft) aria-pressed:text-(--pn-accent) aria-pressed:hover:bg-(--pn-accent-soft-hover)"
    >
      {pressed ? <Check aria-hidden strokeWidth={2} className="size-4" /> : null}
      {label}
      {count !== undefined ? (
        <span className="font-mono text-xs font-normal text-(--pn-fg-muted) tabular-nums">{count}</span>
      ) : null}
    </Toggle>
  )
}

/** A form select over a list of labels, full width, styled like the inputs around it. */
export function SelectField<T extends string>({
  id,
  value,
  options,
  onChange,
  placeholder,
  invalid = false,
}: {
  id: string
  value: T | null
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  placeholder?: string
  invalid?: boolean
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const option = options.find((candidate) => candidate.value === next)
        if (option) onChange(option.value)
      }}
      items={options}
    >
      <SelectTrigger
        id={id}
        aria-invalid={invalid || undefined}
        className="h-9 w-full border-(--pn-line-strong) bg-(--pn-surface) text-sm text-(--pn-fg) shadow-none aria-invalid:border-(--pn-danger-solid) pointer-coarse:text-base dark:bg-(--pn-surface)"
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={cn(raisedSurface, floatingMotion)}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="h-9 text-[13px] focus:bg-(--pn-hover) focus:text-(--pn-fg) not-data-[variant=destructive]:focus:**:text-(--pn-fg)"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
