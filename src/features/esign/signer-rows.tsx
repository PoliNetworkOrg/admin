import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  EllipsisVertical,
  MapPin,
  PenLine,
  Plus,
  Search,
  Stamp,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react"
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react"

import {
  Autocomplete,
  buttonMotion,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  fieldControl,
  Hint,
  IconButton,
} from "@/components/primitives"
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/primitives/menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { EsignProfile } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { FieldError, quietField } from "./composer-fields"
import { type Place, SIGN_ROLES, type SignerDraft } from "./places"
import { YouChip } from "./request-status"

/** Boxes one signer may have in a document (the backend's limit). */
export const MAX_PLACES = 20

/** Row columns: the order number (while the order holds), the role, the person and the row's action. */
function rowColumns(numbered: boolean) {
  return numbered
    ? "grid-cols-[20px_112px_minmax(0,1fr)_36px] @min-[1040px]/composer:grid-cols-[20px_124px_minmax(0,1fr)_36px]"
    : "grid-cols-[112px_minmax(0,1fr)_36px] @min-[1040px]/composer:grid-cols-[124px_minmax(0,1fr)_36px]"
}

/** A line under a row's 40px line, from the person column on. */
function detailCell(numbered: boolean) {
  return numbered ? "col-span-2 col-start-3" : "col-span-2 col-start-2"
}

/** The role a spot row takes from its label: text, not a field, since the box stays under that label. */
function SpotRole({ role }: { role: string }) {
  return (
    <Hint overflowOnly label={role}>
      <span className="truncate text-[14px] font-medium">{role}</span>
    </Hint>
  )
}

type RowShellProps = {
  row: SignerDraft
  numbered: boolean
  /** The pointer is on one of the row's boxes. */
  pointed: boolean
  /** The pointer or the focus entered (true) or left (false) the row. */
  onPoint: (inside: boolean) => void
  invalid?: boolean
  describedBy?: string
  children: ReactNode
}

/** A row of the Signers group: hovering or focusing it rings its boxes, and its boxes' hover tints it. */
function RowShell({ row, numbered, pointed, onPoint, invalid, describedBy, children }: RowShellProps) {
  return (
    <li
      data-signer-row
      data-row-id={row.id}
      tabIndex={describedBy === undefined ? undefined : -1}
      aria-describedby={describedBy}
      data-invalid={invalid || undefined}
      onPointerEnter={() => onPoint(true)}
      onPointerLeave={() => onPoint(false)}
      onFocus={() => onPoint(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onPoint(false)
      }}
      className={cn(
        "-mx-2 grid scroll-m-3 grid-rows-[40px] items-center gap-x-2 rounded-(--pn-r-3) px-2 transition-[background-color] duration-120",
        rowColumns(numbered),
        pointed && "bg-(--pn-hover)"
      )}
    >
      {children}
    </li>
  )
}

type SignerRowProps = {
  row: SignerDraft
  person: NonNullable<SignerDraft["person"]>
  index: number
  count: number
  /** The row's order number, once two people are in order. */
  number?: number
  /** The rows keep a column for the numbers. */
  numbered: boolean
  isMe: boolean
  /** Why this signer can't sign the request ("Can't sign documents of OneDrive."): a warning, an error once submitted. */
  cantSign?: string
  /** A blocked submit made `cantSign` an error. */
  attempted: boolean
  pointed: boolean
  onPoint: (inside: boolean) => void
  /** A free row's role, as typed; `onRoleDone` when its field loses the focus. */
  onRole: (role: string) => void
  onRoleDone: () => void
  onMove: (by: -1 | 1) => void
  onAddPlace: () => void
  onMovePlace: (at: number) => void
  onPlaceKind: (at: number, kind: Place["kind"]) => void
  onRemovePlace: (at: number) => void
  /** A place's menu opened (its index) or closed (null). */
  onShowPlace: (at: number | null) => void
  /** Empties a spot row, removes a free one; `trigger` is the menu button, so the focus can stay in the list. */
  onRemove: (trigger: HTMLElement | null) => void
}

