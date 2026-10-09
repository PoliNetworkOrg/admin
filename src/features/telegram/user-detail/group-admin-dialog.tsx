import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ConfirmDialog,
  FormDialog,
  FormField,
  InlineAlert,
  useOpenGeneration,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { failWith, refreshAfterMutation } from "@/components/telegram/telegram-user"
import { addTelegramGroupAdmin, removeTelegramGroupAdmin } from "@/features/telegram/users.functions"
import type { TgGroup } from "@/lib/api/types"

type AddGroupAdminDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  groups: TgGroup[]
  administeredGroupIds: ReadonlySet<number>
}

/** Pick one Telegram group for this user to administer. */
export function AddGroupAdminDialog(props: AddGroupAdminDialogProps) {
  const generation = useOpenGeneration(props.open)
  return <AddGroupAdminDialogBody key={generation} {...props} />
}

function AddGroupAdminDialogBody({
  open,
  onOpenChange,
  userId,
  groups,
  administeredGroupIds,
}: AddGroupAdminDialogProps) {
  const router = useRouter()
  const addGroupAdmin = useServerFn(addTelegramGroupAdmin)
  const [group, setGroup] = useState<TgGroup | null>(null)
  const available = groups.filter((candidate) => !administeredGroupIds.has(candidate.telegramId))
  const allTaken = available.length === 0

  async function submit() {
    if (!group) return
    await failWith(
      addGroupAdmin({ data: { userId, groupId: group.telegramId } }),
      "The user could not be added as a group administrator."
    )
    await refreshAfterMutation(router, "The administrator was added, but the latest user data could not be refreshed.")
    appToast.success("Group administrator added.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add group administrator"
      description="Choose a group this user should administer."
      noun="assignment"
      dirty={group !== null}
      submitLabel="Add administrator"
      canSubmit={group !== null && !allTaken}
      onSubmit={submit}
      notice={
        allTaken ? <InlineAlert tone="info">This user already administers every available group.</InlineAlert> : null
      }
    >
      <FormField label="Group" htmlFor="group-admin-group">
        <Combobox
          items={available}
          value={group}
          onValueChange={(next) => setGroup(next)}
          itemToStringLabel={(item: TgGroup) => item.title}
          itemToStringValue={(item: TgGroup) => String(item.telegramId)}
          isItemEqualToValue={(item: TgGroup, value: TgGroup) => item.telegramId === value.telegramId}
          disabled={allTaken}
        >
          <ComboboxInput id="group-admin-group" listLabel="groups" placeholder="Search groups…" disabled={allTaken} />
          <ComboboxContent>
            <ComboboxEmpty>No groups match</ComboboxEmpty>
            <ComboboxList>
              {(item: TgGroup) => (
                <ComboboxItem key={item.telegramId} value={item}>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="shrink-0 font-mono text-xs text-(--pn-fg-muted) tabular-nums">
                    {item.telegramId}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </FormField>
    </FormDialog>
  )
}

function groupAdminMutationError(error: string) {
  if (error === "NOT_FOUND") return "This assignment has already been removed."
  if (error === "UNAUTHORIZED_SELF_ASSIGN") return "You cannot remove this assignment from yourself."
  if (error === "UNAUTHORIZED") return "You do not have permission to remove this assignment."
  return "The group administrator assignment could not be removed."
}

type RemoveGroupAdminDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  userName: string
  groupId: number
  groupTitle: string
}

export function RemoveGroupAdminDialog({
  open,
  onOpenChange,
  userId,
  userName,
  groupId,
  groupTitle,
}: RemoveGroupAdminDialogProps) {
  const router = useRouter()
  const removeGroupAdmin = useServerFn(removeTelegramGroupAdmin)

  async function remove() {
    const result = await failWith(
      removeGroupAdmin({ data: { userId, groupId } }),
      "The group administrator assignment could not be removed."
    )
    if (result.error) {
      console.error(result.error)
      throw new Error(groupAdminMutationError(result.error))
    }
    await refreshAfterMutation(router, "The assignment was removed, but the latest user data could not be refreshed.")
    appToast.success("Group administrator removed.")
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Remove group administrator?"
      description={`${userName} will no longer administer ${groupTitle}. Other assignments do not change.`}
      confirmLabel="Remove administrator"
      onConfirm={remove}
    />
  )
}
