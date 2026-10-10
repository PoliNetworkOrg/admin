import { ChevronRight, Database, UserMinus, UserPlus } from "lucide-react"
import { type ReactNode, useDeferredValue, useId, useLayoutEffect, useMemo, useState } from "react"

import { AvatarGroup, EmptyState, IconButton, Reveal, SectionEmpty, Unset } from "@/components/primitives"
import { Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import type { AzureGroup, AzureMember } from "@/lib/api/types"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { MembershipDialog, type MembershipMode } from "./membership-dialog"

type SectionId = "multi" | "single"
type OpenState = { multi: boolean; single: boolean }

const OPEN_STATE_KEY = "pn:m365-groups:open"
const DEFAULT_OPEN: OpenState = { multi: true, single: false }

function readOpenState(): OpenState {
  const stored = window.sessionStorage.getItem(OPEN_STATE_KEY)
  if (stored === null) return DEFAULT_OPEN
  const [multi, single] = stored.split(",")
  return { multi: multi === "1", single: single === "1" }
}

function writeOpenState(state: OpenState) {
  window.sessionStorage.setItem(OPEN_STATE_KEY, `${state.multi ? 1 : 0},${state.single ? 1 : 0}`)
}

function matches(group: AzureGroup, query: string) {
  if (query === "") return true
  return `${group.displayName} ${group.mailAddress ?? ""}`.toLocaleLowerCase().includes(query)
}

type DialogTarget = { groupId: string; mode: MembershipMode }

/**
 * Microsoft 365 groups: groups with 2+ members and the rest, in two collapsibles. `directoryMembers` is null without
 * the member read permission, so there is no one to add.
 */
export function AzureGroupsPage({
  groups,
  directoryMembers,
}: {
  groups: AzureGroup[]
  directoryMembers: AzureMember[] | null
}) {
  const canWrite = useCan("azure:groups:write")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [openState, setOpenState] = useState(DEFAULT_OPEN)
  // The stored state is applied without animating, before the first paint on client navigations.
  const [restored, setRestored] = useState(false)
  const [dialog, setDialog] = useState<DialogTarget | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useLayoutEffect(() => {
    setOpenState(readOpenState())
    setRestored(true)
  }, [])

  const sorted = useMemo(() => groups.toSorted((a, b) => a.displayName.localeCompare(b.displayName)), [groups])
  const visible = sorted.filter((group) => matches(group, deferredQuery))
  const multi = visible.filter((group) => group.members.length > 1)
  const single = visible.filter((group) => group.members.length <= 1)
  const memberships = visible.reduce((sum, group) => sum + group.members.length, 0)
  const searching = deferredQuery !== ""

  function toggle(section: SectionId) {
    setOpenState((current) => {
      const next = { ...current, [section]: !current[section] }
      writeOpenState(next)
      return next
    })
  }

  function openDialog(groupId: string, mode: MembershipMode) {
    setDialog({ groupId, mode })
    setDialogOpen(true)
  }

  const rowProps = { canWrite, canAdd: directoryMembers !== null, onOpenDialog: openDialog }
  const dialogGroup = dialog ? groups.find((group) => group.id === dialog.groupId) : undefined
  const revealClass = restored ? undefined : "transition-none"

  function renderContent() {
    if (groups.length === 0) {
      return (
        <Surface>
          <EmptyState
            icon={Database}
            title="No Microsoft 365 groups yet"
            text="No groups were returned from Microsoft Entra."
          />
        </Surface>
      )
    }
    if (visible.length === 0) {
      return (
        <Surface>
          <EmptyState
            icon={Database}
            title="No groups match"
            text="Try another group name or email address."
            action={
              <Button size="sm" variant="ghost" onClick={() => setQuery("")}>
                Clear search
              </Button>
            }
          />
        </Surface>
      )
    }
    return (
      <div className="flex flex-col gap-4">
        {multi.length > 0 || !searching ? (
          <GroupSection
            title="Groups with 2+ members"
            emptyTitle="No groups with 2+ members"
            groups={multi}
            open={searching || openState.multi}
            onToggle={() => toggle("multi")}
            revealClassName={revealClass}
            {...rowProps}
          />
        ) : null}
        {single.length > 0 || !searching ? (
          <GroupSection
            title="Groups with 0–1 member"
            emptyTitle="No groups with 0–1 member"
            groups={single}
            open={searching || openState.single}
            onToggle={() => toggle("single")}
            revealClassName={revealClass}
            {...rowProps}
          />
        ) : null}
      </div>
    )
  }

  return (
    <>
      <PageBar
        left={
          <Toolbar
            search={{ value: query, onChange: setQuery }}
            count={
              <Count
                value={visible.length}
                total={searching ? groups.length : undefined}
                noun="group"
                parts={[{ value: memberships, noun: "membership" }]}
              />
            }
          />
        }
      />
      <PageContent>{renderContent()}</PageContent>
      {dialog && dialogGroup ? (
        <MembershipDialog
          key={`${dialog.groupId}:${dialog.mode}`}
          group={dialogGroup}
          directoryMembers={directoryMembers ?? []}
          mode={dialog.mode}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      ) : null}
    </>
  )
}

function Surface({ children }: { children: ReactNode }) {
  return <div className="rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface)">{children}</div>
}

type RowActionsProps = {
  canWrite: boolean
  canAdd: boolean
  onOpenDialog: (groupId: string, mode: MembershipMode) => void
}

type GroupSectionProps = RowActionsProps & {
  title: string
  emptyTitle: string
  groups: AzureGroup[]
  open: boolean
  onToggle: () => void
  revealClassName?: string
}

function GroupSection({ title, emptyTitle, groups, open, onToggle, revealClassName, ...rowProps }: GroupSectionProps) {
  const contentId = useId()
  return (
    <section className="overflow-hidden rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface)">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={onToggle}
          className="flex h-12 w-full items-center gap-2 px-5 text-left transition-[background-color] duration-120 hover:bg-(--pn-muted)"
        >
          <ChevronRight
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-(--pn-fg-muted) transition-transform duration-150 ease-(--pn-ease-out)",
              open && "rotate-90",
              revealClassName
            )}
          />
          <span className="text-[14px] leading-5 font-medium text-(--pn-fg)">{title}</span>
          <span className="text-[13px] text-(--pn-fg-muted) tabular-nums">{groups.length}</span>
        </button>
      </h2>
      <Reveal open={open} lazy className={revealClassName}>
        <ul id={contentId} aria-label={title} className="border-t border-(--pn-line)">
          {groups.length === 0 ? (
            <li>
              <SectionEmpty title={emptyTitle} />
            </li>
          ) : (
            groups.map((group) => <GroupRow key={group.id} group={group} {...rowProps} />)
          )}
        </ul>
      </Reveal>
    </section>
  )
}

