import { useServerFn } from "@tanstack/react-start"
import { UserMinus, UserPlus } from "lucide-react"
import { useDeferredValue, useEffect, useState } from "react"

import {
  buttonMotion,
  ConfirmDialog,
  dialogFooter,
  FormDialog,
  IconButton,
  initialsOf,
  InlineAlert,
  LoadingButton,
  SelectField,
  Spinner,
} from "@/components/primitives"
import { SearchField } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { ROLE_LABELS } from "./regulations-format"
import { failureMessage, useRefreshAfter } from "./regulations-hooks"
import { removeDraftAssignment, setDraftAssignment } from "./regulations-write.functions"
import { type Assignment, DRAFT_ROLES, type DraftRole, type UserMatch } from "./regulations.contract"
import { searchRegulationUsers } from "./regulations.functions"

const ROLE_OPTIONS = DRAFT_ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))
const SEARCH_ERROR = "Non è stato possibile cercare gli account. Riprova."

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-full border border-(--pn-line-strong) bg-(--pn-muted) text-xs font-semibold text-(--pn-fg-muted)"
    >
      {initialsOf(name)}
    </span>
  )
}

function Person({ user }: { user: UserMatch }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={user.name} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[14px] font-medium text-(--pn-fg)">{user.name}</span>
        <span className="truncate font-mono text-xs text-(--pn-fg-muted)">{user.email ?? "Senza email"}</span>
      </span>
    </span>
  )
}

/**
 * Who works on a draft, Google-Docs style: any PoliNetwork account (not only Soci) as viewer, commenter or editor.
 * Each change is saved at once. Assignments are backend data, not IdP roles: an assignment alone lets someone into
 * the dashboard, where they see only Regolamenti and their drafts.
 */
