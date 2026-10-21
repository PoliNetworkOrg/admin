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
} from "lucide-react"
import { type Ref, useRef, useState } from "react"

import {
  Autocomplete,
  Combobox,
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
import type { Place } from "./places"
import { YouChip } from "./request-status"

/** `byRole`: the box the signer's role places under its label, until the user moves it. */
export type DraftPlace = Place & { byRole?: true }
export type SignerDraft = { sub: string; name: string; role: string; places: DraftPlace[] }

/** Boxes one signer may have in a document (the backend's limit). */
export const MAX_PLACES = 20

const ROLES = ["Presidente", "Vicepresidente", "Segretario", "Tesoriere", "Consigliere", "Socio"]

/** Row columns: the order number (while it shows), the role, the person and their menu. */
function rowColumns(numbered: boolean) {
  return numbered
    ? "grid-cols-[20px_112px_minmax(0,1fr)_36px] @min-[1040px]/composer:grid-cols-[20px_124px_minmax(0,1fr)_36px]"
    : "grid-cols-[112px_minmax(0,1fr)_36px] @min-[1040px]/composer:grid-cols-[124px_minmax(0,1fr)_36px]"
}

type SignerRowProps = {
  signer: SignerDraft
  index: number
  count: number
  /** Shows the order number, in the row as on its boxes. */
  numbered: boolean
  isMe: boolean
  /** The drive whose documents this signer may not sign, by its label. */
  blockedBy?: string
  /** A blocked submit made the drive rule an error. */
  attempted: boolean
  /** The pointer is on one of the signer's boxes. */
  pointed: boolean
  roleRef: Ref<HTMLInputElement>
  onRole: (role: string) => void
  /** The pointer or the focus entered (true) or left (false) the row. */
  onPoint: (inside: boolean) => void
  onMove: (by: -1 | 1) => void
  onAddPlace: () => void
  onMovePlace: (at: number) => void
  onPlaceKind: (at: number, kind: Place["kind"]) => void
  onRemovePlace: (at: number) => void
  /** A place's menu opened (its index) or closed (null). */
  onShowPlace: (at: number | null) => void
  /** Removes the signer; `trigger` is the menu button, so the focus can stay in the list. */
  onRemove: (trigger: HTMLElement | null) => void
}

/** A signer edited in place: role, name and a "More actions" menu on one 40px line, their places under it. */
export function SignerRow({
  signer,
  index,
  count,
  numbered,
  isMe,
  blockedBy,
  attempted,
  pointed,
  roleRef,
  onRole,
  onPoint,
  onMove,
  onAddPlace,
  onMovePlace,
  onPlaceKind,
  onRemovePlace,
  onShowPlace,
  onRemove,
}: SignerRowProps) {
  const row = useRef<HTMLLIElement>(null)
  /** Remove was chosen: the row goes once its menu has closed and handed the focus back to its trigger. */
  const removing = useRef(false)
  const columns = rowColumns(numbered)
  const detail = cn("grid gap-x-2", columns)
  const detailCell = cn("col-span-2", numbered ? "col-start-3" : "col-start-2")
  // Under the role, so two place buttons fit on one line.
  const chipsCell = numbered ? "col-span-3 col-start-2" : "col-span-3"
  const blockedId = `signer-blocked-${signer.sub}`
  return (
    <li
      ref={row}
      data-signer-row
      tabIndex={blockedBy === undefined ? undefined : -1}
      aria-describedby={blockedBy === undefined ? undefined : blockedId}
      data-invalid={(attempted && blockedBy !== undefined) || undefined}
      onPointerEnter={() => onPoint(true)}
      onPointerLeave={() => onPoint(false)}
      onFocus={() => onPoint(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onPoint(false)
      }}
      className={cn(
        "-mx-2 flex scroll-m-3 flex-col rounded-(--pn-r-3) px-2 transition-[background-color] duration-120",
        pointed && "bg-(--pn-hover)"
      )}
    >
      <div className={cn("grid h-10 items-center gap-2", columns)}>
        {numbered && (
          <span className="grid size-5 place-items-center rounded-full bg-(--pn-accent-soft) text-[12px] font-semibold text-(--pn-accent) tabular-nums">
            {index + 1}
          </span>
        )}
        {/* No autoHighlight: Enter keeps a role typed by hand instead of taking the first suggestion. */}
        <Autocomplete items={ROLES} value={signer.role} onValueChange={onRole}>
          <ComboboxPrimitive.Input
            ref={roleRef}
            render={
              <Input className={cn(fieldControl, quietField, "-ml-[7px] h-9 w-[calc(100%+7px)] px-1.5 shadow-none")} />
            }
            aria-label={`Role of ${signer.name}`}
            placeholder="Role"
            maxLength={80}
          />
          <ComboboxContent className="w-44">
            <ComboboxList>
              {(role: string) => (
                <ComboboxItem key={role} value={role}>
                  {role}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Autocomplete>
        <span className="flex min-w-0 items-center gap-1.5">
          <Hint overflowOnly label={signer.name}>
            <span className="truncate text-[14px] font-medium">{signer.name}</span>
          </Hint>
          {isMe && <YouChip />}
        </span>
        <Menu
          onOpenChangeComplete={(open) => {
            if (open || !removing.current) return
            removing.current = false
            onRemove(row.current?.querySelector<HTMLElement>("[aria-haspopup=menu]") ?? null)
          }}
        >
          <MenuTrigger
            render={
              <IconButton label="More actions" ariaLabel={`More actions for ${signer.name}`} icon={EllipsisVertical} />
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
            <MenuItem disabled={signer.places.length >= MAX_PLACES} onClick={onAddPlace}>
              <Plus aria-hidden /> Add a place
            </MenuItem>
            {signer.places.length === 1 && (
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
      </div>
      {signer.places.length > 1 && (
        <div className={cn(detail, "pb-2")}>
          <PlaceChips
            className={chipsCell}
            name={signer.name}
            places={signer.places}
            onShow={onShowPlace}
            onKind={onPlaceKind}
            onMove={onMovePlace}
            onRemove={onRemovePlace}
          />
        </div>
      )}
      {blockedBy !== undefined && (
        <div className={cn(detail, "pb-2")}>
          <div className={detailCell}>
            {attempted ? (
              <FieldError id={blockedId}>Can't sign documents of {blockedBy}.</FieldError>
            ) : (
              <p id={blockedId} className="flex items-center gap-1.5 text-[12px] text-(--pn-warning-fg)">
                <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                Can't sign documents of {blockedBy}.
              </p>
            )}
          </div>
        </div>
      )}
    </li>
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

type SignerPickerProps = {
  /** Who may still be added, the viewer first. */
  people: EsignProfile[]
  me: string
  /** The viewer may sign and isn't a signer yet: "Me" adds them in one click. */
  meAddable: boolean
  /** Why nobody is listed for a query ("" before typing), or null to keep the list closed. */
  emptyText: (query: string) => string | null
  inputRef: Ref<HTMLInputElement>
  error?: string
  errorId: string
  onAdd: (person: EsignProfile) => void
  onAddMe: () => void
}

/**
 * Adds a signer. People are listed once something is typed, so the whole directory never shows at once; the viewer is
 * the one exception, listed as soon as the list opens.
 */
export function SignerPicker({
  people,
  me,
  meAddable,
  emptyText,
  inputRef,
  error,
  errorId,
  onAdd,
  onAddMe,
}: SignerPickerProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const needle = query.trim().toLocaleLowerCase()
  const items =
    needle === ""
      ? people.filter((p) => meAddable && p.sub === me)
      : people.filter((p) => `${p.name} ${p.email ?? ""}`.toLocaleLowerCase().includes(needle)).slice(0, 30)
  const empty = items.length === 0 ? emptyText(needle) : null
  return (
    <div className="flex flex-col gap-1.5">
      <Combobox
        items={items}
        filter={null}
        itemToStringLabel={(person: EsignProfile) => person.name}
        value={null}
        inputValue={query}
        onInputValueChange={(value, { reason }) => {
          // Picking a person would otherwise put their name in the search.
          if (reason !== "item-press") setQuery(value)
        }}
        onValueChange={(person) => {
          if (!person) return
          setQuery("")
          onAdd(person)
        }}
        open={open && (items.length > 0 || empty !== null)}
        onOpenChange={setOpen}
        autoHighlight
      >
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--pn-fg-muted)"
          />
          <ComboboxPrimitive.Input
            ref={inputRef}
            render={<Input className={cn(fieldControl, "h-9 scroll-m-3 pl-9", meAddable && "pr-14")} />}
            aria-label="Find a person to add"
            placeholder="Add a signer…"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          {meAddable && <MeButton label="Add me" onClick={onAddMe} />}
        </div>
        <ComboboxContent>
          <ComboboxList className="max-h-[284px]">
            {(person: EsignProfile) => (
              <ComboboxItem key={person.sub} value={person} className="min-h-11 px-2 py-1.5">
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
      </Combobox>
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
