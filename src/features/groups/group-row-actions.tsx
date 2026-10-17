import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LogOut, Pencil, Tags, Trash2 } from "lucide-react"
import { type ReactNode, useMemo, useRef, useState } from "react"

import { IconButton, InviteLinkActions, useFocusAfterRemoval, VisibilityToggle } from "@/components/primitives"
import { appToast, useCan } from "@/components/shell"
import { GroupLabelsDialog } from "@/features/group-labels/group-labels-dialog"
import { isCategoryLabel, labelPathToUrlSegments } from "@/features/group-labels/label-tree"
import type { GroupLabel } from "@/features/group-labels/types"
import { setGroupVisibility } from "@/features/telegram/groups.functions"
import { LeaveGroupDialog } from "@/features/telegram/leave-group-dialog"
import { DeleteWhatsappGroupDialog } from "@/features/whatsapp/delete-group-dialog"
import { setWhatsappGroupVisibility } from "@/features/whatsapp/groups.functions"
import { WhatsappGroupDialog } from "@/features/whatsapp/whatsapp-group-dialog"
import type { GroupWithLabels } from "@/lib/api/types"

/** Verbatim production copy, shown for any visibility failure (server codes are not user-facing). */
const VISIBILITY_ERROR = "The visibility setting could not be updated. Check your permissions and try again."

const groupActionHover = "hover:bg-(--pn-hover) hover:text-(--pn-accent)"

export function groupKey(group: Pick<GroupWithLabels, "type" | "id">) {
  return `${group.type}:${group.id}`
}

/** Label chips link to the category page or the tag page. */
export function labelLink(path: string) {
  if (isCategoryLabel(path)) {
    return <Link to="/dashboard/web/groups-by-label/$" params={{ _splat: labelPathToUrlSegments(path).join("/") }} />
  }
  return <Link to="/dashboard/web/tags/$tag" params={{ tag: path }} />
}

/** Label paths → `GroupLabel`s, in the loaded order; unknown paths are dropped. */
export function useLabelsByPath(labels: GroupLabel[]) {
  return useMemo(() => new Map(labels.map((label) => [label.label, label])), [labels])
}

export function resolveLabels(paths: string[], byPath: Map<string, GroupLabel>): GroupLabel[] {
  return paths.flatMap((path) => {
    const label = byPath.get(path)
    return label ? [label] : []
  })
}

/**
 * Width the actions column needs, with 32px cell padding: the invite slot (the copy/open pair, or the wider "Not
 * shared" badge, 100px), then a 1px separator with 6px on each side and 38px per further icon. Telegram rows have
 * three more icons, WhatsApp (and mixed) rows four; read-only rows only the invite slot.
 */
export function groupActionsWidth(icons: 3 | 4, canWrite: boolean) {
  if (!canWrite) return 32 + 100
  return 32 + 100 + 13 + icons * 38
}

/** `router.invalidate({ sync: true })` after a mutation; a failed reload is a warning, the mutation itself succeeded. */
export function useRefreshGroups() {
  const router = useRouter()
  return async (warning: string) => {
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      appToast.warning(warning)
    }
  }
}

type DialogKind = "labels" | "leave" | "edit" | "delete"

/**
 * Row-action state for a groups table: the optimistic visibility toggle (one in flight at a time, reverted on
 * failure) and the labels / leave / edit / delete dialogs. Render `dialogs` once next to the table, and wrap the table
 * in an element with `surfaceRef` and `tabIndex={-1}` so focus stays in the list after a leave or delete.
 */
