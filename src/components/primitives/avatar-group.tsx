import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { Hint } from "./hint"

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

type AvatarGroupProps = { people: AvatarPerson[]; max?: number; className?: string }

/** Up to `max` 24px avatars with name tooltips, then a "+N" chip whose tooltip lists the rest. */
export function AvatarGroup({ people, max = 7, className }: AvatarGroupProps) {
  const shown = people.slice(0, max)
  const rest = people.slice(max)

  return (
    <div
      role="img"
      aria-label={people.map((person) => person.name).join(", ")}
      className={cn("flex items-center -space-x-0.5", className)}
    >
      {shown.map((person) => (
        <Hint key={person.id} label={person.name}>
          <Avatar size="sm" className={avatarRing}>
            <AvatarFallback className="bg-(--pn-muted) text-[10px]! leading-none font-medium tracking-[-0.01em] text-(--pn-fg-muted)">
              {initialsOf(person.name)}
            </AvatarFallback>
          </Avatar>
        </Hint>
      ))}
      {rest.length > 0 && (
        <Hint label={rest.map((person) => person.name).join(", ")}>
          <span
            aria-label={`and ${pluralize(rest.length, "other")}`}
            className="relative inline-flex h-6 min-w-6 items-center justify-center rounded-(--pn-r-full) border border-(--pn-line-strong) bg-(--pn-muted) px-1.5 text-[11px] font-medium text-(--pn-fg-muted) tabular-nums ring-2 ring-(--pn-surface)"
          >
            +{rest.length}
          </span>
        </Hint>
      )}
    </div>
  )
}
