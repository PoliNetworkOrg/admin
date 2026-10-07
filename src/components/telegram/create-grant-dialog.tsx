import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, Search, X } from "lucide-react"
import { type KeyboardEvent, useState } from "react"

import {
  buttonMotion,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  IconButton,
  InlineAlert,
  LoadingButton,
  SegmentedControl,
  useOpenGeneration,
} from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { createTelegramGrant } from "@/features/telegram/grants.functions"
import { findTelegramUser } from "@/features/telegram/users.functions"
import type { TgUser } from "@/lib/api/types"
import { cn } from "@/lib/utils"

import { earliestGrantStart, GrantDateTimeFields, parseLocalDateTime } from "./grant-date-time-fields"
import { failWith, refreshAfterMutation, telegramUserName } from "./telegram-user"

export type GrantDialogUser = Pick<TgUser, "id" | "firstName" | "lastName" | "username">

type Step = "user" | "details"
type LookupBy = "username" | "id"
type LookupResult = { kind: "idle" } | { kind: "invalid"; message: string } | { kind: "not-found"; message: string }

const REASON_MAX = 500

const LOOKUP_METHODS = [
  { value: "username", label: "Username" },
  { value: "id", label: "Telegram ID" },
] as const satisfies readonly { value: LookupBy; label: string }[]

function grantMutationError(error: string) {
  if (error === "UNAUTHORIZED") return "You do not have permission to create grants."
  if (error === "ALREADY_EXISTING") return "This user already has an ongoing grant."
  return "The grant could not be created."
}

type CreateGrantDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fixed target (user detail page): no stepper, straight to the details. */
  user?: GrantDialogUser
}

/** "New grant" (§7.4): find the user, then the validity window and an optional motivation. */
export function CreateGrantDialog(props: CreateGrantDialogProps) {
  const generation = useOpenGeneration(props.open)
  return <CreateGrantDialogBody key={generation} {...props} />
}

function CreateGrantDialogBody({ open, onOpenChange, user: fixedUser }: CreateGrantDialogProps) {
  const router = useRouter()
  const createGrant = useServerFn(createTelegramGrant)
  const lookupUser = useServerFn(findTelegramUser)
  const [step, setStep] = useState<Step>(fixedUser ? "details" : "user")
  const [lookupBy, setLookupBy] = useState<LookupBy>("username")
  const [query, setQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<GrantDialogUser | null>(fixedUser ?? null)
  const [lookupResult, setLookupResult] = useState<LookupResult>({ kind: "idle" })
  const [lookupPending, setLookupPending] = useState(false)
  const [validSince, setValidSince] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [reason, setReason] = useState("")

  const minimumSince = earliestGrantStart()
  const since = parseLocalDateTime(validSince)
  const until = parseLocalDateTime(validUntil)
  const invalidStart = validSince !== "" && (!since || since < minimumSince)
  const invalidEnd = validUntil !== "" && (!until || (since !== undefined && until <= since))
  const detailsValid = Boolean(selectedUser && since && until) && !invalidStart && !invalidEnd

  const dirty =
    query !== "" ||
    (!fixedUser && selectedUser !== null) ||
    validSince !== "" ||
    validUntil !== "" ||
    reason.trim() !== ""

  function changeLookupBy(next: LookupBy) {
    setLookupBy(next)
    setQuery("")
    setSelectedUser(null)
    setLookupResult({ kind: "idle" })
  }

  async function findUser() {
    if (lookupPending) return
    const normalized = query.trim()
    const numericId = Number(normalized)
    if (!normalized || (lookupBy === "id" && (!Number.isInteger(numericId) || numericId <= 0))) {
      setLookupResult({
        kind: "invalid",
        message: lookupBy === "id" ? "Enter a positive numeric Telegram ID." : "Enter a Telegram username.",
      })
      return
    }
    setSelectedUser(null)
    setLookupResult({ kind: "idle" })
    setLookupPending(true)
    try {
      const result = await lookupUser({
        data: lookupBy === "username" ? { by: "username", username: normalized } : { by: "id", userId: numericId },
      })
      if (result.status === "found" && result.user) {
        setSelectedUser(result.user)
      } else if (result.status === "not-found") {
        setLookupResult({
          kind: "not-found",
          message: `No Telegram user was found for this ${lookupBy === "id" ? "ID" : "username"}.`,
        })
      } else {
        setLookupResult({ kind: "invalid", message: result.message ?? "Telegram user lookup failed." })
      }
    } catch (error) {
      console.error(error)
      setLookupResult({
        kind: "invalid",
        message: "Telegram user lookup failed. Check your connection and try again.",
      })
    } finally {
      setLookupPending(false)
    }
  }

  function onQueryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") void findUser()
  }

  async function submit() {
    if (step === "user") {
      if (selectedUser) setStep("details")
      return
    }
    if (!selectedUser || !since || !until) return
    const result = await failWith(
      createGrant({ data: { userId: selectedUser.id, since, until, reason: reason.trim() || undefined } }),
      "The grant could not be created. Check your permissions and try again."
    )
    if (result.error) {
      console.error(result.error)
      throw new Error(grantMutationError(result.error))
    }
    await refreshAfterMutation(router, "The grant was created, but the latest grants could not be refreshed.")
    appToast.success(`Grant created for ${telegramUserName(selectedUser)}.`)
    onOpenChange(false)
  }

  const queryError = lookupResult.kind === "invalid" ? lookupResult.message : undefined

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="New grant"
      noun="grant"
      dirty={dirty}
      submitLabel={step === "user" ? "Continue" : "Create grant"}
      canSubmit={step === "user" ? selectedUser !== null : detailsValid}
      submitOnEnter={step !== "user"}
      onSubmit={submit}
      footerStart={
        !fixedUser && step === "details" ? (
          <Button type="button" variant="ghost" className={buttonMotion} onClick={() => setStep("user")}>
            <ArrowLeft aria-hidden data-icon="inline-start" />
            Change user
          </Button>
        ) : undefined
      }
    >
      {!fixedUser && <GrantStepper step={step} canOpenDetails={selectedUser !== null} onStepChange={setStep} />}

      {step === "user" ? (
        <>
          <FormField label="Find Telegram user" htmlFor="grant-lookup-method">
            <SegmentedControl
              id="grant-lookup-method"
              label="Telegram user lookup method"
              items={LOOKUP_METHODS}
              value={lookupBy}
              onValueChange={changeLookupBy}
              disabled={lookupPending}
            />
          </FormField>
          <FormField
            label={lookupBy === "username" ? "Telegram username" : "Numeric Telegram ID"}
            htmlFor="grant-user-query"
            error={queryError}
          >
            <div className="flex gap-2">
              <Input
                id="grant-user-query"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSelectedUser(null)
                  setLookupResult({ kind: "idle" })
                }}
                onKeyDown={onQueryKeyDown}
                inputMode={lookupBy === "id" ? "numeric" : undefined}
                placeholder={lookupBy === "username" ? "@username" : "123456789"}
                autoComplete="off"
                spellCheck={false}
                readOnly={lookupPending}
                aria-invalid={queryError !== undefined || undefined}
                aria-describedby={queryError ? fieldHintId("grant-user-query") : undefined}
                className={cn("h-9 flex-1", fieldControl, lookupBy === "id" && "font-mono tabular-nums")}
              />
              <LoadingButton
                type="button"
                variant="outline"
                icon={Search}
                pending={lookupPending}
                onClick={() => void findUser()}
                className="min-w-[112px]"
              >
                {lookupPending ? "Looking up…" : "Find user"}
              </LoadingButton>
            </div>
          </FormField>
          <div aria-live="polite" className="empty:hidden">
            {lookupResult.kind === "not-found" && (
              <InlineAlert tone="neutral">
                <p className="font-medium">User not found</p>
                <p className="text-(--pn-fg-muted)">{lookupResult.message}</p>
              </InlineAlert>
            )}
            {selectedUser && (
              <InlineAlert
                tone="success"
                action={
                  <IconButton
                    label={`Clear selected user ${telegramUserName(selectedUser)}`}
                    icon={X}
                    onClick={() => {
                      setSelectedUser(null)
                      setQuery("")
                    }}
                  />
                }
              >
                <SelectedUser user={selectedUser} />
              </InlineAlert>
            )}
          </div>
        </>
      ) : (
        <>
          {selectedUser && (
            <div className="rounded-(--pn-r-3) bg-(--pn-muted) p-3 text-[13px] leading-5">
              <SelectedUser user={selectedUser} />
            </div>
          )}
          <GrantDateTimeFields
            validSince={validSince}
            validUntil={validUntil}
            onValidSinceChange={setValidSince}
            onValidUntilChange={setValidUntil}
            minimumSince={minimumSince}
            minimumUntil={since ?? minimumSince}
            invalidStart={invalidStart}
            invalidEnd={invalidEnd}
          />
          <FormField
            label="Motivation"
            htmlFor="grant-reason"
            optional
            counter={{ length: reason.length, max: REASON_MAX }}
          >
            <Textarea
              id="grant-reason"
              value={reason}
              maxLength={REASON_MAX}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why is this grant authorized?"
              className={cn("min-h-[76px]", fieldControl)}
            />
          </FormField>
        </>
      )}
    </FormDialog>
  )
}