export function useGroupActions(labels: GroupLabel[], groups: GroupWithLabels[]) {
  const refresh = useRefreshGroups()
  const setTelegramVisibility = useServerFn(setGroupVisibility)
  const setWhatsappVisibility = useServerFn(setWhatsappGroupVisibility)
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(new Map())
  const [toggling, setToggling] = useState<string | null>(null)
  const inFlight = useRef(false)
  const [target, setTarget] = useState<{ kind: DialogKind; group: GroupWithLabels } | null>(null)
  const [open, setOpen] = useState(false)
  const focus = useFocusAfterRemoval<HTMLDivElement>("tbody tr")

  function setOverride(key: string, hide: boolean | null) {
    setOverrides((current) => {
      const next = new Map(current)
      if (hide === null) next.delete(key)
      else next.set(key, hide)
      return next
    })
  }

  function isHidden(group: GroupWithLabels) {
    return overrides.get(groupKey(group)) ?? group.hide
  }

  async function toggleVisibility(group: GroupWithLabels) {
    if (inFlight.current) return
    inFlight.current = true
    const key = groupKey(group)
    const hide = !isHidden(group)
    setToggling(key)
    setOverride(key, hide)
    try {
      try {
        if (group.type === "tg") await setTelegramVisibility({ data: { telegramId: group.id, hide } })
        else await setWhatsappVisibility({ data: { id: group.id, hide } })
      } catch (error) {
        console.error(error)
        setOverride(key, null)
        appToast.error(VISIBILITY_ERROR)
        return
      }
      await refresh("The visibility was updated, but the latest group data could not be refreshed.")
      appToast.success(`${group.title} is now ${hide ? "hidden" : "visible"}.`)
      setOverride(key, null)
    } finally {
      inFlight.current = false
      setToggling(null)
    }
  }

  /** Pass the `trigger` of a leave or delete, whose row disappears once it is confirmed. */
  function show(kind: DialogKind, group: GroupWithLabels, trigger?: HTMLElement) {
    if (trigger) focus.capture(trigger)
    setTarget({ kind, group })
    setOpen(true)
  }

  // The target outlives `open` so the dialog keeps its content while it animates out; it follows the loaded row
  // (labels saved by a partial save) and keeps the snapshot once the row is gone (left, deleted).
  const dialogFor = (kind: DialogKind) => {
    if (target?.kind !== kind) return null
    const key = groupKey(target.group)
    return groups.find((group) => groupKey(group) === key) ?? target.group
  }
  const labelsGroup = dialogFor("labels")
  const leaveGroup = dialogFor("leave")
  const editGroup = dialogFor("edit")
  const deleteGroup = dialogFor("delete")

  const dialogs: ReactNode = (
    <>
      {labelsGroup && (
        <GroupLabelsDialog
          open={open}
          onOpenChange={setOpen}
          group={{ type: labelsGroup.type, id: labelsGroup.id, title: labelsGroup.title }}
          allLabels={labels}
          currentLabels={labelsGroup.labels}
          onSaved={() => refresh("The labels were saved, but the group list could not be refreshed.")}
        />
      )}
      {leaveGroup && (
        <LeaveGroupDialog
          open={open}
          onOpenChange={setOpen}
          group={{ telegramId: leaveGroup.id, title: leaveGroup.title }}
          finalFocus={focus.target}
          onLeft={() => refresh("The group was left, but the group list could not be refreshed.")}
        />
      )}
      {editGroup && (
        <WhatsappGroupDialog
          open={open}
          onOpenChange={setOpen}
          group={{ id: editGroup.id, title: editGroup.title, link: editGroup.link }}
          onSaved={() => refresh("The group was saved, but the group list could not be refreshed.")}
        />
      )}
      {deleteGroup && (
        <DeleteWhatsappGroupDialog
          open={open}
          onOpenChange={setOpen}
          group={{ id: deleteGroup.id, title: deleteGroup.title }}
          finalFocus={focus.target}
          onDeleted={() => refresh("The group was deleted, but the group list could not be refreshed.")}
        />
      )}
    </>
  )

  return {
    isHidden,
    isToggling: (group: GroupWithLabels) => toggling === groupKey(group),
    toggleVisibility,
    show,
    dialogs,
    surfaceRef: focus.surfaceRef,
  }
}

type GroupActions = ReturnType<typeof useGroupActions>

type GroupRowActionsProps = {
  group: GroupWithLabels
  controller: GroupActions
  canWrite: boolean
  /**
   * Keeps the icons of mixed Telegram/WhatsApp rows in the same columns: Telegram rows get an empty slot
   * where WhatsApp rows have "Edit group".
   */
  alignEdit?: boolean
}

/**
 * Per-platform cluster: copy/open invite link | visibility · edit labels · [edit] · leave/delete (other actions, then
 * edit, then the destructive one).
 * Without write access only the invite link remains.
 */
export function GroupRowActions({ group, controller, alignEdit = false }: GroupRowActionsProps) {
  const invite = <InviteLinkActions link={group.link} name={group.title} />
  const canLabels = useCan("groups:labels:write")
  const canTelegram = useCan("tg:groups:manage")
  const canWhatsapp = useCan("wa:groups:manage")
  const canManage = group.type === "tg" ? canTelegram : canWhatsapp
  if (!canLabels && !canManage) return invite

  return (
    <>
      {invite}
      <span aria-hidden className="mx-1.5 h-5 w-px shrink-0 bg-(--pn-line)" />
      {canManage && (
        <VisibilityToggle
          name={group.title}
          visible={!controller.isHidden(group)}
          pending={controller.isToggling(group)}
          className={groupActionHover}
          onToggle={() => void controller.toggleVisibility(group)}
        />
      )}
      {canLabels && (
        <IconButton
          label="Edit labels"
          ariaLabel={`Edit labels for ${group.title}`}
          icon={Tags}
          tone="warning"
          className={`text-(--pn-warning-fg) ${groupActionHover}`}
          onClick={() => controller.show("labels", group)}
        />
      )}
      {canManage &&
        (group.type === "wa" ? (
          <IconButton
            label="Edit group"
            ariaLabel={`Edit ${group.title}`}
            icon={Pencil}
            tone="success"
            className={`text-(--pn-success-fg) ${groupActionHover}`}
            onClick={() => controller.show("edit", group)}
          />
        ) : (
          alignEdit && <span aria-hidden className="size-9 shrink-0" />
        ))}
      {canManage &&
        (group.type === "tg" ? (
          <IconButton
            label="Leave group"
            ariaLabel={`Leave ${group.title}`}
            icon={LogOut}
            tone="danger"
            className={`text-(--pn-danger-fg) ${groupActionHover}`}
            onClick={(event) => controller.show("leave", group, event.currentTarget)}
          />
        ) : (
          <IconButton
            label="Delete group"
            ariaLabel={`Delete ${group.title}`}
            icon={Trash2}
            tone="danger"
            className={`text-(--pn-danger-fg) ${groupActionHover}`}
            onClick={(event) => controller.show("delete", group, event.currentTarget)}
          />
        ))}
    </>
  )
}
