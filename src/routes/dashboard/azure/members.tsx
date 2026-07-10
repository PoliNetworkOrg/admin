import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ArrowDown, ArrowUp, Building2, Check, ChevronsUpDown, LoaderCircle, UsersRound } from "lucide-react"
import { useMemo, useState } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
import { DataPageSkeleton } from "@/components/loading-skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { createAzureMember, getAzureMembers, setAzureMemberNumber } from "@/server/api.functions"

type AzureMember = {
  id: string
  employeeId?: string | null
  displayName?: string | null
  mail?: string | null
  isMember?: boolean
  assignedLicensesIds?: string[]
}
type SortKey = "employeeId" | "displayName" | "mail" | "licenses"

export const Route = createFileRoute("/dashboard/azure/members")({
  loader: () => getAzureMembers(),
  pendingComponent: () => <DataPageSkeleton columns={5} />,
  component: AzureMembers,
})

function AzureMembers() {
  const response = Route.useLoaderData()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [membersOnly, setMembersOnly] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "employeeId", direction: "asc" })
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; member: AzureMember } | null>(null)
  const members = response.data as AzureMember[]

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase()
    const visible = members.filter(
      (member) =>
        (!membersOnly || member.isMember) &&
        `${member.displayName ?? ""} ${member.mail ?? ""} ${member.employeeId ?? ""}`.toLowerCase().includes(normalized)
    )

    return visible.toSorted((a, b) => {
      let result = 0
      if (sort.key === "employeeId") {
        const aNumber = a.employeeId ? Number.parseInt(a.employeeId, 10) : Number.POSITIVE_INFINITY
        const bNumber = b.employeeId ? Number.parseInt(b.employeeId, 10) : Number.POSITIVE_INFINITY
        result = aNumber - bNumber
      } else if (sort.key === "displayName") {
        result = (a.displayName ?? "").localeCompare(b.displayName ?? "")
      } else if (sort.key === "mail") {
        result = (a.mail ?? "").localeCompare(b.mail ?? "")
      } else {
        result = (a.assignedLicensesIds?.length ?? 0) - (b.assignedLicensesIds?.length ?? 0)
      }
      return sort.direction === "asc" ? result : -result
    })
  }, [members, membersOnly, query, sort])

  function toggleSort(key: SortKey) {
    setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }))
  }

  return (
    <div className="animate-appear">
      <DataToolbar
        title="Azure members"
        description="Association membership and Microsoft 365 license information."
        count={filtered.length}
        onSearch={setQuery}
        action="Add member"
        onAction={() => setDialog({ mode: "create" })}
      >
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "rounded-none text-[10px] text-muted-foreground",
            membersOnly && "border-primary bg-accent text-primary"
          )}
          onClick={() => setMembersOnly((current) => !current)}
        >
          <Check data-icon="inline-start" /> Members only
        </Button>
      </DataToolbar>
      <LiveStatus connected={response.connected} message={response.message} />
      <section className="mb-3.5 flex flex-wrap gap-6 bg-[#eaf2fc] px-3.5 py-2.5 text-[11px] text-[#51647f] max-[600px]:grid max-[600px]:gap-2">
        <div className="flex items-center gap-2">
          <Building2 className="size-6 text-primary" />
          <span>
            <b className="text-primary">{members.filter((member) => member.isMember).length}</b> association members
          </span>
        </div>
        <div className="flex items-center gap-2">
          <UsersRound className="size-6 text-primary" />
          <span>
            <b className="text-primary">
              {members.filter((member) => member.assignedLicensesIds?.includes("OFFICE_365")).length}
            </b>{" "}
            Office 365 licenses
          </span>
        </div>
      </section>
      {filtered.length ? (
        <div className="overflow-auto border border-border bg-card">
          <Table className="min-w-[800px] text-left">
            <TableHeader>
              <TableRow className="border-0">
                <SortableHeader label="Member ID" sortKey="employeeId" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Member" sortKey="displayName" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Email" sortKey="mail" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Licenses" sortKey="licenses" sort={sort} onSort={toggleSort} />
                <TableHead className="h-[39px] bg-[#efeee7] px-[15px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((member) => (
                <TableRow key={member.id} className="hover:bg-[#f6f9fe]">
                  <TableCell className="px-[15px] py-3 font-mono text-[10px] text-[#51647f]">
                    {member.employeeId ?? "—"}
                  </TableCell>
                  <TableCell className="px-[15px] py-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-[#dbe8ff] font-mono text-[10px] font-medium text-[#2454a6]">
                        {member.displayName?.[0] ?? "?"}
                      </span>
                      <span>
                        <b className="block text-xs">{member.displayName ?? "Unnamed member"}</b>
                        {member.isMember && (
                          <small className="mt-0.5 block text-[9px] text-muted-foreground">Association member</small>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-[15px] py-3 text-xs">
                    {member.mail ?? <span className="text-[11px] italic text-muted-foreground">Not assigned</span>}
                  </TableCell>
                  <TableCell className="px-[15px] py-3">
                    <div className="flex flex-wrap gap-1">
                      {member.assignedLicensesIds?.length ? (
                        member.assignedLicensesIds.map((license) => (
                          <Badge
                            className="h-5 rounded-none bg-[#e8edfa] px-1.5 font-mono text-[9px] text-[#465a93]"
                            key={license}
                          >
                            {license.replaceAll("_", " ")}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-[11px] italic text-muted-foreground">No licenses</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-[15px] py-3">
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto rounded-none px-1 py-1 text-[10px] font-semibold text-primary"
                      onClick={() => setDialog({ mode: "edit", member })}
                    >
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={UsersRound}
          title="No matching Azure members"
          text="Members will be loaded from Microsoft Entra when the backend is connected."
        />
      )}
      {dialog && (
        <MemberDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null)
            await router.invalidate()
          }}
        />
      )}
    </div>
  )
}

function MemberDialog({
  dialog,
  onClose,
  onSaved,
}: {
  dialog: { mode: "create" } | { mode: "edit"; member: AzureMember }
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const editing = dialog.mode === "edit"
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [memberId, setMemberId] = useState(editing ? (dialog.member.employeeId ?? "") : "")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    const assocNumber = Number.parseInt(memberId, 10)
    try {
      if (editing) await setAzureMemberNumber({ data: { userId: dialog.member.id, assocNumber } })
      else await createAzureMember({ data: { firstName, lastName, assocNumber, sendEmailTo: email } })
      await onSaved()
    } catch {
      setError("The member could not be saved. Check the values and your permissions.")
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-lg rounded-none border-border p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <p className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-muted-foreground">
            AZURE DIRECTORY
          </p>
          <DialogTitle className="font-serif text-[24px] font-normal tracking-[-0.05em]">
            {editing ? "Set member ID" : "Create a member"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {editing
              ? "Update the association number linked to this directory account."
              : "Create a member association and send a welcome email."}
          </DialogDescription>
        </DialogHeader>
        <form className="px-6 py-5" onSubmit={(event) => void submit(event)}>
          <FieldGroup className="gap-3.5">
            {!editing && (
              <>
                <Field>
                  <FieldLabel htmlFor="first-name" className="font-mono text-[10px] font-medium text-muted-foreground">
                    First name
                  </FieldLabel>
                  <Input
                    id="first-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    required
                    autoFocus
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="last-name" className="font-mono text-[10px] font-medium text-muted-foreground">
                    Last name
                  </FieldLabel>
                  <Input
                    id="last-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel
                    htmlFor="welcome-email"
                    className="font-mono text-[10px] font-medium text-muted-foreground"
                  >
                    Welcome email recipient
                  </FieldLabel>
                  <Input
                    id="welcome-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </Field>
              </>
            )}
            <Field>
              <FieldLabel htmlFor="member-id" className="font-mono text-[10px] font-medium text-muted-foreground">
                Member ID
              </FieldLabel>
              <Input
                id="member-id"
                inputMode="numeric"
                pattern="[0-9]+"
                value={memberId}
                onChange={(event) => setMemberId(event.target.value.replace(/\D/g, ""))}
                required
                autoFocus={editing}
              />
            </Field>
            {error && <p className="text-[10px] leading-[1.5] text-destructive">{error}</p>}
          </FieldGroup>
          <DialogFooter className="-mx-6 -mb-5 mt-2 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" className="rounded-none text-[11px]" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-none bg-primary text-[11px] hover:bg-primary/85"
              disabled={pending}
            >
              {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
              {editing ? "Save member ID" : "Create member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string
  sortKey: SortKey
  sort: { key: SortKey; direction: "asc" | "desc" }
  onSort: (key: SortKey) => void
}) {
  const active = sort.key === sortKey
  const Icon = !active ? ChevronsUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown
  return (
    <TableHead className="h-[39px] bg-[#efeee7] px-[15px] font-mono text-[9px] font-medium tracking-[0.08em] text-muted-foreground">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 rounded-none px-0 font-mono text-[9px] tracking-[0.08em] text-muted-foreground hover:bg-transparent hover:text-primary"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon data-icon="inline-end" />
      </Button>
    </TableHead>
  )
}
