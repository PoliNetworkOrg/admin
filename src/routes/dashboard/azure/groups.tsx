import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ChevronDown, Info, LoaderCircle, Mail, UserMinus, UserPlus, UsersRound } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { PageHeader } from "@/components/page-header"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AzureGroup, AzureMember } from "@/lib/api/types"
import { addAzureGroupMember, getAzureGroups, getAzureMembers, removeAzureGroupMember } from "@/server/api.functions"

const MAX_VISIBLE_MEMBERS = 7

type MembershipError = "UNAUTHORIZED" | "INTERNAL_SERVER_ERROR"
type MembershipAction = (options: {
  data: { groupId: string; userId: string }
}) => Promise<{ error: MembershipError | null }>
type MemberChoice = Pick<AzureMember, "id" | "displayName" | "mail">

export const Route = createFileRoute("/dashboard/azure/groups")({
  loader: async () => {
    const [groups, members] = await Promise.all([getAzureGroups(), getAzureMembers()])
    return { groups, members }
  },
  head: () => ({ meta: [{ title: "Microsoft 365 Groups | PoliNetwork Admin" }] }),
  pendingComponent: AzureGroupsSkeleton,
  component: AzureGroupsPage,
})

function AzureGroupsPage() {
  const response = Route.useLoaderData()
  const groups = (response.groups.data ?? []) as AzureGroup[]
  const directoryMembers = (response.members.data ?? []) as AzureMember[]
  const connected = response.groups.connected && response.members.connected

  return (
    <div className="animate-appear">
      <GroupsHeader groups={groups} />
      <LiveStatus
        connected={connected}
        message={!response.groups.connected ? response.groups.message : response.members.message}
      />
      {connected &&
        (groups.length ? (
          <GroupsList groups={groups} directoryMembers={directoryMembers} />
        ) : (
          <EmptyState
            icon={UsersRound}
            title="No Microsoft 365 groups yet"
            text="No groups were returned from Microsoft Entra."
          />
        ))}
    </div>
  )
}

function GroupsHeader({ groups }: { groups: AzureGroup[] }) {
  const memberships = groups.reduce((count, group) => count + group.members.length, 0)

  return (
    <>
      <PageHeader
        eyebrow="Azure directory"
        title="Microsoft 365 groups"
        description="Review directory groups and manage the members who can access their shared Microsoft 365 resources."
        action={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{groups.length} groups</Badge>
            <Badge variant="secondary">{memberships} memberships</Badge>
          </div>
        }
      />
      <Alert className="my-5">
        <Info />
        <AlertTitle>Looking for groups with zero or one member?</AlertTitle>
        <AlertDescription>They are collected in the collapsed section at the bottom of the page.</AlertDescription>
      </Alert>
    </>
  )
}

function GroupsList({ groups, directoryMembers }: { groups: AzureGroup[]; directoryMembers: AzureMember[] }) {
  const sortedGroups = useMemo(() => [...groups].sort((a, b) => a.displayName.localeCompare(b.displayName)), [groups])
  const multiMemberGroups = sortedGroups.filter((group) => group.members.length > 1)
  const singleMemberGroups = sortedGroups.filter((group) => group.members.length <= 1)

  return (
    <div className="flex w-full flex-col gap-5">
      {multiMemberGroups.length > 0 && (
        <GroupSection
          title="Groups with 2+ members"
          groups={multiMemberGroups}
          directoryMembers={directoryMembers}
          defaultOpen
        />
      )}
      {singleMemberGroups.length > 0 && (
        <GroupSection title="Groups with 0–1 member" groups={singleMemberGroups} directoryMembers={directoryMembers} />
      )}
    </div>
  )
}

function GroupSection({
  title,
  groups,
  directoryMembers,
  defaultOpen = false,
}: {
  title: string
  groups: AzureGroup[]
  directoryMembers: AzureMember[]
  defaultOpen?: boolean
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <Card className="w-full gap-0 p-0">
        <CardHeader className="px-0">
          <CollapsibleTrigger
            render={<Button variant="ghost" className="group h-auto w-full justify-between rounded-none px-4 py-4" />}
          >
            <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
              <span>{title}</span>
              <span className="font-normal text-muted-foreground">
                {groups.length} {groups.length === 1 ? "group" : "groups"}
              </span>
            </span>
            <ChevronDown className="transition-transform group-aria-expanded:rotate-180" />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent render={<CardContent className="px-0" />}>
          {groups.map((group) => (
            <div key={group.id}>
              <Separator />
              <GroupRow group={group} directoryMembers={directoryMembers} />
            </div>
          ))}
        </CollapsibleContent>
      </Card>
    </Collapsible>
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
          {group.mailAddress && (
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="size-3.5 shrink-0" />
              <span className="truncate">{group.mailAddress}</span>
            </div>
          )}
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
          <MembershipDialog group={group} directoryMembers={directoryMembers} mode="add" />
          <MembershipDialog group={group} directoryMembers={directoryMembers} mode="remove" />
        </div>
      </div>
    </section>
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
  const router = useRouter()
  const adding = mode === "add"
  const Icon = adding ? UserPlus : UserMinus
  const action: MembershipAction = adding ? addAzureGroupMember : removeAzureGroupMember

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
    if (!nextOpen) setSelectedMember(null)
  }

  async function updateMembership() {
    if (!selectedMember || pending) return
    setPending(true)
    try {
      const result = await action({ data: { groupId: group.id, userId: selectedMember.id } })
      if (result.error) {
        toast.error(mutationErrorMessage(result.error))
        return
      }

      toast.success(
        `${selectedMember.displayName ?? "Member"} ${adding ? "added to" : "removed from"} ${group.displayName}.`
      )
      setOpen(false)
      setSelectedMember(null)
      await router.invalidate({ sync: true })
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
          <DialogClose render={<Button variant="outline" disabled={pending} />}>Cancel</DialogClose>
          <Button
            variant={adding ? "default" : "destructive"}
            onClick={() => void updateMembership()}
            disabled={!selectedMember || pending}
          >
            {pending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Icon data-icon="inline-start" />
            )}
            {pending ? (adding ? "Adding…" : "Removing…") : actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AzureGroupsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="flex items-start justify-between gap-8 max-[640px]:flex-col">
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-4 w-112 max-w-full" />
        </div>
        <Skeleton className="h-6 w-48" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Card className="w-full gap-0 p-0">
        <CardHeader className="flex flex-col gap-2 py-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-20" />
        </CardHeader>
        <CardContent className="px-0">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index}>
              <Separator />
              <div className="grid gap-5 px-4 py-5 lg:grid-cols-2 lg:items-center">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-48 max-w-full" />
                  <Skeleton className="h-4 w-56 max-w-full" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="flex items-center gap-2 lg:justify-end">
                  {Array.from({ length: 5 }, (_, avatarIndex) => (
                    <Skeleton key={avatarIndex} className="size-9 rounded-full" />
                  ))}
                  <Skeleton className="size-10" />
                  <Skeleton className="size-10" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
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

function mutationErrorMessage(error: MembershipError) {
  if (error === "UNAUTHORIZED") return "You don't have permission to manage this group."
  return "Microsoft 365 could not complete the change. Please try again."
}
