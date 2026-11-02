import { Check, EllipsisVertical, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import {
  Chip,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  fieldHintId,
  IconButton,
  initialsOf,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  StatusBadge,
  type StatusTone,
} from "@/components/primitives"
import { Hint } from "@/components/primitives/hint"
import { cn } from "@/lib/utils"

import { assignmentState } from "./people-format"
import type { Assignment } from "./people.contract"

/** 32px initials avatar, name and an optional 12px secondary line; muted when the person has no roles left. */
export function PersonCell({
  name,
  secondary,
  secondaryMono = false,
  muted = false,
  suffix,
}: {
  name: string
  secondary?: string | null
  secondaryMono?: boolean
  muted?: boolean
  /** Muted text after the name, such as "(you)"; it never reaches the avatar's initials. */
  suffix?: string
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <PersonAvatar name={name} muted={muted} />
      <span className="flex min-w-0 flex-col">
        <Hint overflowOnly label={name}>
          <span className={cn("truncate font-medium", muted && "text-(--pn-fg-muted)")}>
            {name}
            {suffix ? <span className="font-normal text-(--pn-fg-muted)"> {suffix}</span> : null}
          </span>
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

/**
 * Where an assignment stands with PoliNetwork Auth. Applied ones show nothing unless `showApplied`: on a current role
 * it is the normal state.
 */
export function AssignmentBadge({
  assignment,
  showApplied = false,
}: {
  assignment: Pick<Assignment, "status" | "change">
  showApplied?: boolean
}) {
  if (assignment.status === "applied" && !showApplied) return null
  return <StateBadge state={assignmentState(assignment)} />
}

/** Auth's refusal, word for word. */
export function RefusalText({ refusal }: { refusal: string | null }) {
  if (!refusal) return null
  return <span className="text-[13px] text-(--pn-danger-fg) [overflow-wrap:anywhere]">{refusal}</span>
}

/** Identifiers (account IDs, person IDs) as a mono chip. */
export function MonoChip({ children }: { children: ReactNode }) {
  return <Chip className="font-mono tabular-nums">{children}</Chip>
}

export type MenuAction = {
  label: string
  /** Names the record for screen readers when the action stands alone ("Void receipt 2026/042"). */
  ariaLabel?: string
  icon: LucideIcon
  onClick: () => void
  /** Destructive actions go last, after a separator. */
  destructive?: boolean
}

/**
 * The secondary actions of a row or card: nothing when none apply, the action itself as an icon button when only one
 * does, otherwise a ⋮ menu with the destructive actions last. Pass `false` for an action the viewer can't take.
 */
export function ActionMenu({
  label,
  actions,
  keepSlot = false,
}: {
  /** The ⋮ button's accessible name ("More actions for Giulia Rossi"). */
  label: string
  actions: readonly (MenuAction | false)[]
  /** In tables: an empty 36px slot when no action applies, so every row's icons stay aligned (not on mobile cards). */
  keepSlot?: boolean
}) {
  const available = actions.filter((action) => action !== false)
  const regular = available.filter((action) => !action.destructive)
  const destructive = available.filter((action) => action.destructive)
  const [only] = available
  if (!only) return keepSlot ? <span aria-hidden className="size-9 shrink-0 max-shell:hidden" /> : null
  if (available.length === 1) {
    return <IconButton label={only.label} ariaLabel={only.ariaLabel} icon={only.icon} onClick={only.onClick} />
  }
  const item = (action: MenuAction) => (
    <MenuItem key={action.label} variant={action.destructive ? "destructive" : undefined} onClick={action.onClick}>
      <action.icon />
      {action.label}
    </MenuItem>
  )
  return (
    <Menu>
      <MenuTrigger render={<IconButton label="More actions" ariaLabel={label} icon={EllipsisVertical} />} />
      <MenuContent>
        {regular.map(item)}
        {regular.length && destructive.length ? <MenuSeparator /> : null}
        {destructive.map(item)}
      </MenuContent>
    </Menu>
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

/** Multi-select options as pressable pills, for team fields such as Areas or Languages. */
export function ChoiceChips<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
  labelOf = (option) => option,
}: {
  id: string
  label: string
  options: readonly T[]
  value: readonly T[]
  onChange: (value: T[]) => void
  /** The text shown for an option, when the value is an identifier. */
  labelOf?: (option: T) => string
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
            {labelOf(option)}
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
      {/* The end (badges, buttons) wraps under the text when both don't fit, so titles never break word by word. */}
      <span className="flex min-w-0 flex-1 flex-wrap items-start gap-x-3 gap-y-2">
        <span className="flex min-w-36 flex-1 basis-36 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 text-[14px] font-medium">{title}</span>
          {meta ? <span className="text-xs text-(--pn-fg-muted)">{meta}</span> : null}
          {detail ? <span className="text-[13px] text-(--pn-fg)">{detail}</span> : null}
        </span>
        {end ? <span className="ml-auto flex shrink-0 items-center gap-2">{end}</span> : null}
      </span>
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
