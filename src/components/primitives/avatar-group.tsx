import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { Hint } from "./hint"
import { buttonMotion, floatingMotion, raisedSurface } from "./motion"

export type AvatarPerson = { id: string | number; name: string }

/**
 * First and last initials of `name`; with an empty name, of the email's local part ("lorenzo.corallo@…" →
 * "LC"); "?" when both are empty.
 */
export function initialsOf(name: string, email = ""): string {
  const words = (name.trim() ? name.trim().split(/\s+/) : (email.split("@")[0] ?? "").split(/[._-]+/)).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words
  return letters.map((word) => word.charAt(0).toLocaleUpperCase()).join("") || "?"
}

const avatarRing = "size-6 ring-2 ring-(--pn-surface)"

function PersonAvatar({ person, className }: { person: AvatarPerson; className?: string }) {
  return (
    <Avatar size="sm" className={className}>
      <AvatarFallback className="bg-(--pn-muted) text-[10px]! leading-none font-medium tracking-[-0.01em] text-(--pn-fg-muted)">
        {initialsOf(person.name)}
      </AvatarFallback>
    </Avatar>
  )
}

type AvatarGroupProps = {
  people: AvatarPerson[]
  max?: number
  /** Names the popover's list, e.g. "Members of Soci 2026/27". */
  listLabel?: string
  className?: string
}

/**
 * Up to `max` 24px avatars with name tooltips, then a "+N" button opening a scrollable popover that lists everyone in
 * one column (avatar and name), so long groups never become a wall of comma-separated names.
 */
export function AvatarGroup({ people, max = 7, listLabel = "Members", className }: AvatarGroupProps) {
  const shown = people.slice(0, max)
  const rest = people.slice(max)

  return (
    <div className={cn("flex items-center -space-x-0.5", className)}>
      <span
        role="img"
        aria-label={shown.map((person) => person.name).join(", ")}
        className="flex items-center -space-x-0.5"
      >
        {shown.map((person) => (
          <Hint key={person.id} label={person.name}>
            <PersonAvatar person={person} className={avatarRing} />
          </Hint>
        ))}
      </span>
      {rest.length > 0 && (
        <Popover>
          <PopoverTrigger
            aria-label={`Show all ${pluralize(people.length, "member")}`}
            className={cn(
              buttonMotion,
              "relative inline-flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-(--pn-r-full) border border-(--pn-line-strong) bg-(--pn-muted) px-1.5 text-[11px] font-medium text-(--pn-fg-muted) tabular-nums ring-2 ring-(--pn-surface) transition-[color,border-color] hover:border-(--pn-fg-subtle) hover:text-(--pn-fg) data-popup-open:border-(--pn-fg-subtle) data-popup-open:text-(--pn-fg)"
            )}
          >
            +{rest.length}
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            aria-label={listLabel}
            className={cn(raisedSurface, floatingMotion, "w-64 gap-0 rounded-(--pn-r-4) p-0")}
          >
            <p className="border-b border-(--pn-line) px-3 py-2 text-xs text-(--pn-fg-muted) tabular-nums">
              {pluralize(people.length, "member")}
            </p>
            <ul className="max-h-[min(20rem,var(--available-height))] overflow-y-auto overscroll-contain py-1">
              {people.map((person) => (
                <li key={person.id} className="flex h-9 items-center gap-2.5 px-3">
                  <PersonAvatar person={person} className="size-6 shrink-0" />
                  <span title={person.name} className="truncate text-[13px] text-(--pn-fg)">
                    {person.name}
                  </span>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