function GroupRow({ group, canWrite, canAdd, onOpenDialog }: RowActionsProps & { group: AzureGroup }) {
  const people = useMemo(
    () =>
      group.members
        .map((member) => ({ id: member.id, name: member.displayName || "Unnamed user" }))
        .toSorted((a, b) => a.name.localeCompare(b.name)),
    [group.members]
  )
  const empty = group.members.length === 0
  return (
    <li className="@container flex h-14 items-center gap-4 border-b border-(--pn-line) px-5 transition-[background-color] duration-120 last:border-b-0 hover:bg-(--pn-muted)">
      <div className="flex min-w-0 flex-1 flex-col">
        <span title={group.displayName} className="truncate text-[13px] leading-5 font-medium text-(--pn-fg)">
          {group.displayName}
        </span>
        {group.mailAddress ? (
          <span title={group.mailAddress} className="truncate text-xs leading-4 text-(--pn-fg-muted)">
            {group.mailAddress}
          </span>
        ) : (
          <Unset className="text-xs leading-4" />
        )}
      </div>
      <span className="w-24 shrink-0 text-right text-xs whitespace-nowrap text-(--pn-fg-muted) tabular-nums">
        {pluralize(group.members.length, "member")}
      </span>
      <div className="hidden w-[212px] justify-end @min-[520px]:flex">
        <AvatarGroup people={people} listLabel={`Members of ${group.displayName}`} />
      </div>
      {canWrite ? (
        <div className="flex items-center gap-1">
          <IconButton
            label={canAdd ? "Add member" : "Adding members needs access to the member directory"}
            ariaLabel={canAdd ? `Add a member to ${group.displayName}` : undefined}
            icon={UserPlus}
            disabled={!canAdd}
            focusableWhenDisabled
            onClick={() => onOpenDialog(group.id, "add")}
          />
          <IconButton
            label={empty ? "No members to remove" : "Remove member"}
            ariaLabel={empty ? "No members to remove" : `Remove a member from ${group.displayName}`}
            icon={UserMinus}
            disabled={empty}
            focusableWhenDisabled
            onClick={() => onOpenDialog(group.id, "remove")}
          />
        </div>
      ) : null}
    </li>
  )
}
