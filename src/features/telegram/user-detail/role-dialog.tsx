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
  FormDialog,
  FormField,
  useOpenGeneration,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { failWith, refreshAfterMutation } from "@/components/telegram/telegram-user"
import { addTelegramUserRole, removeTelegramUserRole } from "@/features/telegram/users.functions"
import type { TgUserRole } from "@/lib/api/types"

export type RoleDialogMode = "add" | "remove"

type RoleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: RoleDialogMode
  userId: number
  roles: TgUserRole[]
  configuredRoles: TgUserRole[]
}

function roleLabel(role: TgUserRole) {
  return role
    .split("_")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ")
}

function roleMutationError(error: string, adding: boolean) {
  if (error === "UNAUTHORIZED_SELF_ASSIGN") return `You cannot ${adding ? "assign" : "remove"} this role on yourself.`
  if (error === "NOT_FOUND") return "That role is no longer assigned to this user."
  if (error === "UNAUTHORIZED") return "You do not have permission to manage this role."
  return "The role update could not be completed."
}

/** Assign or remove one Telegram role. Backend errors show inside the dialog verbatim. */
export function RoleDialog(props: RoleDialogProps) {
  const generation = useOpenGeneration(props.open)
  return <RoleDialogBody key={generation} {...props} />
}

function RoleDialogBody({ open, onOpenChange, mode, userId, roles, configuredRoles }: RoleDialogProps) {
  const router = useRouter()
  const addRole = useServerFn(addTelegramUserRole)
  const removeRole = useServerFn(removeTelegramUserRole)
  const [role, setRole] = useState<TgUserRole | null>(null)
  const adding = mode === "add"
  const choices = adding ? configuredRoles.filter((candidate) => !roles.includes(candidate)) : roles
  const title = adding ? "Assign role" : "Remove role"
  const inputId = `role-dialog-${mode}`

  async function submit() {
    if (!role) return
    const mutate = adding ? addRole : removeRole
    const result = await failWith(
      mutate({ data: { userId, role } }),
      `The role could not be ${adding ? "assigned" : "removed"}. Check your permissions and try again.`
    )
    if (result.error) {
      console.error(result.error)
      throw new Error(roleMutationError(result.error, adding))
    }
    await refreshAfterMutation(router, "The role was updated, but the latest user data could not be refreshed.")
    appToast.success(`${roleLabel(role)} role ${adding ? "assigned" : "removed"}.`)
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={
        adding
          ? "Choose one of the roles currently configured for Telegram users."
          : "Choose an assigned role to remove from this user."
      }
      noun="role"
      dirty={role !== null}
      submitLabel={title}
      canSubmit={role !== null}
      onSubmit={submit}
    >
      <FormField label="Role" htmlFor={inputId}>
        <Combobox items={choices} value={role} onValueChange={(next) => setRole(next)}>
          <ComboboxInput
            id={inputId}
            listLabel="roles"
            placeholder={adding ? "Search configured roles…" : "Search assigned roles…"}
          />
          <ComboboxContent>
            <ComboboxEmpty>No roles match</ComboboxEmpty>
            <ComboboxList>
              {(choice: TgUserRole) => (
                <ComboboxItem key={choice} value={choice}>
                  {choice}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </FormField>
    </FormDialog>
  )
}
