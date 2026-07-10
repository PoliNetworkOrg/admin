import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ArrowDown, ArrowUp, Building2, Check, ChevronsUpDown, LoaderCircle, UsersRound, X } from "lucide-react"
import { useMemo, useState } from "react"
import { DataToolbar } from "@/components/data-toolbar"
import { EmptyState } from "@/components/empty-state"
import { LiveStatus } from "@/components/live-status"
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
  component: AzureMembers,
})

function AzureMembers() {
  const response = Route.useLoaderData()
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [membersOnly, setMembersOnly] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
    key: "employeeId",
    direction: "asc",
  })
  const [dialog, setDialog] = useState<{ mode: "create" } | { mode: "edit"; member: AzureMember } | null>(null)
  const members = response.data as AzureMember[]
  const filtered = useMemo(() => {
    const visible = members.filter(
      (member) =>
        (!membersOnly || member.isMember) &&
        `${member.displayName ?? ""} ${member.mail ?? ""} ${member.employeeId ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase())
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
    <div className="data-page reveal">
      <DataToolbar
        title="Azure members"
        description="Association membership and Microsoft 365 license information."
        count={filtered.length}
        onSearch={setQuery}
        action="Add member"
        onAction={() => setDialog({ mode: "create" })}
      >
        <button
          className={`filter-toggle ${membersOnly ? "selected" : ""}`}
          onClick={() => setMembersOnly(!membersOnly)}
        >
          <Check size={14} /> Members only
        </button>
      </DataToolbar>
      <LiveStatus connected={response.connected} message={response.message} />
      <section className="license-summary">
        <div>
          <Building2 size={18} />
          <span>
            <b>{members.filter((member) => member.isMember).length}</b> association members
          </span>
        </div>
        <div>
          <UsersRound size={18} />
          <span>
            <b>{members.filter((member) => member.assignedLicensesIds?.includes("OFFICE_365")).length}</b> Office 365
            licenses
          </span>
        </div>
      </section>
      {filtered.length ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <SortableHeader label="Member ID" sortKey="employeeId" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Member" sortKey="displayName" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Email" sortKey="mail" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Licenses" sortKey="licenses" sort={sort} onSort={toggleSort} />
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr key={member.id}>
                  <td className="mono">{member.employeeId ?? "—"}</td>
                  <td>
                    <div className="identity">
                      <span className="mini-avatar azure">{member.displayName?.[0] ?? "?"}</span>
                      <span>
                        <b>{member.displayName ?? "Unnamed member"}</b>
                        {member.isMember && <small>Association member</small>}
                      </span>
                    </div>
                  </td>
                  <td>{member.mail ?? <span className="muted">Not assigned</span>}</td>
                  <td>
                    <div className="license-list">
                      {member.assignedLicensesIds?.length ? (
                        member.assignedLicensesIds.map((license) => (
                          <span className="license" key={license}>
                            {license.replaceAll("_", " ")}
                          </span>
                        ))
                      ) : (
                        <span className="muted">No licenses</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <button className="row-text-button" onClick={() => setDialog({ mode: "edit", member })}>
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="member-dialog-title">
        <header>
          <div>
            <p className="eyebrow">AZURE DIRECTORY</p>
            <h2 id="member-dialog-title">{editing ? "Set member ID" : "Create a member"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          {!editing && (
            <>
              <label>
                First name
                <input value={firstName} onChange={(event) => setFirstName(event.target.value)} required autoFocus />
              </label>
              <label>
                Last name
                <input value={lastName} onChange={(event) => setLastName(event.target.value)} required />
              </label>
              <label>
                Welcome email recipient
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
            </>
          )}
          <label>
            Member ID
            <input
              inputMode="numeric"
              pattern="[0-9]+"
              value={memberId}
              onChange={(event) => setMemberId(event.target.value.replace(/\D/g, ""))}
              required
              autoFocus={editing}
            />
          </label>
          {error && <p className="form-notice">{error}</p>}
          <footer>
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" disabled={pending}>
              {pending && <LoaderCircle className="spin" size={14} />}
              {editing ? "Save member ID" : "Create member"}
            </button>
          </footer>
        </form>
      </section>
    </div>
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
    <th>
      <button className="sortable-header" onClick={() => onSort(sortKey)}>
        {label}
        <Icon size={12} />
      </button>
    </th>
  )
}