export function MembersDialog({
  open,
  onOpenChange,
  draft,
  members,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: { id: string; title: string }
  members: Assignment[]
}) {
  const search = useServerFn(searchRegulationUsers)
  const setAssignment = useServerFn(setDraftAssignment)
  const removeAssignment = useServerFn(removeDraftAssignment)
  const refresh = useRefreshAfter()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim())
  const [results, setResults] = useState<{ query: string; users: UserMatch[] } | null>(null)
  const [searchFailed, setSearchFailed] = useState(false)
  const [newRole, setNewRole] = useState<DraftRole>("commenter")
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Assignment | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)

  // Debounced search: at least two characters, the latest answer wins.
  useEffect(() => {
    if (!open || deferredQuery.length < 2) return
    let current = true
    const timer = setTimeout(() => {
      search({ data: { q: deferredQuery } }).then(
        (users) => {
          if (!current) return
          setSearchFailed(false)
          setResults({ query: deferredQuery, users })
        },
        (caught) => {
          console.error(caught)
          if (current) setSearchFailed(true)
        }
      )
    }, 250)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [open, deferredQuery, search])

  const shown = deferredQuery.length >= 2 && results?.query === deferredQuery ? results.users : null
  const memberIds = new Set(members.map((member) => member.user.id))

  async function run(key: string, action: () => Promise<void>, done: string, fallback: string) {
    setBusy(key)
    setError(null)
    try {
      await action()
    } catch (caught) {
      console.error(caught)
      setError(failureMessage(caught, fallback))
      setBusy(null)
      return
    }
    await refresh(done)
    setBusy(null)
  }

  function add(user: UserMatch) {
    void run(
      `add:${user.id}`,
      () => setAssignment({ data: { draftId: draft.id, userId: user.id, role: newRole } }),
      `${user.name} aggiunto alla bozza.`,
      `Non è stato possibile aggiungere ${user.name}. Riprova.`
    )
  }

  function changeRole(member: Assignment, role: DraftRole) {
    if (role === member.role) return
    void run(
      `role:${member.user.id}`,
      () => setAssignment({ data: { draftId: draft.id, userId: member.user.id, role } }),
      `Ruolo di ${member.user.name} aggiornato.`,
      `Non è stato possibile cambiare il ruolo di ${member.user.name}. Riprova.`
    )
  }

  async function remove() {
    if (!removing) return
    try {
      await removeAssignment({ data: { draftId: draft.id, userId: removing.user.id } })
    } catch (caught) {
      console.error(caught)
      throw new Error(failureMessage(caught, `Non è stato possibile rimuovere ${removing.user.name}. Riprova.`), {
        cause: caught,
      })
    }
    await refresh(`${removing.user.name} rimosso dalla bozza.`)
  }

  return (
    <>
      <FormDialog
        locale="it"
        open={open}
        onOpenChange={onOpenChange}
        size="lg"
        title="Membri della bozza"
        description={
          <>
            Chi aggiungi vede «{draft.title}» in Regolamenti › Bozze, anche senza altro accesso alla dashboard. Il
            Direttivo legge e modifica sempre ogni bozza.
          </>
        }
        noun="membri"
        dirty={false}
        onSubmit={() => undefined}
        submitOnEnter={false}
        error={error}
        footer={
          <div className={dialogFooter}>
            <Button type="button" className={buttonMotion} onClick={() => onOpenChange(false)}>
              Fatto
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3" aria-labelledby="members-add">
            <h3 id="members-add" className="text-[15px] font-semibold text-(--pn-fg)">
              Aggiungi un membro
            </h3>
            <div className="flex flex-col gap-2 min-[560px]:flex-row">
              <SearchField
                value={query}
                onChange={setQuery}
                label="Cerca un account"
                placeholder="Cerca un account per nome o email…"
                className="w-full max-w-none flex-1"
              />
              <div className="min-[560px]:w-48">
                <label htmlFor="members-new-role" className="sr-only">
                  Ruolo dei nuovi membri
                </label>
                <SelectField id="members-new-role" value={newRole} options={ROLE_OPTIONS} onChange={setNewRole} />
              </div>
            </div>
            {deferredQuery.length > 0 && deferredQuery.length < 2 ? (
              <p className="text-[13px] text-(--pn-fg-muted)">Scrivi almeno due caratteri.</p>
            ) : null}
            {searchFailed ? <InlineAlert>{SEARCH_ERROR}</InlineAlert> : null}
            {deferredQuery.length >= 2 && shown === null && !searchFailed ? <Spinner className="size-4" /> : null}
            {shown?.length === 0 ? (
              <p className="text-[13px] text-(--pn-fg-muted)">
                Nessun account corrisponde. Serve un account PoliNetwork: chi non ce l'ha deve prima crearlo.
              </p>
            ) : null}
            {shown?.length ? (
              <ul className="flex flex-col divide-y divide-(--pn-line) rounded-(--pn-r-4) border border-(--pn-line)">
                {shown.map((user) => (
                  <li key={user.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <Person user={user} />
                    {memberIds.has(user.id) ? (
                      <span className="shrink-0 text-[13px] text-(--pn-fg-muted)">Già membro</span>
                    ) : (
                      <LoadingButton
                        size="sm"
                        variant="outline"
                        icon={UserPlus}
                        pending={busy === `add:${user.id}`}
                        disabled={busy !== null}
                        onClick={() => add(user)}
                      >
                        Aggiungi
                      </LoadingButton>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="members-current">
            <h3 id="members-current" className="text-[15px] font-semibold text-(--pn-fg)">
              Membri <span className="font-mono text-[13px] text-(--pn-fg-muted)">{members.length}</span>
            </h3>
            {members.length === 0 ? (
              <p className="text-[13px] text-(--pn-fg-muted)">
                Nessun membro: per ora la bozza la vede solo chi ha accesso ai Regolamenti.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-(--pn-line) rounded-(--pn-r-4) border border-(--pn-line)">
                {members.map((member) => (
                  <li key={member.user.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                    <Person user={member.user} />
                    <span className="flex items-center gap-1">
                      {busy === `role:${member.user.id}` ? <Spinner className="size-4" /> : null}
                      <div className="w-44">
                        <label htmlFor={`member-role-${member.user.id}`} className="sr-only">
                          Ruolo di {member.user.name}
                        </label>
                        <SelectField
                          id={`member-role-${member.user.id}`}
                          value={member.role}
                          options={ROLE_OPTIONS}
                          onChange={(role) => changeRole(member, role)}
                        />
                      </div>
                      <IconButton
                        label="Rimuovi"
                        ariaLabel={`Rimuovi ${member.user.name}`}
                        icon={UserMinus}
                        tone="danger"
                        disabled={busy !== null}
                        onClick={() => {
                          setRemoving(member)
                          setRemoveOpen(true)
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </FormDialog>
      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Rimuovere ${removing?.user.name ?? "il membro"}?`}
        description="Non vedrà più questa bozza. Se era il suo unico accesso, non entrerà più nella dashboard. I commenti che ha scritto restano."
        confirmLabel="Rimuovi membro"
        cancelLabel="Annulla"
        onConfirm={remove}
      />
    </>
  )
}