/**
 * A signer edited in place: role, name and a "More actions" menu on one 40px line, their places under it. In a spot
 * the role is the label's; a free row types it.
 */
export function SignerRow({
  row,
  person,
  index,
  count,
  number,
  numbered,
  isMe,
  cantSign,
  attempted,
  pointed,
  onPoint,
  onRole,
  onRoleDone,
  onMove,
  onAddPlace,
  onMovePlace,
  onPlaceKind,
  onRemovePlace,
  onShowPlace,
  onRemove,
}: SignerRowProps) {
  const menuTrigger = useRef<HTMLButtonElement>(null)
  /** Remove was chosen: the row changes once its menu has closed and handed the focus back to its trigger. */
  const removing = useRef(false)
  const blockedId = `signer-blocked-${row.id}`
  return (
    <RowShell
      row={row}
      numbered={numbered}
      pointed={pointed}
      onPoint={onPoint}
      invalid={attempted && cantSign !== undefined}
      describedBy={cantSign === undefined ? undefined : blockedId}
    >
      {numbered &&
        (number === undefined ? (
          <span aria-hidden />
        ) : (
          // Fades in where its room already was: the role and the name don't move.
          <span className="grid size-5 animate-[pn-fade-in_150ms_var(--pn-ease-out)] place-items-center rounded-full bg-(--pn-accent-soft) text-[12px] font-semibold text-(--pn-accent) tabular-nums motion-reduce:animate-none">
            {number}
          </span>
        ))}
      <div className="flex h-10 min-w-0 items-center">
        {row.spot ? (
          <SpotRole role={row.role} />
        ) : (
          // No autoHighlight: Enter keeps a role typed by hand instead of taking the first suggestion.
          <Autocomplete items={SIGN_ROLES} value={row.role} onValueChange={onRole}>
            <ComboboxPrimitive.Input
              render={
                <Input
                  data-row-role
                  className={cn(fieldControl, quietField, "-ml-[7px] h-9 w-[calc(100%+7px)] px-1.5 shadow-none")}
                />
              }
              aria-label={`Role of ${person.name}`}
              placeholder="Role"
              maxLength={80}
              onBlur={onRoleDone}
            />
            {/* Hidden while nothing matches: a role typed by hand needs no empty list under it. */}
            <ComboboxContent className="w-48 data-empty:hidden">
              <ComboboxList>
                {(role: string) => (
                  <ComboboxItem key={role} value={role}>
                    {role}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Autocomplete>
        )}
      </div>
      <span className="flex min-w-0 items-center gap-1.5">
        <Hint overflowOnly label={person.name}>
          <span className="truncate text-[14px] font-medium">{person.name}</span>
        </Hint>
        {isMe && <YouChip />}
      </span>
      <Menu
        onOpenChangeComplete={(open) => {
          if (open || !removing.current) return
          removing.current = false
          onRemove(menuTrigger.current)
        }}
      >
        <MenuTrigger
          render={
            <IconButton
              ref={menuTrigger}
              data-row-menu
              label="More actions"
              ariaLabel={`More actions for ${person.name}`}
              icon={EllipsisVertical}
            />
          }
        />
        <MenuContent className="w-56">
          {count > 1 && (
            <>
              <MenuItem disabled={index === 0} onClick={() => onMove(-1)}>
                <ArrowUp aria-hidden /> Move up
              </MenuItem>
              <MenuItem disabled={index === count - 1} onClick={() => onMove(1)}>
                <ArrowDown aria-hidden /> Move down
              </MenuItem>
              <MenuSeparator />
            </>
          )}
          <MenuItem disabled={row.places.length >= MAX_PLACES} onClick={onAddPlace}>
            <Plus aria-hidden /> Add a place
          </MenuItem>
          {row.places.length === 1 && (
            <MenuItem onClick={() => onMovePlace(0)}>
              <MapPin aria-hidden /> Move to another spot
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem
            variant="destructive"
            onClick={() => {
              removing.current = true
            }}
          >
            <Trash2 aria-hidden /> Remove
          </MenuItem>
        </MenuContent>
      </Menu>
      {row.places.length > 1 && (
        <PlaceChips
          // Under the role, so two place buttons fit on one line.
          className={cn("pb-2", numbered ? "col-span-3 col-start-2" : "col-span-3")}
          name={person.name}
          places={row.places}
          onShow={onShowPlace}
          onKind={onPlaceKind}
          onMove={onMovePlace}
          onRemove={onRemovePlace}
        />
      )}
      {cantSign !== undefined && (
        <div className={cn("pb-2", detailCell(numbered))}>
          {attempted ? (
            <FieldError id={blockedId}>{cantSign}</FieldError>
          ) : (
            <p id={blockedId} className="flex items-center gap-1.5 text-[12px] text-(--pn-warning-fg)">
              <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
              {cantSign}
            </p>
          )}
        </div>
      )}
    </RowShell>
  )
}

type SpotRowProps = {
  /** A spot without a person. */
  row: SignerDraft
  numbered: boolean
  people: EsignProfile[]
  me: string
  /** The viewer may sign and isn't a signer yet: the list shows them before anything is typed. */
  meAddable: boolean
  /** The first empty spot: "Me" fills it in one click while `meAddable`. */
  first: boolean
  emptyText: (query: string) => string | null
  /** A blocked submit: an empty spot is an error. */
  attempted: boolean
  pointed: boolean
  onPoint: (inside: boolean) => void
  /** Changes when the spot's box on the page is clicked: the picker takes the focus and opens. */
  activation: number
  /** The picker got the focus: the spot's box comes into view. */
  onFocus: () => void
  onPick: (person: EsignProfile) => void
  onRemove: (trigger: HTMLElement | null) => void
}

/** A signature spot found in the PDF, waiting for a person: its label as the role, a picker and "Remove spot". */
export function SpotRow({
  row,
  numbered,
  people,
  me,
  meAddable,
  first,
  emptyText,
  attempted,
  pointed,
  onPoint,
  activation,
  onFocus,
  onPick,
  onRemove,
}: SpotRowProps) {
  const errorId = `spot-error-${row.id}`
  return (
    <RowShell row={row} numbered={numbered} pointed={pointed} onPoint={onPoint}>
      {numbered && <span aria-hidden />}
      <SpotRole role={row.role} />
      <PersonPicker
        people={people}
        me={me}
        meAddable={meAddable}
        meLabel={meAddable && first ? `Add me as ${row.role}` : null}
        emptyText={emptyText}
        placeholder="Choose signer…"
        ariaLabel={`Signer for ${row.role}`}
        error={attempted ? "Choose a signer or remove this spot." : undefined}
        errorId={errorId}
        activation={activation}
        onFocus={onFocus}
        onPick={onPick}
        onAddMe={() => {
          const self = people.find((p) => p.sub === me)
          if (self) onPick(self)
        }}
      />
      <IconButton
        label="Remove spot"
        ariaLabel={`Remove the ${row.role} spot`}
        icon={X}
        onClick={(event) => onRemove(event.currentTarget)}
      />
      {attempted && (
        <div className={cn("pb-2", detailCell(numbered))}>
          <FieldError id={errorId}>Choose a signer or remove this spot.</FieldError>
        </div>
      )}
    </RowShell>
  )
}

/** A signer's places when they have several, one menu each: the person appears once however many places they sign. */
function PlaceChips({
  name,
  places,
  className,
  onShow,
  onKind,
  onMove,
  onRemove,
}: {
  name: string
  places: Place[]
  className?: string
  onShow: (at: number | null) => void
  onKind: (at: number, kind: Place["kind"]) => void
  onMove: (at: number) => void
  onRemove: (at: number) => void
}) {
  const signatures = places.filter((p) => p.kind === "signature").length
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {places.map((p, at) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: places have no identity but their order
        <Menu key={at} onOpenChange={(open) => onShow(open ? at : null)}>
          <MenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                aria-label={`${p.kind === "mark" ? "Mark" : "Signature"} of ${name} on page ${p.page + 1}`}
                className="tabular-nums"
              />
            }
          >
            {p.kind === "mark" ? <Stamp aria-hidden /> : <PenLine aria-hidden />}
            {p.kind === "mark" ? "Mark" : "Signature"} · p. {p.page + 1}
            <ChevronDown aria-hidden className="text-(--pn-fg-muted)" />
          </MenuTrigger>
          <MenuContent align="start" className="w-60">
            <MenuGroup>
              <MenuLabel>Page {p.page + 1}</MenuLabel>
              <MenuRadioGroup
                value={p.kind}
                onValueChange={(value: string) => onKind(at, value === "mark" ? "mark" : "signature")}
              >
                <MenuRadioItem value="signature">Full signature</MenuRadioItem>
                <MenuRadioItem value="mark" disabled={p.kind === "signature" && signatures === 1}>
                  Mark only
                </MenuRadioItem>
              </MenuRadioGroup>
              <p className="px-2 pt-0.5 pb-1.5 text-[12px] text-pretty text-(--pn-fg-muted)">
                A mark shows the signature again without signing twice.
              </p>
            </MenuGroup>
            <MenuSeparator />
            <MenuItem onClick={() => onMove(at)}>
              <MapPin aria-hidden /> Move to another spot
            </MenuItem>
            <MenuItem variant="destructive" onClick={() => onRemove(at)}>
              <Trash2 aria-hidden /> Remove
            </MenuItem>
          </MenuContent>
        </Menu>
      ))}
    </div>
  )
}

type PersonPickerProps = {
  /** Who may still be added, the viewer first. */
  people: EsignProfile[]
  me: string
  /** The viewer may sign and isn't a signer yet: the list shows them before anything is typed. */
  meAddable: boolean
  /** "Me" at the end of the field, adding the viewer in one click, with this name; null hides it. */
  meLabel: string | null
  /** Why nobody is listed for a query ("" before typing), or null to keep the list closed. */
  emptyText: (query: string) => string | null
  placeholder: string
  ariaLabel: string
  /** A search icon at the start, for the free picker. */
  search?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  error?: string
  errorId: string
  /** Changes to focus the field and open its list. */
  activation?: number
  onFocus?: () => void
  /** The field lost the focus while empty. */
  onLeaveEmpty?: () => void
  onPick: (person: EsignProfile) => void
  onAddMe: () => void
}

/**
 * Finds a person to sign. People are listed once something is typed, so the whole directory never shows at once; the
 * viewer is the one exception, listed as soon as the list opens. The first person listed is highlighted, so Enter picks
 * them: the viewer, before anything is typed.
 *
 * It is an `Autocomplete` over the people already filtered here, since that root highlights the first item as soon as
 * the list opens; a person is picked by pressing their item, by pointer or Enter.
 */
function PersonPicker({
  people,
  me,
  meAddable,
  meLabel,
  emptyText,
  placeholder,
  ariaLabel,
  search = false,
  inputRef,
  error,
  errorId,
  activation = 0,
  onFocus,
  onLeaveEmpty,
  onPick,
  onAddMe,
}: PersonPickerProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const field = useRef<HTMLInputElement | null>(null)
  const needle = query.trim().toLocaleLowerCase()
  const items =
    needle === ""
      ? people.filter((p) => meAddable && p.sub === me)
      : people.filter((p) => `${p.name} ${p.email ?? ""}`.toLocaleLowerCase().includes(needle)).slice(0, 30)
  const empty = items.length === 0 ? emptyText(needle) : null

  function pick(person: EsignProfile) {
    setQuery("")
    onPick(person)
  }

  // A picker mounted after its box was clicked, such as an emptied spot's, waits for the next click.
  const seenActivation = useRef(activation)
  useEffect(() => {
    if (activation === seenActivation.current) return
    seenActivation.current = activation
    field.current?.focus()
    setOpen(true)
  }, [activation])

  return (
    <Autocomplete
      items={items}
      mode="none"
      itemToStringValue={(person: EsignProfile) => person.name}
      value={query}
      onValueChange={(value, { reason }) => {
        // Picking a person would otherwise put their name in the search.
        if (reason !== "item-press") setQuery(value)
      }}
      open={open && (items.length > 0 || empty !== null)}
      onOpenChange={setOpen}
      openOnInputClick
      autoHighlight="always"
    >
      <div className="relative min-w-0">
        {search && (
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--pn-fg-muted)"
          />
        )}
        <ComboboxPrimitive.Input
          ref={(input: HTMLInputElement | null) => {
            field.current = input
            if (inputRef) inputRef.current = input
          }}
          render={
            <Input
              data-row-picker
              className={cn(fieldControl, "h-9 scroll-m-3", search && "pl-9", meLabel !== null && "pr-14")}
            />
          }
          aria-label={ariaLabel}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onFocus={onFocus}
          onBlur={() => {
            if (query.trim() === "") onLeaveEmpty?.()
          }}
        />
        {meLabel !== null && <MeButton label={meLabel} onClick={onAddMe} />}
      </div>
      <ComboboxContent className="min-w-64">
        <ComboboxList className="max-h-[284px]">
          {(person: EsignProfile) => (
            <ComboboxItem key={person.sub} value={person} onClick={() => pick(person)} className="min-h-11 px-2 py-1.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[14px]">{person.name}</span>
                  {person.sub === me && <YouChip />}
                </span>
                {person.email && (
                  <span className="truncate font-mono text-[12px] text-(--pn-fg-muted)">{person.email}</span>
                )}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
        {empty && <p className="px-3 py-2.5 text-[13px] text-pretty text-(--pn-fg-muted)">{empty}</p>}
      </ComboboxContent>
    </Autocomplete>
  )
}

type SignerPickerProps = Omit<PersonPickerProps, "placeholder" | "ariaLabel" | "search" | "onLeaveEmpty"> & {
  inputRef: RefObject<HTMLInputElement | null>
  /** Spots hold the signers: the picker folds into "Add signer" until it's wanted. */
  folded: boolean
}

/** Adds a signer without a spot: contracts, declarations, or someone the labels don't name. */
export function SignerPicker({ folded, error, errorId, inputRef, ...props }: SignerPickerProps) {
  const [unfolded, setUnfolded] = useState(false)
  const focusField = useRef(false)
  useEffect(() => {
    if (!unfolded || !focusField.current) return
    focusField.current = false
    inputRef.current?.focus()
  }, [unfolded, inputRef])

  if (folded && !unfolded)
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(buttonMotion, "-ml-2 self-start text-(--pn-fg-muted)")}
        onClick={() => {
          focusField.current = true
          setUnfolded(true)
        }}
      >
        <Plus aria-hidden /> Add signer
      </Button>
    )
  return (
    <div className="flex flex-col gap-1.5">
      <PersonPicker
        {...props}
        search
        placeholder="Add a signer…"
        ariaLabel="Find a person to add"
        error={error}
        errorId={errorId}
        inputRef={inputRef}
        onLeaveEmpty={() => setUnfolded(false)}
      />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  )
}

/** "Me", at the end of a signer field: adds the viewer in one click. */
function MeButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Hint label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="absolute inset-y-px right-px rounded-[7px] px-3 text-[13px] font-medium text-(--pn-accent) transition-[background-color] duration-120 hover:bg-(--pn-hover)"
      >
        Me
      </button>
    </Hint>
  )
}
