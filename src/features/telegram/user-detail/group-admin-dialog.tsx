import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { addTelegramGroupAdmin, removeTelegramGroupAdmin } from "@/features/telegram/users.functions"

import type { TelegramUserDetail } from "./types"

export function AddGroupAdminDialog({
  open,
  userId,
  groups,
  administeredGroupIds,
  onClose,
  onSaved,
}: {
  open: boolean
  userId: number
  groups: TelegramUserDetail["groups"]
  administeredGroupIds: Set<number>
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [groupId, setGroupId] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const addGroupAdmin = useServerFn(addTelegramGroupAdmin)
  const availableGroups = groups.filter((group) => !administeredGroupIds.has(group.telegramId))

  useEffect(() => {
    if (open) {
      setGroupId("")
      setError("")
    }
  }, [open])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!groupId) return
    setPending(true)
    setError("")
    try {
      await addGroupAdmin({ data: { userId, groupId: Number(groupId) } })
      await onSaved()
    } catch (error) {
      console.error(error)
      setError("The user could not be added as a group administrator.")
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto border-border p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <p className="font-mono text-[10px] font-medium tracking-[0.13em] text-muted-foreground">
            GROUP ADMINISTRATION
          </p>
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">Add group administrator</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Choose a group this user should administer.
          </DialogDescription>
        </DialogHeader>
        <form className="px-6 py-5" onSubmit={(event) => void submit(event)}>
          <Field>
            <FieldLabel htmlFor="admin-group" className="font-mono text-[10px] font-medium text-muted-foreground">
              Group
            </FieldLabel>
            <Combobox
              items={availableGroups}
              value={availableGroups.find((group) => String(group.telegramId) === groupId) ?? null}
              onValueChange={(group) => setGroupId(group ? String(group.telegramId) : "")}
              itemToStringLabel={(group) => group.title}
              itemToStringValue={(group) => String(group.telegramId)}
              disabled={!availableGroups.length}
            >
              <ComboboxInput id="admin-group" placeholder="Search groups…" required className="h-10 text-xs" />
              <ComboboxContent>
                <ComboboxEmpty>No matching groups</ComboboxEmpty>
                <ComboboxList>
                  {(group) => (
                    <ComboboxItem key={group.telegramId} value={group} className="text-xs">
                      <span>{group.title}</span>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
          {!availableGroups.length && (
            <p className="mt-3 text-[10px] text-muted-foreground">
              This user already administers every available group.
            </p>
          )}
          {error && <p className="mt-3 text-[10px] text-destructive">{error}</p>}
          <DialogFooter className="-mx-6 -mb-5 mt-5 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" className="text-[11px]" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="text-[11px]" disabled={pending || !availableGroups.length || !groupId}>
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
              Add administrator
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function RemoveGroupAdminDialog({
  userId,
  groupId,
  groupTitle,
  onSaved,
}: {
  userId: number
  groupId: number
  groupTitle: string
  onSaved: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const removeGroupAdmin = useServerFn(removeTelegramGroupAdmin)

  async function remove() {
    setPending(true)
    setError("")
    try {
      const result = await removeGroupAdmin({ data: { userId, groupId } })
      if (result.error) {
        console.error(result.error)
        setError(groupAdminMutationError(result.error))
        return
      }
      setOpen(false)
      await onSaved()
    } catch (error) {
      console.error(error)
      setError("The group administrator assignment could not be removed.")
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return
        setOpen(nextOpen)
        if (!nextOpen) setError("")
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive" size="xs" />}>Remove</AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove group administrator?</AlertDialogTitle>
          <AlertDialogDescription>
            This user will no longer administer {groupTitle}. Their other group assignments will not change.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pending} onClick={() => void remove()}>
            {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
            Remove assignment
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function groupAdminMutationError(error: string) {
  if (error === "NOT_FOUND") return "This assignment has already been removed."
  if (error === "UNAUTHORIZED_SELF_ASSIGN") return "You cannot remove this assignment from yourself."
  if (error === "UNAUTHORIZED") return "You do not have permission to remove this assignment."
  return "The group administrator assignment could not be removed."
}
