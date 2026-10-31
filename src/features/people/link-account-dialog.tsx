import { useServerFn } from "@tanstack/react-start"
import { useDeferredValue, useMemo, useState } from "react"

import {
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  RadioCard,
  RadioCardGroup,
  Spinner,
  StatusBadge,
} from "@/components/primitives"
import { SearchField } from "@/components/shell"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { errorMessage, useLoaded, useRefreshAfter } from "./people-hooks"
import { linkPersonAccount, searchPeopleAccounts, unlinkPersonAccount } from "./people-link.functions"
import { PersonAvatar } from "./people-ui"
import { UNLINK_REASON } from "./people.contract"

const LINK_ERROR = "Couldn't link account."

/**
 * Links a sign-in account from the IdP directory to a record, with the reason saved in its activity. Nothing is
 * matched automatically: whoever links checks the account is theirs. The record's pending roles then go to Auth.
 */
export function LinkAccountDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: { id: string; name: string; firstName: string }
}) {
  const search = useServerFn(searchPeopleAccounts)
  const link = useServerFn(linkPersonAccount)
  const refresh = useRefreshAfter()
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim())
  const [selected, setSelected] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [submitted, setSubmitted] = useState(false)

  const { data: accounts, failed } = useLoaded(
    useMemo(() => (open ? () => search({ data: { query: deferredQuery } }) : null), [open, deferredQuery, search]),
    true
  )
  const loadError = failed ? "Couldn't load accounts. Try again." : null

  const reasonError = submitted && !reason.trim() ? "Enter a reason." : undefined

  async function submit() {
    setSubmitted(true)
    if (!selected) throw new Error("Choose an account to link.")
    if (accounts?.find((account) => account.id === selected)?.linkedTo)
      throw new Error("That account is linked to another record.")
    if (!reason.trim()) return
    try {
      await link({ data: { personId: person.id, accountId: selected, reason: reason.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(`${LINK_ERROR} ${errorMessage(caught, "")}`.trim(), { cause: caught })
    }
    await refresh("Account linked. PoliNetwork Auth applies the record's roles shortly.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Link account"
      description={`Connect a sign-in account to ${person.name} (${person.id}). Their pending roles go to PoliNetwork Auth, acting as you, and they can see their record in My area.`}
      noun="link"
      dirty={selected !== null || reason.trim() !== ""}
      submitLabel="Link account"
      onSubmit={submit}
      submitOnEnter={false}
    >
      <div className="flex flex-col gap-4">
        <SearchField
          value={query}
          onChange={setQuery}
          label="Search accounts"
          placeholder="Search accounts by name or email…"
          className="w-full max-w-none"
        />
        <div className="flex flex-col gap-2">
          {loadError ? <p className="text-[13px] text-(--pn-danger-fg)">{loadError}</p> : null}
          {accounts === null && !loadError ? <Spinner className="size-4" /> : null}
          {accounts?.length === 0 ? (
            <p className="text-[13px] text-(--pn-fg-muted)">
              No accounts match. Check the spelling, or send an invite: they can accept it with any account.
            </p>
          ) : null}
          {accounts?.length ? (
            <RadioCardGroup label="Accounts" value={selected} onValueChange={setSelected}>
              {accounts.map((account) => (
                <RadioCard
                  key={account.id}
                  value={account.id}
                  lead={<PersonAvatar name={account.name} />}
                  label={account.name}
                  description={
                    <span className="flex flex-col gap-0.5">
                      <span className="font-mono [overflow-wrap:anywhere]">{account.email || account.id}</span>
                      {account.linkedTo ? (
                        <span>
                          Linked to {account.linkedTo.name} ({account.linkedTo.id})
                        </span>
                      ) : null}
                    </span>
                  }
                  end={account.linkedTo ? <StatusBadge tone="neutral">Linked</StatusBadge> : undefined}
                />
              ))}
            </RadioCardGroup>
          ) : null}
        </div>
        <FormField label="Reason" htmlFor="link-reason" hint="Saved in the record's activity." error={reasonError}>
          <Textarea
            id="link-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={`How you know this account belongs to ${person.firstName}`}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={fieldHintId("link-reason")}
            className={cn(fieldControl, "min-h-20")}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}

/**
 * Unlinks a record's account. Auth takes the record's roles back first; once it confirms, the account is detached and
 * the roles wait as pending for the next link. If Auth refuses, the account stays linked with its roles.
 */
export function UnlinkAccountDialog({
  open,
  onOpenChange,
  person,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: { id: string; name: string; roles: number }
}) {
  const unlink = useServerFn(unlinkPersonAccount)
  const refresh = useRefreshAfter()
  const [reason, setReason] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const max = 500 - UNLINK_REASON.length
  const reasonError = submitted && !reason.trim() ? "Enter a reason." : undefined

  async function submit() {
    setSubmitted(true)
    if (!reason.trim()) return
    try {
      await unlink({ data: { personId: person.id, reason: reason.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't unlink the account."), { cause: caught })
    }
    await refresh(
      person.roles
        ? "Unlinking: PoliNetwork Auth takes the roles back, then the account is detached."
        : "Account unlinked."
    )
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Unlink account?"
      description={
        person.roles
          ? `PoliNetwork Auth revokes ${person.name}'s roles from this account, then the account is detached. The roles stay on the record as pending, and are given again when an account is linked. If Auth refuses, nothing changes.`
          : `The account is detached from ${person.name}'s record. The record and its history stay.`
      }
      noun="unlink"
      dirty={reason.trim() !== ""}
      submitLabel="Unlink account"
      tone="danger"
      onSubmit={submit}
    >
      <FormField
        label="Reason"
        htmlFor="unlink-reason"
        hint="Saved in the record's activity and sent to PoliNetwork Auth."
        error={reasonError}
        counter={{ length: reason.length, max }}
      >
        <Textarea
          id="unlink-reason"
          value={reason}
          maxLength={max}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Linked to the wrong account"
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={fieldHintId("unlink-reason")}
          className={cn(fieldControl, "min-h-20")}
        />
      </FormField>
    </FormDialog>
  )
}
