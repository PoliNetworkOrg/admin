import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Command as CommandPrimitive } from "cmdk"
import { Search, X } from "lucide-react"
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
import { appToast } from "@/components/shell"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import { addAzureGroupMember, removeAzureGroupMember } from "@/features/azure/azure.functions"
import type { AzureGroup, AzureMember } from "@/lib/api/types"
import { cn } from "@/lib/utils"

export type MembershipMode = "add" | "remove"

type Choice = { id: string; name: string | null; mail: string | null }

type MembershipDialogProps = {
  group: AzureGroup
  directoryMembers: AzureMember[]
  mode: MembershipMode
  open: boolean
  onOpenChange: (open: boolean) => void
}

const copy = {
  add: {
    title: "Add a group member",
    lead: "Choose a directory user to add to",
    tail: "",
    heading: "Available users",
    empty: "No available users found.",
  },
  remove: {
    title: "Remove a group member",
    lead: "Choose a member to remove from",
    tail: " Their Microsoft 365 account is not deleted.",
    heading: "Current members",
    empty: "No group members found.",
  },
}

const PERMISSION_ERROR = "You don't have permission to manage this group."

/** Add or remove one Microsoft 365 group member (§7.8); removal swaps to a confirmation before it runs. */
export function MembershipDialog({ group, directoryMembers, mode, open, onOpenChange }: MembershipDialogProps) {
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
  const adding = mode === "add"
  const text = copy[mode]

  const choices = useMemo<Choice[]>(() => {
    const memberIds = new Set(group.members.map((member) => member.id))
    const list = adding
      ? directoryMembers
          .filter((member) => !memberIds.has(member.id))
          .map((member) => ({ id: member.id, name: member.displayName, mail: member.mail }))
      : group.members.map((member) => ({
          id: member.id,
          name: member.displayName || null,
          mail: directoryMembers.find((candidate) => candidate.id === member.id)?.mail ?? null,
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
    setError(null)
    setSelected(choice)
    if (!adding) setConfirming(true)
  }

  function keepMember() {
    setError(null)
    setConfirming(false)
    setSelected(null)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  async function submit() {
    if (!selected || pending) return
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
      try {
        await router.invalidate({ sync: true })
      } catch (caught) {
        console.error(caught)
        appToast.warning("The membership was updated, but the latest group data could not be refreshed.")
      }
      appToast.success(adding ? `${name} added to ${group.displayName}.` : `${name} removed from ${group.displayName}.`)
      onOpenChange(false)
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      onOpenChangeComplete={(next) => {
        if (next) return
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
            <DialogTitle className="text-[15px] leading-[22px] font-semibold tracking-[-0.005em] text-balance">
              {confirming ? `Remove ${selectedName}?` : text.title}
            </DialogTitle>
            <DialogDescription className="text-[13px] leading-5 text-pretty text-(--pn-fg-muted)">
              {confirming ? (
                "They lose access to this Microsoft 365 group. Their account is not deleted."
              ) : (
                <>
                  {text.lead} <span className="font-medium text-(--pn-fg)">{group.displayName}</span>.{text.tail}
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
            ) : (
              <Command
                label={text.heading}
                className="h-[296px] rounded-(--pn-r-3)! border border-(--pn-line) bg-(--pn-surface) p-0"
              >
                <div className="relative shrink-0 border-b border-(--pn-line)">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--pn-fg-muted)"
                  />
                  <CommandPrimitive.Input
                    ref={inputRef}
                    placeholder="Search by name or email…"
                    className="h-10 w-full bg-transparent pr-3 pl-9 text-[14px] text-(--pn-fg) outline-none placeholder:text-(--pn-fg-subtle) pointer-coarse:text-base"
                  />
                </div>
                <CommandList className="max-h-none min-h-0 flex-1 p-1">
                  <CommandEmpty className="px-3 py-8 text-[13px] text-(--pn-fg-muted)">{text.empty}</CommandEmpty>
                  <CommandGroup heading={text.heading} className="p-0 **:[[cmdk-group-heading]]:px-2">
                    {choices.map((choice) => (
                      <CommandItem
                        key={choice.id}
                        value={`${choice.name ?? "Unnamed user"} ${choice.mail ?? ""} ${choice.id}`}
                        data-checked={selected?.id === choice.id}
                        onSelect={() => choose(choice)}
                        className="h-10 gap-2.5 rounded-(--pn-r-2) px-2 py-0 data-selected:bg-(--pn-muted) data-[checked=true]:bg-(--pn-accent-soft) [&>svg:last-child]:text-(--pn-accent)"
                      >
                        <PersonLine choice={choice} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
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
                  onClick={keepMember}
                  className={dialogFooterButton}
                >
                  Keep member
                </Button>
                <LoadingButton
                  size="default"
                  tone="dangerSolid"
                  pending={pending}
                  onClick={() => void submit()}
                  className="w-full min-[480px]:w-auto"
                >
                  Remove member
                </LoadingButton>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={close}
                  className={dialogFooterButton}
                >
                  Cancel
                </Button>
                {adding ? (
                  <LoadingButton
                    size="default"
                    pending={pending}
                    disabled={!selected}
                    onClick={() => void submit()}
                    className="w-full min-[480px]:w-auto"
                  >
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
      <Avatar size="sm" className="size-6 shrink-0">
        <AvatarFallback className="bg-(--pn-muted) text-[10px] font-medium text-(--pn-fg-muted)">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="truncate text-[13px] text-(--pn-fg)">{name}</span>
        {choice.mail ? <span className="truncate text-xs text-(--pn-fg-muted)">{choice.mail}</span> : null}
      </span>
    </>
  )
}
