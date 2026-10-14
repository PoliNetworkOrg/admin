import { Check, ChevronDown, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import {
  buttonMotion,
  Chip,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  initialsOf,
  Menu,
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
  fieldHintId,
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

export type PersonOption = { id: string; name: string }

/** Searchable person field for dialogs that pick one record (Add member, Add to team). */
export function PersonPicker({
  id,
  people,
  value,
  onChange,
  invalid = false,
  disabled = false,
}: {
  id: string
  people: readonly PersonOption[]
  value: PersonOption | null
  onChange: (person: PersonOption | null) => void
  invalid?: boolean
  disabled?: boolean
}) {
  return (
    <Combobox
      items={people}
      value={value}
      onValueChange={(next) => onChange(next)}
      itemToStringLabel={(item: PersonOption) => item.name}
      itemToStringValue={(item: PersonOption) => item.id}
      isItemEqualToValue={(item: PersonOption, current: PersonOption) => item.id === current.id}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        listLabel="people"
        placeholder="Search people…"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={fieldHintId(id)}
      />
      <ComboboxContent>
        <ComboboxEmpty>No people match</ComboboxEmpty>
        <ComboboxList>
          {(item: PersonOption) => (
            <ComboboxItem key={item.id} value={item}>
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="shrink-0 font-mono text-xs text-(--pn-fg-muted)">{item.id}</span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

/** One choice in a radio group of cards: a bold label and a muted line explaining it. */
export function RadioCard({
  name,
  value,
  checked,
  onSelect,
  label,
  description,
  end,
}: {
  name: string
  value: string
  checked: boolean
  onSelect: () => void
  label: ReactNode
  description?: ReactNode
  end?: ReactNode
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-(--pn-r-4) border border-(--pn-line-strong) p-3 transition-[background-color,border-color] duration-120 hover:border-(--pn-hover-line) hover:bg-(--pn-hover)",
        checked && "border-(--pn-accent) bg-(--pn-accent-soft) hover:bg-(--pn-accent-soft)"
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 size-4 shrink-0 accent-(--pn-accent-solid)"
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-medium">{label}</span>
        {description ? <span className="text-xs text-(--pn-fg-muted)">{description}</span> : null}
      </span>
      {end}
    </label>
  )
}

/** Multi-select options as pressable pills, for team fields such as Areas or Languages. */
export function ChoiceChips({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string
  label: string
  options: readonly string[]
  value: readonly string[]
  onChange: (value: string[]) => void
}) {
  return (
    <div id={id} role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const pressed = value.includes(option)
        return (
          <button
            key={option}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(pressed ? value.filter((item) => item !== option) : [...value, option])}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-(--pn-r-full) border border-(--pn-line-strong) px-3 text-[13px] font-medium text-(--pn-fg) transition-[background-color,color,border-color] duration-120 hover:bg-(--pn-hover)",
              pressed &&
                "border-[color-mix(in_oklab,var(--pn-accent)_40%,transparent)] bg-(--pn-accent-soft) text-(--pn-accent) hover:bg-(--pn-accent-soft-hover)"
            )}
          >
            {pressed ? <Check aria-hidden strokeWidth={2} className="size-3.5" /> : null}
            {option}
          </button>
        )
      })}
    </div>
  )
}

/** A chip that truncates inside a fixed-width column; the full text is its tooltip. */
export function TruncatedChip({ label }: { label: string }) {
  return (
    <Hint overflowOnly label={label}>
      <Chip className="max-w-full min-w-0 shrink">
        <span className="truncate">{label}</span>
      </Chip>
    </Hint>
  )
}

/** A divided list inside a flush card: one row per group, team, year or consent. */
export function Rows({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-(--pn-line)">{children}</ul>
}

export function Row({
  lead,
  title,
  meta,
  detail,
  end,
}: {
  lead: ReactNode
  title: ReactNode
  meta?: ReactNode
  detail?: ReactNode
  end?: ReactNode
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 shrink-0">{lead}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-[14px] font-medium">{title}</span>
        {meta ? <span className="text-xs text-(--pn-fg-muted)">{meta}</span> : null}
        {detail ? <span className="text-[13px] text-(--pn-fg)">{detail}</span> : null}
      </span>
      {end ? <span className="flex shrink-0 items-center gap-2">{end}</span> : null}
    </li>
  )
}

export function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-8 place-items-center rounded-(--pn-r-3) bg-(--pn-muted) text-(--pn-fg-muted)">
      <Icon aria-hidden strokeWidth={1.75} className="size-4" />
    </span>
  )
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <li className="px-4 pt-3 pb-1 text-xs font-medium text-(--pn-fg-muted)">{children}</li>
}