function SelectedUser({ user }: { user: GrantDialogUser }) {
  return (
    <>
      <p className="font-medium text-(--pn-fg)">{telegramUserName(user)}</p>
      <p className="text-(--pn-fg-muted)">
        {user.username && `@${user.username} · `}Telegram ID <span className="font-mono tabular-nums">{user.id}</span>
      </p>
    </>
  )
}

type GrantStepperProps = {
  step: Step
  canOpenDetails: boolean
  onStepChange: (step: Step) => void
}

const STEPS: { value: Step; title: string }[] = [
  { value: "user", title: "Target user" },
  { value: "details", title: "Details" },
]

/** Two 4px progress bars with 12px labels; the second step opens once a user is selected. */
function GrantStepper({ step, canOpenDetails, onStepChange }: GrantStepperProps) {
  const currentIndex = STEPS.findIndex((item) => item.value === step)
  return (
    <ol aria-label="Grant creation progress" className="grid grid-cols-2 gap-4">
      {STEPS.map((item, index) => {
        const reached = index <= currentIndex
        const disabled = item.value === "details" && !canOpenDetails
        return (
          <li key={item.value}>
            <button
              type="button"
              disabled={disabled}
              aria-current={item.value === step ? "step" : undefined}
              onClick={() => onStepChange(item.value)}
              className="group/step flex w-full flex-col gap-2 rounded-(--pn-r-1) text-left disabled:cursor-not-allowed"
            >
              <span
                aria-hidden
                className={cn("h-1 w-full rounded-full", reached ? "bg-(--pn-accent-solid)" : "bg-(--pn-muted)")}
              />
              <span
                className={cn(
                  "text-xs transition-[color] duration-120",
                  reached ? "text-(--pn-fg)" : "text-(--pn-fg-muted) group-enabled/step:group-hover/step:text-(--pn-fg)"
                )}
              >
                <span className="sr-only">Step {index + 1}: </span>
                {item.title}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
