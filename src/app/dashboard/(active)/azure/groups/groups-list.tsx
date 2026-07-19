"use client"

import { LoaderCircle, Mail, UserMinus, UserPlus, UsersRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Spinner } from "@/components/spinner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  const memberships = groups.reduce((count, group) => count + group.members.length, 0)

  return (
    <div className="flex w-full flex-col gap-6">
      <header className="flex w-full flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Azure directory</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold tracking-tight">Microsoft 365 Groups</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Review group membership and keep access up to date from one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{groups.length} groups</Badge>
            <Badge variant="secondary">{memberships} memberships</Badge>
          </div>
        </div>
      </header>

      <Card className="w-full gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Directory groups</CardTitle>
          <CardDescription>
            Group details are shown on the left, with members and controls on the right.
          </CardDescription>
          <CardAction>
            <Badge variant="outline">
              <UsersRound data-icon="inline-start" />
              Live directory
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {sortedGroups.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 text-center">
              <UsersRound className="size-8 text-muted-foreground" />
              <p className="font-medium">No Microsoft 365 groups found</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Groups will appear here as soon as they are available in the Azure directory.
              </p>
            </div>
          ) : (
            sortedGroups.map((group, index) => (
              <div key={group.id}>
                {index > 0 && <Separator />}
                <GroupRow group={group} directoryMembers={directoryMembers} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function GroupRow({ group, directoryMembers }: { group: AzureGroup; directoryMembers: AzureMember[] }) {
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
          <AvatarGroup className="flex-wrap pl-2 sm:justify-end">
            {[...group.members]
              .sort((a, b) => a.displayName.localeCompare(b.displayName))
              .map((member) => (
                <RemoveMemberButton key={member.id} group={group} member={member} />
              ))}
          </AvatarGroup>
        ) : (
          <p className="text-sm text-muted-foreground">No members yet</p>
        )}
        <AddMemberDialog group={group} directoryMembers={directoryMembers} />
      </div>
    </section>
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
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <UserPlus data-icon="inline-start" />
            Add member
          </Button>
        }
      />
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

function RemoveMemberButton({ group, member }: { group: AzureGroup; member: AzureGroup["members"][number] }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  async function removeMember() {
    if (pending) return

    setPending(true)
    try {
      const { error } = await removeAzureGroupMember({ groupId: group.id, userId: member.id })
      if (error) {
        toast.error(mutationErrorMessage(error))
        return
      }

      toast.success(`${member.displayName} removed from ${group.displayName}.`)
      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("There was an unexpected error while removing the member.")
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="rounded-full outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-label={`Remove ${member.displayName} from ${group.displayName}`}
              onClick={() => setOpen(true)}
            />
          }
        >
          <Avatar className="size-9">
            <AvatarFallback>{initials(member.displayName)}</AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent>
          <span>{member.displayName}</span>
          <span className="text-background/70">Click to remove</span>
        </TooltipContent>
      </Tooltip>

      <AlertDialog open={open} onOpenChange={(nextOpen) => !pending && setOpen(nextOpen)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <UserMinus />
            </AlertDialogMedia>
            <AlertDialogTitle>Remove group member?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <span className="font-medium text-foreground">{member.displayName}</span> from{" "}
              {group.displayName}. Their Microsoft 365 account will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={removeMember} disabled={pending}>
              {pending ? <Spinner className="size-4" /> : <UserMinus data-icon="inline-start" />}
              {pending ? "Removing…" : "Remove member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
