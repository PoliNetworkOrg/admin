"use client"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { wait } from "@/lib/utils"
import { setAzureMemberNumber } from "@/server/actions/azure"

export function SetAssocNumberDialog({ userId }: { userId: string }) {
  const router = useRouter()
  const [value, setValue] = useState<string>("")
  const [open, setOpen] = useState<boolean>(false)

  function handleOpenChange(v: boolean): void {
    setOpen(v)
    setValue("")
  }

  const [pending, startTransition] = useTransition()

  async function handleSubmit() {
    if (pending || !value || Number.isNaN(parseInt(value, 10))) return

    const loading = toast.loading(`Updating...`)
    const res = await setAzureMemberNumber({ userId, assocNumber: parseInt(value, 10) })
    handleOpenChange(false)
    if (res.error !== null) {
      toast.error("There was an error")
      console.error(res.error)
      return
    }

    await wait(2000)
    toast.success(`Updated successfully!`, { id: loading })
    router.refresh()
    console.log("Updated user assocNumber", userId, value)
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            Set
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Assoc Number</DialogTitle>
          <DialogDescription>This changes the `employeeId` field in the Azure User properties.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-y-4" action={() => startTransition(handleSubmit)}>
          <div>
            <Label htmlFor="assoc-num">Member Number</Label>
            <Input
              className="max-w-sm"
              type="text"
              autoComplete="off"
              pattern="\d*"
              required
              title="Only numbers are allowed"
              id="assoc-num"
              placeholder="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <DialogFooter>
            <DialogClose
              render={
                <Button disabled={pending} variant="outline">
                  Cancel
                </Button>
              }
            ></DialogClose>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
