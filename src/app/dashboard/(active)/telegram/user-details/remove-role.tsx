"use client"
import { USER_ROLE } from "@polinetwork/backend"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Minus, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSession } from "@/lib/auth"
// import { useTRPC } from "@/server/trpc"
import type { ApiOutput } from "@/server/trpc/types"

type User = ApiOutput["tg"]["users"]["getByUsername"]["user"]
type Roles = NonNullable<ApiOutput["tg"]["permissions"]["getRoles"]["roles"]>

const ARRAY_USER_ROLES = [
  USER_ROLE.ADMIN,
  USER_ROLE.HR,
  USER_ROLE.OWNER,
  USER_ROLE.CREATOR,
  USER_ROLE.DIRETTIVO,
  USER_ROLE.PRESIDENT,
] as const

export function RemoveRole({ user, alreadyRoles }: { user: User; alreadyRoles: Roles }) {
  const sesh = useSession()
  const removerId = sesh.data?.user.telegramId

  const userRoles = ARRAY_USER_ROLES.filter((r) => alreadyRoles.includes(r)).map((g) => ({
    value: g,
    label: `${g.slice(0, 1).toUpperCase()}${g.slice(1)}`,
  }))

  // const trpc = useTRPC()
  // const qc = useQueryClient()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Roles[number] | null>(null)

  // const submitMutation = useMutation(trpc.tg.permissions.removeRole.mutationOptions())

  async function submit() {
    if (!removerId) return toast.warning("Invalid session, try reloading the page")
    if (!selectedRole) return toast.warning("No group selected, cannot proceed")
    if (!user) return toast.warning("Invalid user, try restarting the dialog")

    try {
      // await submitMutation.mutateAsync({ removerId, userId: user.id, role: selectedRole })
      toast.info(`Role removed`)
      handleOpenChange(false)
      router.refresh()
    } catch (err) {
      console.error(err)
      handleOpenChange(false)
      toast.error("There was an error, check logs")
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (v === false) {
      // closing
      // qc.invalidateQueries(trpc.tg.permissions.getRoles.queryOptions({ userId: user?.id ?? 0 }))
      setSelectedRole(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="destructive">
            <Minus size={20} /> Remove Role
          </Button>
        }
      />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Remove Role</DialogTitle>
          <DialogDescription>Remove a role from the telegram user</DialogDescription>
        </DialogHeader>
        {user && (
          <p>
            Target: {user.firstName} {user.username && `@${user.username}`} [{user.id}]
          </p>
        )}
        <div className="flex items-center justify-start gap-2">
          <span>User roles: </span>
          {alreadyRoles.map((r) => (
            <Badge key={r}>{r}</Badge>
          ))}
        </div>

        <Select
          items={userRoles}
          value={selectedRole}
          onValueChange={(v) => setSelectedRole(v)}
          disabled={userRoles.length === 0}
        >
          <SelectTrigger className="w-full max-w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {userRoles.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={submit} disabled={!selectedRole} variant="destructive">
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
