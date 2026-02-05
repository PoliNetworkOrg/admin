import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState } from "react"
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
import { useTRPC } from "@/lib/trpc/client"

export function SetAssocNumberDialog({ userId, children }: { userId: string; children?: React.ReactNode }) {
  const [value, setValue] = useState<string>("")
  const [open, setOpen] = useState<boolean>(false)
  const trpc = useTRPC()
  const _router = useRouter()

  const qc = useQueryClient()
  const { mutateAsync, isPending } = useMutation(trpc.azure.members.setAssocNumber.mutationOptions())

  function handleOpenChange(v: boolean): void {
    setOpen(v)
    setValue("")
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    console.log("submit")
    e.preventDefault()
    if (isPending || !value || Number.isNaN(parseInt(value, 10))) return

    const res = await mutateAsync({ userId, assocNumber: parseInt(value, 10) })
    handleOpenChange(false)
    if (res.error !== null) {
      toast.error("There was an error")
      console.error(res.error)
      return
    }

    console.log("Updated user assocNumber", userId, value)
    await qc.invalidateQueries({ queryKey: trpc.azure.members.getAll.queryKey() })
    toast.success(`Updated successfully!`)
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{children ?? <Button variant="outline">Set</Button>}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Assoc Number</DialogTitle>
          <DialogDescription>This changes the `employeeId` field in the Azure User properties.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-y-4" onSubmit={handleSubmit}>
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
            <DialogClose asChild>
              <Button disabled={isPending} variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
