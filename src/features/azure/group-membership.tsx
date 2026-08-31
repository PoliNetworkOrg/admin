import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle, UserMinus, UserPlus } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { addAzureGroupMember, removeAzureGroupMember } from "@/features/azure/azure.functions"
import type { AzureGroup, AzureMember } from "@/lib/api/types"

const MAX_VISIBLE_MEMBERS = 7

type MemberChoice = Pick<AzureMember, "id" | "displayName" | "mail">

export function GroupMembership({
  group,
  directoryMembers,
  canWrite,
}: {
  group: AzureGroup
  directoryMembers: AzureMember[]
  canWrite: boolean
}) {
  const sortedMembers = [...group.members].sort((a, b) => a.displayName.localeCompare(b.displayName))
  const visibleMembers = sortedMembers.slice(0, MAX_VISIBLE_MEMBERS)
  const hiddenMembers = sortedMembers.slice(MAX_VISIBLE_MEMBERS)

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
      {group.members.length > 0 ? (
        <AvatarGroup className="pl-2 sm:justify-end">
          {visibleMembers.map((member) => (
            <MemberAvatar key={member.id} member={member} />
          ))}
          {hiddenMembers.length > 0 && <HiddenMembersCount members={hiddenMembers} />}
        </AvatarGroup>
      ) : (
        <p className="text-sm text-muted-foreground">No members yet</p>
      )}
      {canWrite && (
        <div className="flex items-center gap-1">
          <MembershipDialog group={group} directoryMembers={directoryMembers} mode="add" />
          <MembershipDialog group={group} directoryMembers={directoryMembers} mode="remove" />
        </div>
      )}
    </div>
  )
}

function MemberAvatar({ member }: { member: AzureGroup["members"][number] }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Avatar className="size-9">
          <AvatarFallback>{initials(member.displayName)}</AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent side="bottom">{member.displayName}</TooltipContent>
    </Tooltip>
  )
}

function HiddenMembersCount({ members }: { members: AzureGroup["members"] }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <AvatarGroupCount className="size-9">+{members.length}</AvatarGroupCount>
      </TooltipTrigger>
      <TooltipContent className="flex max-h-72 min-w-52 flex-col items-stretch gap-2 overflow-y-auto p-2" side="bottom">
        {members.map((member) => (
          <div key={member.id} className="flex items-center gap-2 rounded-sm px-1 py-0.5">
            <Avatar size="sm">
              <AvatarFallback>{initials(member.displayName)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{member.displayName}</span>
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}

function MembershipDialog({
  group,
  directoryMembers,
  mode,
}: {
  group: AzureGroup
  directoryMembers: AzureMember[]
  mode: "add" | "remove"
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [selectedMember, setSelectedMember] = useState<MemberChoice | null>(null)
  const [confirmRemoval, setConfirmRemoval] = useState(false)
  const router = useRouter()
  const addGroupMember = useServerFn(addAzureGroupMember)
  const removeGroupMember = useServerFn(removeAzureGroupMember)
  const adding = mode === "add"
  const Icon = adding ? UserPlus : UserMinus

  const choices = useMemo<MemberChoice[]>(() => {
    const currentIds = new Set(group.members.map((member) => member.id))
    const members = adding
      ? directoryMembers.filter((member) => !currentIds.has(member.id))
      : group.members.map((member) => {
          const directoryMember = directoryMembers.find((candidate) => candidate.id === member.id)
          return {
            id: member.id,
            displayName: member.displayName,
            mail: directoryMember?.mail ?? null,
          }
        })
    return members.sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""))
  }, [adding, directoryMembers, group.members])

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) {
      setSelectedMember(null)
      setConfirmRemoval(false)
    }
  }

  async function updateMembership() {
    if (!selectedMember || pending) return
    setPending(true)
    try {
      const input = { data: { groupId: group.id, userId: selectedMember.id } }
      const result = adding ? await addGroupMember(input) : await removeGroupMember(input)
      if (result.error) {
        console.error(result.error)
        toast.error(mutationErrorMessage(result.error))
        return
      }

      toast.success(
        `${selectedMember.displayName ?? "Member"} ${adding ? "added to" : "removed from"} ${group.displayName}.`
      )
      setOpen(false)
      setSelectedMember(null)
      setConfirmRemoval(false)
      try {
        await router.invalidate({ sync: true })
      } catch (error) {
        console.error(error)
        toast.warning("The membership was updated, but the latest group data could not be refreshed.")
      }
    } catch (error) {
      console.error(error)
      toast.error(`There was an unexpected error while ${adding ? "adding" : "removing"} the member.`)
    } finally {
      setPending(false)
    }
  }

  const actionLabel = adding ? "Add member" : "Remove member"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  variant={adding ? "secondary" : "destructive"}
                  size="icon"
                  disabled={!adding && group.members.length === 0}
                  aria-label={`${actionLabel} ${adding ? "to" : "from"} ${group.displayName}`}
                />
              }
            />
          }
        >
          <Icon />
        </TooltipTrigger>
        <TooltipContent>{actionLabel}</TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{adding ? "Add a group member" : "Remove a group member"}</DialogTitle>
          <DialogDescription>
            Choose {adding ? "a directory user to add to" : "a member to remove from"}{" "}
            <span className="font-medium text-foreground">{group.displayName}</span>.
            {!adding && " Their Microsoft 365 account will not be deleted."}
          </DialogDescription>
        </DialogHeader>

        <Command className="h-72 rounded-lg ring-1 ring-foreground/10">
          <CommandInput placeholder="Search by name or email…" />
          <CommandList>
            <CommandEmpty>{adding ? "No available users found." : "No group members found."}</CommandEmpty>
            <CommandGroup heading={adding ? "Available users" : "Current members"}>
              {choices.map((member) => (
                <CommandItem
                  key={member.id}
                  value={`${member.displayName ?? "Unnamed user"} ${member.mail ?? ""}`}
                  data-checked={selectedMember?.id === member.id}
                  onSelect={() => {
                    setSelectedMember(member)
                    setConfirmRemoval(false)
                  }}
                >
                  <Avatar size="sm">
                    <AvatarFallback>{initials(member.displayName)}</AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{member.displayName ?? "Unnamed user"}</span>
                    {member.mail && <span className="truncate text-xs text-muted-foreground">{member.mail}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        {confirmRemoval && selectedMember && (
          <Alert variant="destructive">
            <AlertTitle>Remove {selectedMember.displayName ?? "this member"}?</AlertTitle>
            <AlertDescription>
              They will lose access to this Microsoft 365 group. Their account will not be deleted.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {confirmRemoval ? (
            <Button variant="outline" disabled={pending} onClick={() => setConfirmRemoval(false)}>
              Keep member
            </Button>
          ) : (
            <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
          )}
          <Button
            variant={adding ? "default" : "destructive"}
            onClick={() => {
              if (!adding && !confirmRemoval) {
                setConfirmRemoval(true)
                return
              }
              void updateMembership()
            }}
            disabled={!selectedMember || pending}
          >
            {pending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Icon data-icon="inline-start" />
            )}
            {pending ? (adding ? "Adding…" : "Removing…") : confirmRemoval ? "Remove member" : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function initials(name: string | null | undefined) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length === 0) return "?"
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function mutationErrorMessage(error: string) {
  if (error === "UNAUTHORIZED") return "You don't have permission to manage this group."
  return "Microsoft 365 could not complete the change. Please try again."
}
