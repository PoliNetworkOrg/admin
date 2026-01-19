"use client"

import { auth } from "@/lib/auth"
import { type FormEvent, useState } from "react"
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
import { useRouter } from "next/navigation"

export function SetName({ initialName }: { initialName?: string }) {
  const router = useRouter()
  const [name, setName] = useState<string>(initialName ?? "")
  const [open, setOpen] = useState<boolean>(false)

  async function handleUpdate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await auth.updateUser({ name })
    setOpen(false)
    router.refresh()
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button variant="outline">Set name</Button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Set your name</DialogTitle>
        <DialogDescription>
          Make changes to your profile here. Click save when you&apos;re
          done.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleUpdate}>
        <div className="grid gap-4">
          <div className="grid gap-3">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" type="text" autoComplete="name" value={name} onChange={e => setName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}

