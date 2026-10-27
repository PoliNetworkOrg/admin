import { useServerFn } from "@tanstack/react-start"
import { useDeferredValue, useMemo, useState } from "react"

import {
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  PlatformGlyph,
  RadioCard,
  RadioCardGroup,
  Spinner,
  StatusBadge,
} from "@/components/primitives"
import { SearchField } from "@/components/shell"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { errorMessage, useLoaded, useRefreshAfter } from "./people-hooks"
import { PersonAvatar } from "./people-ui"
import { linkPersonAccount } from "./people-write.functions"
import { searchPeopleAccounts } from "./people.functions"

const LINK_ERROR = "Couldn't link account."

const REASONS = {
  "same-telegram": { label: "Same verified Telegram account", tone: "success" },
  "same-email": { label: "Same email", tone: "success" },
  "similar-name": { label: "Similar name — check before linking", tone: "warning" },
} as const

/** Connect a sign-in account to a person's record, with the reason saved in its activity. */
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
    useMemo(
      () => (open ? () => search({ data: { personId: person.id, query: deferredQuery } }) : null),
      [open, person.id, deferredQuery, search]
    ),
    true
  )
  const loadError = failed ? "Couldn't load accounts. Try again." : null

  const reasonError = submitted && !reason.trim() ? "Enter a reason." : undefined

  async function submit() {
    setSubmitted(true)
    if (!selected) throw new Error("Choose an account to link.")
    if (!reason.trim()) return
    try {
      await link({ data: { personId: person.id, accountId: selected, reason: reason.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(`${LINK_ERROR} ${errorMessage(caught, "")}`.trim(), { cause: caught })
    }
    await refresh("Account linked.")
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Link account"
      description={`Connect a PoliNetwork sign-in to ${person.name} (${person.id}). They can then see their record in My area.`}
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
          placeholder="Search accounts by name, email or Telegram…"
          className="w-full max-w-none"
        />
        <div className="flex flex-col gap-2">
          {loadError ? <p className="text-[13px] text-(--pn-danger-fg)">{loadError}</p> : null}
          {accounts === null && !loadError ? <Spinner className="size-4" /> : null}
          {accounts?.length === 0 ? (
            <p className="text-[13px] text-(--pn-fg-muted)">
              No accounts match. Check the spelling, or send an invite.
            </p>
          ) : null}
          {accounts?.length ? (
            <RadioCardGroup
              label={deferredQuery ? "Accounts" : "Suggested matches"}
              value={selected}
              onValueChange={setSelected}
            >
              {accounts.map((account) => (
                <RadioCard
                  key={account.id}
                  value={account.id}
                  lead={<PersonAvatar name={account.name} />}
                  label={account.name}
                  description={
                    <span className="flex flex-col gap-0.5">
                      <span className="font-mono [overflow-wrap:anywhere]">{account.email}</span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {account.telegram ? (
                          <>
                            <PlatformGlyph platform="tg" className="size-3" />
                            <span className="font-mono">{account.telegram}</span>
                            <span aria-hidden>·</span>
                          </>
                        ) : null}
                        {account.linkedTo ? `Linked to ${account.linkedTo.name} (${account.linkedTo.id})` : account.via}
                      </span>
                    </span>
                  }
                  end={<StatusBadge tone={REASONS[account.reason].tone}>{REASONS[account.reason].label}</StatusBadge>}
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
