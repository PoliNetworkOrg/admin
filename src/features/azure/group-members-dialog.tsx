import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Search, X } from "lucide-react"
import { useMemo, useRef, useState } from "react"

import {
  dialogFooter,
  dialogFooterButton,
  dialogMotion,
  dialogPanel,
  IconButton,
  initialsOf,
  scrimClasses,
} from "@/components/primitives"
import { dialogTitleText, dialogDescriptionText } from "@/components/primitives/confirm-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import type { AzureGroup, AzureMember } from "@/lib/api/types"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

type Person = { id: string; name: string | null; mail: string | null }

type GroupMembersDialogProps = {
  group: AzureGroup
  directoryMembers: AzureMember[] | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * A group's members, read-only: the dashboard never changes group membership. Emails come from the member directory,
 * so they are missing without `azure:members:read`.
 */
export function GroupMembersDialog({ group, directoryMembers, open, onOpenChange }: GroupMembersDialogProps) {
  const [query, setQuery] = useState("")
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const people = useMemo<Person[]>(() => {
    const emails = new Map((directoryMembers ?? []).map((member) => [member.id, member.mail]))
    const list = group.members.map((member) => ({
      id: member.id,
      name: member.displayName || null,
      mail: emails.get(member.id) ?? null,
    }))
    // Unnamed users go last.
    return list.toSorted((a, b) => {
      if (a.name === null || b.name === null) return a.name === b.name ? 0 : a.name === null ? 1 : -1
      return a.name.localeCompare(b.name)
    })
  }, [directoryMembers, group.members])

  // As in `FormDialog`: the search on fine pointers; the panel itself otherwise, so no tooltip pops open.
  function initialFocus() {
    if (!window.matchMedia("(pointer: fine)").matches) return popupRef.current
    return inputRef.current ?? popupRef.current
  }

  const search = query.trim().toLocaleLowerCase()
  const visibleMembers = people.filter((person) =>
    `${person.name ?? "Unnamed user"} ${person.mail ?? ""}`.toLocaleLowerCase().includes(search)
  )

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      onOpenChangeComplete={(next) => {
        if (!next) setQuery("")
      }}
    >
      <DialogPortal>
        <DialogOverlay className={scrimClasses} />
        <DialogPrimitive.Popup
          ref={popupRef}
          initialFocus={initialFocus}
          className={cn(dialogPanel, dialogMotion, "max-w-[480px]")}
        >
          <header className="relative flex shrink-0 flex-col gap-1.5 px-5 pt-5 pr-14">
            <DialogTitle className={dialogTitleText}>Members of {group.displayName}</DialogTitle>
            <DialogDescription className={dialogDescriptionText}>
              {pluralize(group.members.length, "member")}
              {group.mailAddress ? (
                <>
                  {" "}
                  on <span className="font-medium text-(--pn-fg)">{group.mailAddress}</span>
                </>
              ) : null}
              .
            </DialogDescription>
            <IconButton label="Close" icon={X} onClick={() => onOpenChange(false)} className="absolute top-3 right-3" />
          </header>

          <div className="flex min-h-0 flex-1 flex-col p-5">
            <div className="flex h-[296px] flex-col overflow-hidden rounded-(--pn-r-3) border border-(--pn-line) bg-(--pn-surface)">
              <div className="relative shrink-0 border-b border-(--pn-line)">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--pn-fg-muted)"
                />
                <input
                  ref={inputRef}
                  aria-label="Search group members"
                  placeholder="Search by name or email…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-10 w-full bg-transparent pr-3 pl-9 text-[14px] text-(--pn-fg) placeholder:text-(--pn-fg-subtle) pointer-coarse:text-base"
                />
              </div>
              <ul aria-label="Current members" className="min-h-0 flex-1 overflow-y-auto p-1">
                {visibleMembers.length === 0 ? (
                  <li className="px-3 py-8 text-[13px] text-(--pn-fg-muted)">
                    {group.members.length === 0 ? "No members yet." : "No group members match your search."}
                  </li>
                ) : (
                  visibleMembers.map((person) => (
                    <li key={person.id} className="flex min-h-15 items-center gap-2.5 rounded-(--pn-r-2) px-2 py-2">
                      <PersonLine person={person} />
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          <div className={dialogFooter}>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className={dialogFooterButton}>
              Close
            </Button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}

function PersonLine({ person }: { person: Person }) {
  const name = person.name ?? "Unnamed user"
  return (
    <>
      <Avatar size="sm" className="size-8 shrink-0">
        <AvatarFallback className="bg-(--pn-muted) text-[11px] font-medium text-(--pn-fg-muted)">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] leading-5 break-words text-(--pn-fg)">{name}</span>
        {person.mail ? (
          <span className="font-mono text-xs leading-4 break-all text-(--pn-fg-muted)">{person.mail}</span>
        ) : null}
      </span>
    </>
  )
}
