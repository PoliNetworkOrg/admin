import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { Check, EllipsisVertical, type LucideIcon, X } from "lucide-react"
import { type ReactNode, useState } from "react"

import {
  Autocomplete,
  Chip,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  fieldControl,
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
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { assignmentState, courseDetail } from "./people-format"
import { type Assignment, type Course, SCHOOLS } from "./people.contract"

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

/** Matches a course by name, code or school, ignoring case. */
function courseMatches(course: Course, query: string) {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  return `${course.name} ${course.code} ${SCHOOLS[course.school].short}`.toLocaleLowerCase().includes(needle)
}

/**
 * Searchable course field: each option shows its level, school and code, since two versions of a degree can share a
 * name. Emptying the field clears the course. A course no longer offered says so.
 */
export function CoursePicker({
  id,
  courses,
  value,
  onChange,
  placeholder = "Search courses…",
  invalid = false,
  disabled = false,
}: {
  id: string
  courses: readonly Course[]
  value: Course | null
  onChange: (course: Course | null) => void
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
}) {
  return (
    <Combobox
      items={courses}
      value={value}
      onValueChange={(next) => onChange(next)}
      itemToStringLabel={(item: Course) => item.name}
      itemToStringValue={(item: Course) => String(item.code)}
      isItemEqualToValue={(item: Course, current: Course) => item.code === current.code}
      filter={(item: Course, query: string) => courseMatches(item, query)}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        listLabel="courses"
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={fieldHintId(id)}
      />
      <ComboboxContent>
        <ComboboxEmpty>No courses match</ComboboxEmpty>
        <ComboboxList>
          {(item: Course) => (
            <ComboboxItem key={item.code} value={item} className="py-1.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{item.name}</span>
                <span className="text-xs text-(--pn-fg-muted)">
                  {courseDetail(item)}
                  {item.active ? "" : " · No longer offered"}
                </span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

/**
 * Free-text names as removable chips, with suggestions so spellings stay the same across records. Enter adds what is
 * typed, or the highlighted suggestion; a name already in the list (in any case) isn't added twice, and a suggestion's
 * spelling wins over the typed one.
 */
export function TagInput({
  id,
  label,
  value,
  onChange,
  suggestions = [],
  max,
  maxLength,
  placeholder,
  invalid = false,
}: {
  id: string
  /** Names the list for screen readers ("Other associations"). */
  label: string
  value: readonly string[]
  onChange: (value: string[]) => void
  suggestions?: readonly string[]
  max: number
  maxLength: number
  placeholder?: string
  invalid?: boolean
}) {
  const [draft, setDraft] = useState("")
  const [highlighted, setHighlighted] = useState(false)
  const taken = new Set(value.map((name) => name.toLocaleLowerCase()))
  const needle = draft.trim().toLocaleLowerCase()
  const items = suggestions
    .filter((name) => !taken.has(name.toLocaleLowerCase()) && name.toLocaleLowerCase().includes(needle))
    .slice(0, 20)
  const full = value.length >= max

  function add(name: string) {
    const trimmed = name.trim()
    setDraft("")
    if (!trimmed || full) return
    const known = suggestions.find((candidate) => candidate.toLocaleLowerCase() === trimmed.toLocaleLowerCase())
    const next = known ?? trimmed
    if (!taken.has(next.toLocaleLowerCase())) onChange([...value, next])
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length ? (
        <ul aria-label={label} className="flex flex-wrap gap-1.5">
          {value.map((name) => (
            <li key={name} className="max-w-full min-w-0">
              <Chip className="h-7 max-w-full gap-0.5 pr-0.5 text-[13px]">
                <span className="truncate">{name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => onChange(value.filter((item) => item !== name))}
                  className="grid size-6 shrink-0 place-items-center rounded-full text-(--pn-fg-muted) hover:bg-(--pn-hover) hover:text-(--pn-fg)"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              </Chip>
            </li>
          ))}
        </ul>
      ) : null}
      <Autocomplete
        items={items}
        mode="none"
        value={draft}
        onValueChange={(next, { reason }) => {
          if (reason === "item-press") add(next)
          else setDraft(next)
        }}
        onItemHighlighted={(item) => setHighlighted(item !== undefined)}
        openOnInputClick
      >
        <ComboboxPrimitive.Input
          render={<Input className={cn(fieldControl, "h-9")} />}
          id={id}
          disabled={full}
          placeholder={full ? `At most ${max}` : placeholder}
          maxLength={maxLength}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          aria-describedby={fieldHintId(id)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
            // Enter adds the typed name instead of submitting the dialog; a highlighted suggestion adds itself.
            if (event.key !== "Enter" || highlighted) return
            event.preventDefault()
            add(draft)
          }}
          onBlur={() => add(draft)}
        />
        <ComboboxContent className="data-empty:hidden">
          <ComboboxList>
            {(name: string) => (
              <ComboboxItem key={name} value={name}>
                {name}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Autocomplete>
    </div>
  )
}

/** Multi-select options as pressable pills, for team fields such as Areas or Tools. */
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
