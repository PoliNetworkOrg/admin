import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Command as CommandPrimitive } from "cmdk"
import { Search, UserMinus, UserPlus, X } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  dialogFooter,
  dialogFooterButton,
  dialogMotion,
  dialogPanel,
  IconButton,
  InlineAlert,
  initialsOf,
  LoadingButton,
  scrimClasses,
} from "@/components/primitives"
import { dialogTitleText, dialogDescriptionText } from "@/components/primitives/confirm-dialog"
import { appToast, useCan } from "@/components/shell"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { addAzureGroupMember, removeAzureGroupMember } from "@/features/azure/groups.functions"
import type { AzureGroup, AzureMember } from "@/lib/api/types"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

type Choice = { id: string; name: string | null; mail: string | null }

type MembershipDialogProps = {
  group: AzureGroup
  directoryMembers: AzureMember[] | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PERMISSION_ERROR = "You don't have permission to manage this group."

/** One member list with an add picker and a per-member removal confirmation. */
export function MembershipDialog({ group, directoryMembers, open, onOpenChange }: MembershipDialogProps) {
  const canWrite = useCan("azure:groups:write")
  const canAdd = canWrite && directoryMembers !== null
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState("")
  const router = useRouter()
  const addMember = useServerFn(addAzureGroupMember)
  const removeMember = useServerFn(removeAzureGroupMember)
  const [selected, setSelected] = useState<Choice | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const keepRef = useRef<HTMLButtonElement>(null)

  const choices = useMemo<Choice[]>(() => {
    const memberIds = new Set(group.members.map((member) => member.id))
    const directory = directoryMembers ?? []
    const emails = new Map(directory.map((member) => [member.id, member.mail]))
    const list = adding
      ? directory
          .filter((member) => !memberIds.has(member.id))
          .map((member) => ({ id: member.id, name: member.displayName, mail: member.mail }))
      : group.members.map((member) => ({
          id: member.id,
          name: member.displayName || null,
          mail: emails.get(member.id) ?? null,
        }))
    // Unnamed users go last.
    return list.toSorted((a, b) => {
      if (a.name === null || b.name === null) return a.name === b.name ? 0 : a.name === null ? 1 : -1
      return a.name.localeCompare(b.name)
    })
  }, [adding, directoryMembers, group.members])

  useEffect(() => {
    if (confirming) keepRef.current?.focus()
  }, [confirming])

  function close() {
    if (!pending) onOpenChange(false)
  }

  function choose(choice: Choice) {
    if (!canWrite || pending || (adding && !canAdd)) return
    setError(null)
    setSelected(choice)
    if (!adding) setConfirming(true)
  }

  function showMembers() {
    setAdding(false)
    setQuery("")
    setError(null)
    setConfirming(false)
    setSelected(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  async function submit() {
    if (!selected || pending || !canWrite || (adding && !canAdd)) return
    const name = selected.name ?? "Unnamed user"
    const input = { data: { groupId: group.id, userId: selected.id } }
    setPending(true)
    setError(null)
    try {
      const result = adding ? await addMember(input) : await removeMember(input)
      if (result.error) {
        setError("Microsoft 365 could not complete the change. Try again.")
        return
      }
      let refreshed = true
      try {
        await router.invalidate({ sync: true })
      } catch (caught) {
        console.error(caught)
        refreshed = false
        appToast.warning("The membership was updated, but the latest group data could not be refreshed.")
      }
      appToast.success(adding ? `${name} added to ${group.displayName}.` : `${name} removed from ${group.displayName}.`)
      if (refreshed) showMembers()
      else onOpenChange(false)
    } catch (caught) {
      console.error(caught)
      setError(
        caught instanceof Error && caught.message === "UNAUTHORIZED"
          ? PERMISSION_ERROR
          : `There was an unexpected error while ${adding ? "adding" : "removing"} the member.`
      )
      return
    } finally {
      setPending(false)
    }
  }

  // As in `FormDialog`: the search on fine pointers; the panel itself otherwise, so no tooltip pops open.
  function initialFocus() {
    if (!window.matchMedia("(pointer: fine)").matches) return popupRef.current
    return inputRef.current ?? popupRef.current
  }

  const selectedName = selected?.name ?? "Unnamed user"
  const search = query.trim().toLocaleLowerCase()
  const visibleMembers = choices.filter((choice) =>
    `${choice.name ?? "Unnamed user"} ${choice.mail ?? ""}`.toLocaleLowerCase().includes(search)
  )

  function showAddPicker() {
    if (!canAdd || pending) return
    setAdding(true)
    setSelected(null)
    setError(null)
    setQuery("")
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      onOpenChangeComplete={(next) => {
        if (next) return
        setAdding(false)
        setQuery("")
        setSelected(null)
        setConfirming(false)
        setError(null)
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
            <DialogTitle className={dialogTitleText}>
              {confirming
                ? `Remove ${selectedName}?`
                : `${adding ? "Add a member to" : "Members of"} ${group.displayName}`}
            </DialogTitle>
            <DialogDescription className={dialogDescriptionText}>
              {confirming ? (
                "They lose access to this Microsoft 365 group. Their account is not deleted."
              ) : !adding ? (
                <>
                  {pluralize(group.members.length, "member")}
                  {group.mailAddress ? (
                    <>
                      {" "}
                      on <span className="font-medium text-(--pn-fg)">{group.mailAddress}</span>
                    </>
                  ) : null}
                  .
                </>
              ) : (
                <>
                  Choose a directory user to add to{" "}
                  <span className="font-medium text-(--pn-fg)">{group.displayName}</span>.
                </>
              )}
            </DialogDescription>
            <IconButton label="Close" icon={X} onClick={close} className="absolute top-3 right-3" />
          </header>

          <div className="flex min-h-0 flex-1 flex-col p-5">
            {confirming && selected ? (
              <div className="flex h-14 items-center gap-3 rounded-(--pn-r-3) border border-(--pn-line) bg-(--pn-surface) px-3">
                <PersonLine choice={selected} />
              </div>
            ) : adding ? (
              <Command
                label="Available users"
                className="h-[296px] rounded-(--pn-r-3)! border border-(--pn-line) bg-(--pn-surface) p-0"
              >
                <div className="relative shrink-0 border-b border-(--pn-line)">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--pn-fg-muted)"
                  />
                  <CommandPrimitive.Input
                    ref={inputRef}
                    aria-label="Search available users"
                    placeholder="Search by name or email…"
                    className="h-10 w-full bg-transparent pr-3 pl-9 text-[14px] text-(--pn-fg) outline-none placeholder:text-(--pn-fg-subtle) pointer-coarse:text-base"
                  />
                </div>
                <CommandList className="max-h-none min-h-0 flex-1 p-1">
                  <CommandEmpty className="px-3 py-8 text-[13px] text-(--pn-fg-muted)">
                    No available users found.
                  </CommandEmpty>
                  <CommandGroup heading="Available users" className="p-0 **:[[cmdk-group-heading]]:px-2">
                    {choices.map((choice) => (
                      <CommandItem
                        key={choice.id}
                        value={`${choice.name ?? "Unnamed user"} ${choice.mail ?? ""} ${choice.id}`}
                        data-checked={selected?.id === choice.id}
                        onSelect={() => choose(choice)}
                        className="min-h-15 gap-2.5 rounded-(--pn-r-2) px-2 py-2 data-selected:bg-(--pn-muted) data-[checked=true]:bg-(--pn-accent-soft) [&>svg:last-child]:text-(--pn-accent)"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-4 shrink-0 place-items-center rounded-full border border-(--pn-line-strong)",
                            selected?.id === choice.id && "border-(--pn-accent)"
                          )}
                        >
                          {selected?.id === choice.id && (
                            <span className="size-2 rounded-full bg-(--pn-accent-solid)" />
                          )}
                        </span>
                        <PersonLine choice={choice} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            ) : (
              <>
                {canWrite ? (
                  <div className="mb-3 flex justify-end">
                    <Button
                      size="sm"
                      disabled={!canAdd}
                      onClick={showAddPicker}
                      title={!canAdd ? "Adding members needs access to the member directory" : undefined}
                    >
                      <UserPlus aria-hidden className="size-4" />
                      Add member
                    </Button>
                  </div>
                ) : null}
                {!canAdd && canWrite ? (
                  <p className="mb-3 text-[13px] text-(--pn-fg-muted)">
                    Adding members needs access to the member directory.
                  </p>
                ) : null}
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
                      visibleMembers.map((choice) => (
                        <li key={choice.id} className="flex min-h-15 items-center gap-2.5 rounded-(--pn-r-2) px-2 py-2">
                          <PersonLine choice={choice} />
                          {canWrite ? (
                            <IconButton
                              label="Remove member"
                              ariaLabel={`Remove ${choice.name ?? "Unnamed user"} from ${group.displayName}`}
                              icon={UserMinus}
                              tone="danger"
                              appearance="boxed"
                              onClick={() => choose(choice)}
                            />
                          ) : null}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </>
            )}
          </div>

          {error ? (
            <div className="shrink-0 px-5 pb-4">
              <InlineAlert>{error}</InlineAlert>
            </div>
          ) : null}

          <div className={dialogFooter}>
            {confirming ? (
              <>
                <Button
                  ref={keepRef}
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={showMembers}
                  className={dialogFooterButton}
                >
                  Keep member
                </Button>
                <LoadingButton size="default" tone="dangerSolid" pending={pending} onClick={() => void submit()}>
                  Remove member
                </LoadingButton>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={adding ? showMembers : close}
                  className={dialogFooterButton}
                >
                  {adding ? "Back to members" : "Close"}
                </Button>
                {adding ? (
                  <LoadingButton size="default" pending={pending} disabled={!selected} onClick={() => void submit()}>
                    Add member
                  </LoadingButton>
                ) : null}
              </>
            )}
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}

function PersonLine({ choice }: { choice: Choice }) {
  const name = choice.name ?? "Unnamed user"
  return (
    <>
      <Avatar size="sm" className="size-8 shrink-0">
        <AvatarFallback className="bg-(--pn-muted) text-[11px] font-medium text-(--pn-fg-muted)">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] leading-5 break-words text-(--pn-fg)">{name}</span>
        {choice.mail ? (
          <span className="font-mono text-xs leading-4 break-all text-(--pn-fg-muted)">{choice.mail}</span>
        ) : null}
      </span>
    </>
  )
}
