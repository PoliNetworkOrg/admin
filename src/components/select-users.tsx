"use client"
import { useEffect, useState, useTransition } from "react"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { UserWithAccountProviders } from "@/server/actions/users"
import { Button } from "./ui/button"

type Props = {
  users: UserWithAccountProviders[]
  allowMultipleSelection?: boolean
  initialSelectedIds?: string[]
  selectAction?: (userIds: string[]) => Promise<void> // must end with "Action"
  max?: number
}

export function SelectUsers({ users, allowMultipleSelection, selectAction, initialSelectedIds = [], max }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds)
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState<boolean>(false)

  max = allowMultipleSelection ? max : 1

  useEffect(() => {
    setSelectedIds(initialSelectedIds)
  }, [initialSelectedIds])

  async function handleConfirm() {
    startTransition(async () => {
      await selectAction?.(selectedIds)
      handleOpenChange(false)
    })
  }

  function handleSelect(id: string) {
    const found = selectedIds.find((s) => s === id)
    if (found) setSelectedIds((a) => a.filter((s) => s !== id))
    else {
      setSelectedIds((a) => (allowMultipleSelection ? [...a, id] : [id]))
    }
  }

  function handleOpenChange(open: boolean) {
    setOpen(open)
    if (open === false) setSelectedIds(initialSelectedIds)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button disabled={isPending} variant="outline">
          Select {allowMultipleSelection ? "User(s)" : "User"}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-[40rem]">
        <SheetHeader>
          <SheetTitle>Select {allowMultipleSelection ? "User(s)" : "User"}</SheetTitle>
          {max && <SheetDescription> Max {max} selection(s)</SheetDescription>}
        </SheetHeader>
        <div className="grid gap-4 py-4">
          {users.map((u) => (
            <button
              type="button"
              key={u.id}
              onClick={() => handleSelect(u.id)}
              className={cn(
                "grid cursor-pointer select-none grid-cols-[1fr_2fr_1fr] rounded-md border border-accent px-4 py-2",
                selectedIds.find((s) => s === u.id) ? "bg-accent" : "hover:bg-accent/20"
              )}
            >
              <p>{u.name}</p>
              <p>{u.email}</p>
              <p>{u.accounts[0]?.provider}</p>
            </button>
          ))}
        </div>
        <SheetFooter className="mt-8">
          <SheetClose asChild>
            <Button variant="secondary" disabled={isPending}>
              Cancel
            </Button>
          </SheetClose>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Saving..." : "Confirm"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
