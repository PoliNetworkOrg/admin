import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { CircleCheck, Mail, RefreshCw, X } from "lucide-react"
import { type ReactNode, useDeferredValue, useState } from "react"

import {
  buttonMotion,
  DataTable,
  type DataTableColumn,
  EmptyState,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  IconButton,
  InlineAlert,
  PlatformGlyph,
  RadioCard,
  RadioCardGroup,
  RowActions,
  SegmentedControl,
  StatusBadge,
  useOpenGeneration,
} from "@/components/primitives"
import { appToast, Count, PageBar, PageContent, Toolbar, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { type AccountAction, AccountActionDialog } from "./account-action-dialog"
import { formatDay, isExpired } from "./people-format"
import { errorMessage, useRefreshAfter } from "./people-hooks"
import { PersonCell } from "./people-ui"
import { dismissLinkingReview, resolveLinkingReview } from "./people-write.functions"
import type { Invite, Review } from "./people.contract"

type Scope = "review" | "invites"
type ReviewKind = Review["kind"]

const ISSUE = {
  "telegram-conflict": "Telegram account already linked to another record",
  "ask-to-be-added": "Signed in without a record and asked to be added",
  "two-records": "Two records match this sign-in",
  "not-me": "Said “This isn't me” at first sign-in",
  "name-only": "Matched by name only; email and Telegram differ",
  "preliminary-link": "Auth person awaiting Master Admin approval of their login account",
  "identity-match": "Sign-in matches a record HR must confirm",
} satisfies Record<ReviewKind, string>

type Resolution = { value: string; label: string; description: string }
type ResolutionChoices = { title: string; description: string; options: Resolution[] }

/** The ways to settle each kind of review; the backend applies the chosen `value`. */
function resolutionsFor(review: Review): ResolutionChoices {
  const record = review.record ? `${review.record.name} (${review.record.id})` : "the record"
  const other = review.other ? `${review.other.name} (${review.other.id})` : "the other record"
  switch (review.kind) {
    case "preliminary-link":
      return {
        title: "Link the preliminary Auth person?",
        description:
          review.message ??
          `Check that this login belongs to ${record}. A Master Admin must approve the identity link in Auth.`,
        options: [
          {
            value: "link-anyway",
            label: "Approve identity link",
            description: "Auth transfers their current roles to the verified login account. Master Admin only.",
          },
          {
            value: "decline",
            label: "Different person",
            description: "Keep the preliminary person and this login separate.",
          },
        ],
      }
    case "identity-match":
      return {
        title: "Link this sign-in to the record?",
        description: review.message ?? `The sign-in matches ${record}. Check with them before linking.`,
        options: [
          {
            value: "link-anyway",
            label: `Link to ${review.record?.id ?? "the record"}`,
            description: "Links the account; Auth grants the record's roles if you may give them.",
          },
          {
            value: "decline",
            label: "Different person",
            description: "Keep the record and this sign-in separate.",
          },
        ],
      }
    case "telegram-conflict":
      return {
        title: "Resolve Telegram conflict",
        description: `The sign-in matches ${record} by email, but its Telegram account is on ${other}.`,
        options: [
          {
            value: "move-telegram",
            label: `Link to ${review.record?.id ?? "the record"} and move the Telegram account`,
            description: `Removes ${review.account.telegram ?? "the Telegram account"} from ${other}.`,
          },
          {
            value: "link-other",
            label: `Link to ${review.other?.id ?? "the other record"}`,
            description: `The Telegram account stays where it is; ${review.record?.id ?? "the record"} stays unlinked.`,
          },
          {
            value: "ask-details",
            label: "Keep unlinked and ask for details",
            description: `Sends ${review.account.name} a message asking which record is theirs.`,
          },
        ],
      }
    case "ask-to-be-added":
      return {
        title: "Resolve request to be added",
        description: `${review.account.name} signed in, found no record and asked to be added. To link a record that already exists, open it and use Link account.`,
        options: [
          {
            value: "add-new",
            label: "Add as a new person",
            description: "Creates a record from the sign-in and links it.",
          },
          { value: "decline", label: "Decline", description: "They keep seeing “You're not on the lists”." },
        ],
      }
    case "two-records":
      return {
        title: "Resolve two matching records",
        description: `Both records use ${review.account.email}.`,
        options: [
          { value: "link-first", label: `Link to ${review.record?.id ?? "the first record"}`, description: record },
          { value: "link-second", label: `Link to ${review.other?.id ?? "the second record"}`, description: other },
          {
            value: "merge-first",
            label: "Merge the two records first",
            description: "HR merges them, then the sign-in links to the result.",
          },
        ],
      }
    default:
      return {
        title: review.kind === "not-me" ? "Resolve “This isn't me”" : "Resolve name-only match",
        description:
          review.kind === "not-me"
            ? `At first sign-in, ${review.account.name} said ${record} isn't them.`
            : `The sign-in matched ${record} by name only.`,
        options: [
          { value: "link-anyway", label: "Link anyway", description: "Only if you checked with them directly." },
          {
            value: "add-new",
            label: "Add as a new person",
            description: "Creates a separate record for this sign-in.",
          },
          { value: "decline", label: "Decline", description: "They keep seeing “You're not on the lists”." },
        ],
      }
  }
}

function Side({ heading, rows }: { heading: string; rows: { label: string; value: ReactNode; mono?: boolean }[] }) {
  return (
    <div className="rounded-(--pn-r-4) border border-(--pn-line) p-3">
      <h3 className="mb-2 text-xs font-medium text-(--pn-fg-muted)">{heading}</h3>
      <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-(--pn-fg-muted)">{row.label}</dt>
            <dd className={cn("[overflow-wrap:anywhere]", row.mono && "font-mono")}>{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function ResolveDialog({
  open,
  onOpenChange,
  review,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  review: Review
}) {
  const resolve = useServerFn(resolveLinkingReview)
  const refresh = useRefreshAfter()
  const { title, description, options } = resolutionsFor(review)
  const [choice, setChoice] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const choiceError = submitted && !choice ? "Choose how to resolve it." : undefined
  const reasonError = submitted && !reason.trim() ? "Enter a reason." : undefined

  async function submit() {
    setSubmitted(true)
    if (!choice || !reason.trim()) return
    try {
      await resolve({ data: { reviewId: review.id, resolution: choice, reason: reason.trim() } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't resolve the review."), { cause: caught })
    }
    await refresh("Resolved.")
    onOpenChange(false)
  }

  const recordSide = review.record ?? review.other
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={title}
      description={description}
      noun="resolution"
      dirty={choice !== null || reason.trim() !== ""}
      submitLabel="Resolve"
      submitOnEnter={false}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 shell:grid-cols-2">
          <Side
            heading="Signed in as"
            rows={[
              { label: "Name", value: review.account.name },
              { label: "Email", value: review.account.email, mono: true },
              {
                label: "Telegram",
                value: review.account.telegram ? (
                  <span className="inline-flex items-center gap-1.5">
                    <PlatformGlyph platform="tg" className="size-3" />
                    {review.account.telegram}
                  </span>
                ) : (
                  "—"
                ),
                mono: true,
              },
              { label: "Signed in with", value: review.account.via },
            ]}
          />
          <Side
            heading={
              review.kind === "two-records"
                ? "Records with this email"
                : review.kind === "telegram-conflict"
                  ? "Telegram account is on"
                  : "Suggested record"
            }
            rows={
              recordSide
                ? [
                    ...(review.kind === "telegram-conflict" && review.other ? [review.other] : [recordSide]).map(
                      (ref) => ({
                        label: ref.id,
                        value: (
                          <Link
                            to="/dashboard/people/$personId"
                            params={{ personId: ref.id }}
                            className="text-(--pn-accent) hover:underline"
                          >
                            {ref.name}
                          </Link>
                        ),
                      })
                    ),
                    ...(review.kind === "two-records" && review.other
                      ? [
                          {
                            label: review.other.id,
                            value: (
                              <Link
                                to="/dashboard/people/$personId"
                                params={{ personId: review.other.id }}
                                className="text-(--pn-accent) hover:underline"
                              >
                                {review.other.name}
                              </Link>
                            ),
                          },
                        ]
                      : []),
                  ]
                : [{ label: "Record", value: "None found" }]
            }
          />
        </div>
        {review.message ? (
          <InlineAlert tone="info">
            <span className="font-medium">Their message:</span> {review.message}
          </InlineAlert>
        ) : null}
        <div className="flex flex-col gap-2">
          <RadioCardGroup
            label="Resolution"
            value={choice}
            onValueChange={setChoice}
            invalid={!!choiceError}
            describedBy={choiceError ? "resolve-choice-error" : undefined}
          >
            {options.map((option) => (
              <RadioCard
                key={option.value}
                value={option.value}
                label={option.label}
                description={option.description}
              />
            ))}
          </RadioCardGroup>
          {choiceError ? (
            <p id="resolve-choice-error" className="text-[13px] text-(--pn-danger-fg)">
              {choiceError}
            </p>
          ) : null}
        </div>
        <FormField label="Reason" htmlFor="resolve-reason" hint="Saved in the record's activity." error={reasonError}>
          <Textarea
            id="resolve-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={fieldHintId("resolve-reason")}
            className={cn(fieldControl, "min-h-20")}
          />
        </FormField>
      </div>
    </FormDialog>
  )
}

/** People › Linking: sign-ins the backend couldn't link on its own, and invites still waiting. */
export function LinkingPage({ reviews, invites }: { reviews: Review[]; invites: Invite[] }) {
  const canWrite = useCan("people:write")
  const dismiss = useServerFn(dismissLinkingReview)
  const refresh = useRefreshAfter()
  const [scope, setScope] = useState<Scope>("review")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [resolving, setResolving] = useState<Review | null>(null)
  const [resolveOpen, setResolveOpen] = useState(false)
  const resolveKey = useOpenGeneration(resolveOpen)
  const [accountAction, setAccountAction] = useState<AccountAction | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)

  const matches = (values: string[]) =>
    !deferredQuery || values.some((value) => value.toLocaleLowerCase().includes(deferredQuery))
  const reviewRows = reviews.filter((review) => matches([review.account.name, review.account.email]))
  const inviteRows = invites
    .filter((invite) => matches([invite.name, invite.email]))
    .toSorted((a, b) => a.expiresOn.localeCompare(b.expiresOn))

  async function dismissReview(review: Review) {
    try {
      await dismiss({ data: { reviewId: review.id } })
    } catch (caught) {
      console.error(caught)
      appToast.error(errorMessage(caught, "Couldn't dismiss it."))
      return
    }
    await refresh("Review dismissed.")
  }

  function openInvite(kind: "resend" | "revoke", invite: Invite) {
    setAccountAction({ kind, personId: invite.personId, name: invite.name, email: invite.email })
    setAccountOpen(true)
  }

  const reviewColumns: DataTableColumn<Review>[] = [
    {
      id: "account",
      label: "Signed in as",
      fill: true,
      minWidth: 220,
      mobile: "main",
      cell: (review) => <PersonCell name={review.account.name} secondary={review.account.email} secondaryMono />,
    },
    {
      id: "issue",
      label: "Issue",
      width: 300,
      mobile: "text",
      cell: (review) => <span className="block whitespace-normal">{ISSUE[review.kind]}</span>,
    },
    {
      id: "record",
      label: "Record",
      width: 208,
      priority: 3,
      mobile: "meta",
      cell: (review) =>
        review.record ? (
          <span className="block truncate">
            {review.record.name} <span className="font-mono text-xs text-(--pn-fg-muted)">{review.record.id}</span>
          </span>
        ) : (
          <span className="text-(--pn-fg-muted)">No record</span>
        ),
    },
    {
      id: "since",
      label: "Since",
      width: 120,
      priority: 4,
      mobile: "meta",
      cell: (review) => <span className="whitespace-nowrap">{formatDay(review.since)}</span>,
    },
  ]

  const inviteColumns: DataTableColumn<Invite>[] = [
    {
      id: "person",
      label: "Person",
      fill: true,
      minWidth: 200,
      mobile: "main",
      cell: (invite) => <PersonCell name={invite.name} secondary={invite.personId} secondaryMono />,
    },
    {
      id: "email",
      label: "Email",
      width: 264,
      mobile: "full",
      cell: (invite) => <span className="block truncate font-mono text-[13px]">{invite.email}</span>,
    },
    {
      id: "sent",
      label: "Sent on",
      width: 120,
      priority: 3,
      mobile: "hidden",
      cell: (invite) => <span className="whitespace-nowrap">{formatDay(invite.sentOn)}</span>,
    },
    {
      id: "expires",
      label: "Expires on",
      width: 168,
      mobile: "meta",
      cell: (invite) =>
        isExpired(invite.expiresOn) ? (
          <StatusBadge tone="danger">Expired {formatDay(invite.expiresOn)}</StatusBadge>
        ) : (
          <span className="whitespace-nowrap">{formatDay(invite.expiresOn)}</span>
        ),
    },
    {
      id: "sentBy",
      label: "Sent by",
      width: 144,
      priority: 4,
      mobile: "hidden",
      cell: (invite) => <span className="block truncate">{invite.sentBy}</span>,
    },
  ]

  return (
    <>
      <PageBar
        description="Connect sign-ins to person records"
        left={
          <Toolbar
            search={{
              value: query,
              onChange: setQuery,
              placeholder: scope === "review" ? "Search by name or email…" : "Search invites…",
            }}
            filters={
              <SegmentedControl<Scope>
                label="List"
                items={[
                  { value: "review", label: "Needs review", count: reviews.length },
                  { value: "invites", label: "Pending invites", count: invites.length },
                ]}
                value={scope}
                onValueChange={setScope}
              />
            }
            count={
              deferredQuery ? (
                scope === "review" ? (
                  <Count value={reviewRows.length} total={reviews.length} noun="item" plural="items" />
                ) : (
                  <Count value={inviteRows.length} total={invites.length} noun="invite" plural="invites" />
                )
              ) : undefined
            }
          />
        }
      />
      <PageContent>
        {scope === "review" ? (
          <DataTable
            label="Needs review"
            columns={reviewColumns}
            rows={reviewRows}
            getRowId={(review) => review.id}
            rowLabel={(review) => review.account.name}
            actions={
              canWrite
                ? (review) => (
                    <RowActions className="gap-2">
                      <Button size="sm" variant="ghost" className={buttonMotion} onClick={() => dismissReview(review)}>
                        Dismiss
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={buttonMotion}
                        onClick={() => {
                          setResolving(review)
                          setResolveOpen(true)
                        }}
                      >
                        Resolve
                      </Button>
                    </RowActions>
                  )
                : undefined
            }
            actionsWidth={184}
            empty={
              deferredQuery ? (
                <EmptyState
                  icon={CircleCheck}
                  title="Nothing matches"
                  text="Try another name or email."
                  action={
                    <Button size="sm" variant="ghost" className={buttonMotion} onClick={() => setQuery("")}>
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={CircleCheck}
                  title="Nothing needs review"
                  text="Conflicts and requests to be added appear here when someone signs in."
                />
              )
            }
          />
        ) : (
          <DataTable
            label="Pending invites"
            columns={inviteColumns}
            rows={inviteRows}
            getRowId={(invite) => invite.personId}
            rowLabel={(invite) => invite.name}
            rowHref={(invite) => `/dashboard/people/${invite.personId}`}
            actions={
              canWrite
                ? (invite) => (
                    <RowActions>
                      <IconButton
                        label="Resend invite"
                        ariaLabel={`Resend invite to ${invite.name}`}
                        icon={RefreshCw}
                        onClick={() => openInvite("resend", invite)}
                      />
                      <IconButton
                        label="Revoke invite"
                        ariaLabel={`Revoke invite to ${invite.name}`}
                        icon={X}
                        tone="danger"
                        onClick={() => openInvite("revoke", invite)}
                      />
                    </RowActions>
                  )
                : undefined
            }
            actionsWidth={96}
            empty={
              deferredQuery ? (
                <EmptyState
                  icon={Mail}
                  title="No invites match"
                  text="Try another name or email."
                  action={
                    <Button size="sm" variant="ghost" className={buttonMotion} onClick={() => setQuery("")}>
                      Clear search
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Mail}
                  title="No pending invites"
                  text="Invites you send from a person's record appear here until they're accepted."
                />
              )
            }
          />
        )}
      </PageContent>
      {canWrite && resolving ? (
        <ResolveDialog
          key={`resolve-${resolveKey}`}
          open={resolveOpen}
          onOpenChange={setResolveOpen}
          review={resolving}
        />
      ) : null}
      {canWrite ? (
        <AccountActionDialog action={accountAction} open={accountOpen} onOpenChange={setAccountOpen} />
      ) : null}
    </>
  )
}
