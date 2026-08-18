import { ChevronDown, Info, Mail, UsersRound } from "lucide-react"
import { useMemo } from "react"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import type { AzureGroup, AzureMember } from "@/lib/api/types"
import { GroupMembership } from "./group-membership"

export function AzureGroupsPage({
  groups,
  directoryMembers,
}: {
  groups: AzureGroup[]
  directoryMembers: AzureMember[]
}) {
  return (
    <div className="animate-appear">
      <GroupsHeader groups={groups} />
      {groups.length ? (
        <GroupsList groups={groups} directoryMembers={directoryMembers} />
      ) : (
        <EmptyState
          icon={UsersRound}
          title="No Microsoft 365 groups yet"
          text="No groups were returned from Microsoft Entra."
        />
      )}
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

      <GroupMembership group={group} directoryMembers={directoryMembers} />
    </section>
  )
}

export function AzureGroupsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading Microsoft 365 groups</span>
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
