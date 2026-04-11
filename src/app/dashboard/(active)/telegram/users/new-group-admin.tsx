"use client"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus, Search, X } from "lucide-react"
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select"
import { useSession } from "@/lib/auth"
import { useTRPC } from "@/lib/trpc/client"
import type { ApiOutput } from "@/lib/trpc/types"

type Groups = ApiOutput["tg"]["groups"]["search"]["groups"]
type User = ApiOutput["tg"]["users"]["getByUsername"]["user"]

export function NewGroupAdmin({ user, alreadyIn }: { user: User; alreadyIn: number[] }) {
  const sesh = useSession()
  const adderId = sesh.data?.user.telegramId

  const trpc = useTRPC()
  const qc = useQueryClient()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [groupQuery, setGroupQuery] = useState("")
  const [groups, setGroups] = useState<Groups>([])
  const [selectedGroup, setSelectedGroup] = useState<Groups[number] | null>(null)

  const queryOpts = trpc.tg.groups.search.queryOptions({ query: groupQuery, limit: 20, showHidden: true })

  async function searchGroup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const res = await qc.fetchQuery(queryOpts)
    setGroups(res.groups.filter((g) => !alreadyIn.includes(g.telegramId)))
    if (res.count === 0) toast.warning("No groups found with this query")
    else toast.info(`Found ${res.count} groups`)
  }

  const submitMutation = useMutation(trpc.tg.permissions.addGroup.mutationOptions())

  async function submit() {
    if (!adderId) return toast.warning("Invalid session, try reloading the page")
    if (!selectedGroup) return toast.warning("No group selected, cannot proceed")
    if (!user) return toast.warning("Invalid user, try restarting the dialog")

    try {
      await submitMutation.mutateAsync({ adderId, groupId: selectedGroup?.telegramId, userId: user.id })
      toast.info(`Group admin added`)
      handleOpenChange(false)
      router.refresh()
    } catch (err) {
      console.error(err)
      handleOpenChange(false)
      toast.error("There was an error, check logs")
    }
  }

  function reset() {
    setGroups([])
    setGroupQuery("")
    setSelectedGroup(null)
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (v === false) {
      // closing
      qc.invalidateQueries(trpc.tg.permissions.getRoles.queryOptions({ userId: user?.id ?? 0 }))
      reset()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Plus size={20} /> New
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New Group Admin</DialogTitle>
          <DialogDescription>Make the user admin in a group.</DialogDescription>
        </DialogHeader>
        {user && (
          <p>
            Target: {user.firstName} {user.username && `@${user.username}`} [{user.id}]
          </p>
        )}

        <form onSubmit={searchGroup} className="pt-2 gap-y-4 flex flex-col justify-start items-start">
          <div className="flex gap-2 flex-col items-start justify-start w-full">
            <Label htmlFor="group-query" className="text-base">
              Search Group
            </Label>
            <div className="flex gap-2 items-center justify-start w-full">
              <Input
                id="group-query"
                type="text"
                name="group-query"
                placeholder="Group name"
                className="bg-card w-auto"
                disabled={groups.length > 0}
                required
                onChange={(e) => {
                  setGroupQuery(e.target.value)
                }}
                value={groupQuery}
              />
              <Button type="submit" size="icon">
                <Search />
              </Button>
              <div className="grow" />
              {groups.length > 0 && (
                <Button variant="outline" onClick={reset} className="justify-self-end">
                  <X />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </form>

        {groups && (
          <Select
            items={groups.map((g) => ({ value: g, label: g.title }))}
            value={selectedGroup}
            onValueChange={(v) => setSelectedGroup(v)}
            disabled={groups.length === 0}
          >
            <SelectTrigger className="w-full">{selectedGroup?.title ?? "Select a group"}</SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {groups.map((item) => (
                  <SelectItem key={item.telegramId} value={item}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={submit} disabled={!selectedGroup}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
