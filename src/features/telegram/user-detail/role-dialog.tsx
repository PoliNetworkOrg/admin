import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle, Minus, Plus } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { addTelegramUserRole, removeTelegramUserRole } from "@/features/telegram/users.functions"
import type { TgUserRole } from "@/lib/api/types"

function roleLabel(role: TgUserRole) {
  return role
    .split("_")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ")
}

export function RoleDialog({
  mode,
  userId,
  roles,
  configuredRoles,
}: {
  mode: "add" | "remove"
  userId: number
  roles: TgUserRole[]
  configuredRoles: TgUserRole[]
}) {
  const [open, setOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<TgUserRole | null>(null)
  const [pending, setPending] = useState(false)
  const router = useRouter()
  const addUserRole = useServerFn(addTelegramUserRole)
  const removeUserRole = useServerFn(removeTelegramUserRole)
  const adding = mode === "add"
  const choices = (adding ? configuredRoles.filter((role) => !roles.includes(role)) : roles).map((role) => ({
    value: role,
    label: roleLabel(role),
  }))
  const selectedChoice = choices.find((choice) => choice.value === selectedRole) ?? null
  const Icon = adding ? Plus : Minus

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return
    setOpen(nextOpen)
    if (!nextOpen) setSelectedRole(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!selectedRole || pending) return
    setPending(true)

    try {
      const action = adding ? addUserRole : removeUserRole
      const result = await action({ data: { userId, role: selectedRole } })
      if (result.error) {
        console.error(result.error)
        toast.error(roleMutationError(result.error, adding))
        return
      }

      toast.success(`${roleLabel(selectedRole)} role ${adding ? "assigned" : "removed"}.`)
      setOpen(false)
      setSelectedRole(null)
      try {
        await router.invalidate({ sync: true })
      } catch (refreshError) {
        console.error(refreshError)
        toast.warning("The role was updated, but the latest user data could not be refreshed.")
      }
    } catch (error) {
      console.error(error)
      toast.error(`The role could not be ${adding ? "assigned" : "removed"}. Check your permissions and try again.`)
    } finally {
      setPending(false)
    }
  }

  const actionLabel = adding ? "Assign role" : "Remove role"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant={adding ? "outline" : "destructive"}
            size="xs"
            disabled={!choices.length}
            aria-label={
              choices.length ? actionLabel : adding ? "All configured roles are assigned" : "No roles to remove"
            }
          />
        }
      >
        <Icon /> {actionLabel}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto border-border p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <p className="font-mono text-[10px] font-medium tracking-[0.13em] text-muted-foreground">USER ROLES</p>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">{actionLabel}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {adding
              ? "Choose one of the roles currently configured for Telegram users."
              : "Choose an assigned role to remove from this user."}
          </DialogDescription>
        </DialogHeader>
        <form className="px-6 py-5" onSubmit={(event) => void submit(event)}>
          <Field>
            <FieldLabel htmlFor={`${mode}-user-role`} className="font-mono text-[10px] text-muted-foreground">
              Role
            </FieldLabel>
            <Combobox
              items={choices}
              value={selectedChoice}
              onValueChange={(choice) => setSelectedRole(choice?.value ?? null)}
              itemToStringLabel={(choice) => choice.label}
              itemToStringValue={(choice) => choice.value}
            >
              <ComboboxInput
                id={`${mode}-user-role`}
                placeholder={adding ? "Search configured roles…" : "Search assigned roles…"}
                required
                className="h-10 text-xs"
              />
              <ComboboxContent>
                <ComboboxEmpty>{adding ? "No available roles" : "No assigned roles"}</ComboboxEmpty>
                <ComboboxList>
                  {(choice) => (
                    <ComboboxItem key={choice.value} value={choice} className="text-xs">
                      {choice.label}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
          <DialogFooter className="-mx-6 -mb-5 mt-5 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={adding ? "default" : "destructive"}
              size="sm"
              disabled={!selectedRole || pending}
            >
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
              {actionLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function roleMutationError(error: string, adding: boolean) {
  if (error === "UNAUTHORIZED_SELF_ASSIGN") return `You cannot ${adding ? "assign" : "remove"} this role on yourself.`
  if (error === "NOT_FOUND") return "That role is no longer assigned to this user."
  if (error === "UNAUTHORIZED") return "You do not have permission to manage this role."
  return "The role update could not be completed."
}
