"use client"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
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

export function CreateAssocUser() {
  const [open, setOpen] = useState<boolean>(false)
  const [firstName, setFirstName] = useState<string>("")
  const [lastName, setLastName] = useState<string>("")
  const [assocNumber, setAssocNumber] = useState<string>("")
  const [sendTo, setSendTo] = useState<string>("")
  const trpc = useTRPC()
  const router = useRouter()

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
    router.refresh()
    handleOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={<Button variant="outline">New Member</Button>}></SheetTrigger>
      <SheetContent className="px-6 max-w-120">
        <SheetHeader className="px-0">
          <SheetTitle>Create new member account</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="first-name">First Name</Label>
              <Input
                type="text"
                autoFocus
                autoComplete="off"
                id="first-name"
                placeholder="Mario"
                value={firstName}
                required
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="last-name">Last Name</Label>
              <Input
                type="text"
                autoComplete="off"
                id="last-name"
                placeholder="Rossi"
                value={lastName}
                required
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="assoc-num">Member Number</Label>
              <Input
                type="text"
                autoComplete="off"
                pattern="\d*"
                title="Only numbers are allowed"
                id="assoc-num"
                placeholder="0"
                value={assocNumber}
                required
                onChange={(e) => setAssocNumber(e.target.value)}
              />
            </div>

            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="send-to">Send Welcome Email to</Label>
              <Input
                type="email"
                autoComplete="off"
                id="send-to"
                placeholder="mario.rossi@mail.polimi.it"
                value={sendTo}
                required
                onChange={(e) => setSendTo(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter className="mt-4 flex flex-row justify-end items-center">
            <SheetClose>
              <Button variant="ghost" disabled={isPending}>
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
