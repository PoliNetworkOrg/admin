"use client"
import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useTRPC } from "@/lib/trpc/client"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"

type Props = {
  trigger?: React.ReactNode
}

export function CreateAssocUser({ trigger }: Props) {
  const [open, setOpen] = useState<boolean>(false)
  const [firstName, setFirstName] = useState<string>("")
  const [lastName, setLastName] = useState<string>("")
  const [assocNumber, setAssocNumber] = useState<string>("")
  const [sendTo, setSendTo] = useState<string>("")
  const trpc = useTRPC()

  const { mutateAsync, isPending } = useMutation(trpc.azure.members.create.mutationOptions())

  function handleOpenChange(v: boolean): void {
    setOpen(v)
    setFirstName("")
    setLastName("")
    setAssocNumber("")
    setSendTo("")
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!assocNumber || Number.isNaN(parseInt(assocNumber, 10))) return

    const res = await mutateAsync({ assocNumber: parseInt(assocNumber, 10), firstName, lastName, sendEmailTo: sendTo })
    if (res.error !== null) {
      toast.error(res.error)
      return
    }

    console.log("Created user", res)
    toast.success(`User created, email: ${res.email}`, { duration: 10_000 })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger ?? <Button variant="outline">New Member</Button>}</SheetTrigger>
      <SheetContent className="sm:max-w-[40rem]">
        <SheetHeader>
          <SheetTitle>New Assoc Member</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="first-name">First Name</Label>
              <Input
                className="max-w-sm"
                type="text"
                autoFocus
                autoComplete="off"
                id="first-name"
                placeholder="Mario"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="last-name">Last Name</Label>
              <Input
                className="max-w-sm"
                type="text"
                autoComplete="off"
                id="last-name"
                placeholder="Rossi"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="assoc-num">Member Number</Label>
              <Input
                className="max-w-sm"
                type="text"
                autoComplete="off"
                pattern="\d*"
                title="Only numbers are allowed"
                id="assoc-num"
                placeholder="0"
                value={assocNumber}
                onChange={(e) => setAssocNumber(e.target.value)}
              />
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="send-to">Send Welcome Email to</Label>
              <Input
                className="max-w-sm"
                type="email"
                autoComplete="off"
                id="send-to"
                placeholder="mario.rossi@mail.polimi.it"
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter className="mt-4">
            <SheetClose asChild>
              <Button variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </SheetClose>
            <Button disabled={isPending}>{isPending ? "Saving..." : "Create"}</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
