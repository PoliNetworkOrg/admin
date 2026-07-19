"use client"

import { ChevronDown, Info, LoaderCircle, Mail, UserMinus, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { addAzureGroupMember, removeAzureGroupMember } from "@/server/actions/azure"
import type { AzureGroup, AzureMember } from "@/server/trpc/types"

const MAX_VISIBLE_MEMBERS = 7

function initials(name: string | null | undefined) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length === 0) return "?"
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

function mutationErrorMessage(error: "UNAUTHORIZED" | "INTERNAL_SERVER_ERROR") {
  if (error === "UNAUTHORIZED") return "You don't have permission to manage this group."
  return "Microsoft 365 could not complete the change. Please try again."
}

export function GroupsList({ groups, directoryMembers }: { groups: AzureGroup[]; directoryMembers: AzureMember[] }) {
  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.displayName.localeCompare(b.displayName)), [groups])
  const multiMemberGroups = sortedGroups.filter((group) => group.members.length > 1)
  const singleMemberGroups = sortedGroups.filter((group) => group.members.length <= 1)
  const memberships = groups.reduce((count, group) => count + group.members.length, 0)

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex w-full flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Azure directory</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1 w-full">
            <div className="flex justify-between">
              <h1 className="text-3xl font-semibold tracking-tight">Microsoft 365 Groups</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{groups.length} groups</Badge>
                <Badge variant="secondary">{memberships} memberships</Badge>
              </div>
            </div>
            <Alert className="mt-2 " variant="info">
              <Info />
              <AlertTitle>Looking for single-member groups?</AlertTitle>
              <AlertDescription>
                Groups with exactly one member are collected in a collapsed section at the bottom of the page.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </header>

      {multiMemberGroups.length > 0 && (
        <Collapsible defaultOpen>
          <Card className="w-full gap-0 p-0">
            <CardHeader className="px-0">
              <CollapsibleTrigger
                render={
                  <Button variant="ghost" className="group h-auto w-full justify-between rounded-none px-4 py-4">
                    <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                      <span>Groups with 2+ members</span>
                      <span className="font-normal text-muted-foreground">
                        {multiMemberGroups.length} {singleMemberGroups.length === 1 ? "group" : "groups"}
                      </span>
                    </span>
                    <ChevronDown
                      data-icon="inline-end"
                      className="transition-transform group-aria-expanded:rotate-180"
                    />
                  </Button>
                }
              />
            </CardHeader>
            <CollapsibleContent render={<CardContent className="px-0" />}>
              {multiMemberGroups.map((group) => (
                <div key={group.id}>
                  <Separator />
                  <GroupRow group={group} directoryMembers={directoryMembers} />
                </div>
              ))}
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {singleMemberGroups.length > 0 && (
        <Collapsible>
          <Card className="w-full gap-0 p-0">
            <CardHeader className="px-0">
              <CollapsibleTrigger
                render={
                  <Button variant="ghost" className="group h-auto w-full justify-between rounded-none px-4 py-4">
                    <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                      <span>Groups with 0-1 member</span>
                      <span className="font-normal text-muted-foreground">
                        {singleMemberGroups.length} {singleMemberGroups.length === 1 ? "group" : "groups"}
                      </span>
                    </span>
                    <ChevronDown
                      data-icon="inline-end"
                      className="transition-transform group-aria-expanded:rotate-180"
                    />
                  </Button>
                }
              />
            </CardHeader>
            <CollapsibleContent render={<CardContent className="px-0" />}>
              {singleMemberGroups.map((group) => (
                <div key={group.id}>
                  <Separator />
                  <GroupRow group={group} directoryMembers={directoryMembers} />
                </div>
              ))}
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  )
}

function GroupRow({ group, directoryMembers }: { group: AzureGroup; directoryMembers: AzureMember[] }) {
  const sortedMembers = [...group.members].sort((a, b) => a.displayName.localeCompare(b.displayName))
  const visibleMembers = sortedMembers.slice(0, MAX_VISIBLE_MEMBERS)
  const hiddenMembers = sortedMembers.slice(MAX_VISIBLE_MEMBERS)

  return (
    <section className="grid gap-5 px-4 py-5 lg:grid-cols-[minmax(14rem,0.75fr)_minmax(0,1.25fr)] lg:items-center">
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="truncate text-base font-medium">{group.displayName}</h2>
          <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-3.5 shrink-0" />
            <span className="truncate">{group.mailAddress}</span>
          </div>
        </div>
        <Badge variant="secondary">
          {group.members.length} {group.members.length === 1 ? "member" : "members"}
        </Badge>
      </div>

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
        <div className="flex items-center gap-1">
          <AddMemberDialog group={group} directoryMembers={directoryMembers} />
          <RemoveMemberDialog group={group} directoryMembers={directoryMembers} />
        </div>
      </div>
    </section>
  )
}

function MemberAvatar({ member }: { member: AzureGroup["members"][number] }) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Avatar className="size-9 ring-2 ring-background">
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

function AddMemberDialog({ group, directoryMembers }: { group: AzureGroup; directoryMembers: AzureMember[] }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [selectedMember, setSelectedMember] = useState<AzureMember | null>(null)
  const router = useRouter()

  const availableMembers = useMemo(() => {
    const currentIds = new Set(group.members.map((member) => member.id))
    return directoryMembers
      .filter((member) => !currentIds.has(member.id))
      .sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""))
  }, [directoryMembers, group.members])

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) setSelectedMember(null)
  }

  async function addMember() {
    if (!selectedMember || pending) return

    setPending(true)
    try {
      const { error } = await addAzureGroupMember({ groupId: group.id, userId: selectedMember.id })
      if (error) {
        toast.error(mutationErrorMessage(error))
        return
      }

      toast.success(`${selectedMember.displayName ?? "Member"} added to ${group.displayName}.`)
      setOpen(false)
      setSelectedMember(null)
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("There was an unexpected error while adding the member.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={<Button variant="outline" size="icon-sm" aria-label={`Add a member to ${group.displayName}`} />}
            />
          }
        >
          <UserPlus />
        </TooltipTrigger>
        <TooltipContent>Add member</TooltipContent>
      </Tooltip>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a group member</DialogTitle>
          <DialogDescription>
            Choose a directory user to add to <span className="font-medium text-foreground">{group.displayName}</span>.
          </DialogDescription>
        </DialogHeader>

        <Command className="h-72 rounded-lg ring-1 ring-foreground/10">
          <CommandInput placeholder="Search by name or email…" />
          <CommandList>
            <CommandEmpty>No available users found.</CommandEmpty>
            <CommandGroup heading="Available users">
              {availableMembers.map((member) => (
                <CommandItem
                  key={member.id}
                  value={`${member.displayName ?? "Unnamed user"} ${member.mail ?? ""}`}
                  data-checked={selectedMember?.id === member.id}
                  onSelect={() => setSelectedMember(member)}
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

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            }
          />
          <Button onClick={addMember} disabled={!selectedMember || pending}>
            {pending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <UserPlus data-icon="inline-start" />
            )}
            {pending ? "Adding…" : "Add member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RemoveMemberDialog({ group, directoryMembers }: { group: AzureGroup; directoryMembers: AzureMember[] }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [selectedMember, setSelectedMember] = useState<AzureMember | null>(null)
  const router = useRouter()

  const currentMembers = useMemo(() => {
    const currentIds = new Set(group.members.map((member) => member.id))
    return directoryMembers
      .filter((member) => currentIds.has(member.id))
      .sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""))
  }, [directoryMembers, group.members])

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) setSelectedMember(null)
  }

  async function removeMember() {
    if (!selectedMember || pending) return

    setPending(true)
    try {
      const { error } = await removeAzureGroupMember({ groupId: group.id, userId: selectedMember.id })
      if (error) {
        toast.error(mutationErrorMessage(error))
        return
      }

      toast.success(`${selectedMember.displayName ?? "Member"} removed from ${group.displayName}.`)
      setOpen(false)
      setSelectedMember(null)
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("There was an unexpected error while removing the member.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={group.members.length === 0}
                  aria-label={`Remove a member from ${group.displayName}`}
                />
              }
            />
          }
        >
          <UserMinus />
        </TooltipTrigger>
        <TooltipContent>Remove member</TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove a group member</DialogTitle>
          <DialogDescription>
            Choose a member to remove from <span className="font-medium text-foreground">{group.displayName}</span>.
            Their Microsoft 365 account will not be deleted.
          </DialogDescription>
        </DialogHeader>

        <Command className="h-72 rounded-lg ring-1 ring-foreground/10">
          <CommandInput placeholder="Search by name or email…" />
          <CommandList>
            <CommandEmpty>No group members found.</CommandEmpty>
            <CommandGroup heading="Current members">
              {currentMembers.map((member) => (
                <CommandItem
                  key={member.id}
                  value={`${member.displayName ?? "Unnamed user"} ${member.mail ?? ""}`}
                  data-checked={selectedMember?.id === member.id}
                  onSelect={() => setSelectedMember(member)}
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

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={pending}>
                Cancel
              </Button>
            }
          />
          <Button variant="destructive" onClick={removeMember} disabled={!selectedMember || pending}>
            {pending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <UserMinus data-icon="inline-start" />
            )}
            {pending ? "Removing…" : "Remove member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
