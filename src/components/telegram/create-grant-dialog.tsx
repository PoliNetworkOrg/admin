import { useRouter } from "@tanstack/react-router"
import { ArrowLeft, CalendarPlus, LoaderCircle, Search, UserRound, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperTitle,
  StepperTrigger,
} from "@/components/reui/stepper"
import type { TgUser } from "@/lib/api/types"
import { createTelegramGrant, findTelegramUser } from "@/server/api.functions"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "../ui/alert"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "../ui/field"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group"
import { GrantDateTimeFields } from "./grant-date-time-fields"

export type GrantDialogUser = Pick<TgUser, "id" | "firstName" | "lastName" | "username">

type CreateGrantDialogProps = {
  user?: GrantDialogUser
}

const DISCARD_TOAST_ID = "discard-grant-dialog-changes"

function toDateTimeInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function earliestGrantStart() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start
}

function displayName(user: GrantDialogUser) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unnamed account"
}

function grantMutationError(error: string) {
  if (error === "UNAUTHORIZED") return "You do not have permission to create grants."
  if (error === "ALREADY_EXISTING") return "This user already has an ongoing grant."
  return "The grant could not be created."
}

function UserInformation({
  user,
  clearable,
  onClear,
}: {
  user: GrantDialogUser
  clearable?: boolean
  onClear?: () => void
}) {
  return (
    <Alert>
      <UserRound />
      <AlertTitle>{displayName(user)}</AlertTitle>
      <AlertDescription>
        {user.username ? `@${user.username}` : "No Telegram username"} · Telegram ID {user.id}
      </AlertDescription>
      {clearable && onClear && (
        <AlertAction>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            aria-label={`Clear selected user ${displayName(user)}`}
          >
            <X />
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}

function GrantStepper({
  step,
  canOpenDetails,
  onStepChange,
}: {
  step: "user" | "details"
  canOpenDetails: boolean
  onStepChange: (step: "user" | "details") => void
}) {
  const steps = [
    { title: "Target user", value: 1 },
    { title: "Details", value: 2 },
  ]

  return (
    <Stepper
      value={step === "user" ? 1 : 2}
      onValueChange={(value) => {
        if (value === 1) onStepChange("user")
        if (value === 2 && canOpenDetails) onStepChange("details")
      }}
      className="p-5"
      aria-label="Grant creation progress"
    >
      <StepperNav className="gap-5">
        {steps.map((item) => (
          <StepperItem key={item.value} step={item.value} className="relative flex-1 items-start">
            <StepperTrigger
              className="flex grow flex-col justify-center gap-3.5"
              disabled={item.value === 2 && !canOpenDetails}
            >
              <StepperIndicator className="h-1 w-full rounded-full bg-border data-[state=active]:bg-primary data-[state=completed]:bg-primary">
                <span className="sr-only">Step {item.value}</span>
              </StepperIndicator>
              <StepperTitle className="text-center font-semibold group-data-[state=inactive]/step:text-muted-foreground">
                {item.title}
              </StepperTitle>
            </StepperTrigger>
          </StepperItem>
        ))}
      </StepperNav>
    </Stepper>
  )
}

export function CreateGrantDialog({ user: fixedUser }: CreateGrantDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"user" | "details">(fixedUser ? "details" : "user")
  const [lookupBy, setLookupBy] = useState<"username" | "id">("username")
  const [query, setQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<GrantDialogUser | null>(fixedUser ?? null)
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "not-found" | "error">("idle")
  const [lookupMessage, setLookupMessage] = useState("")
  const [validSince, setValidSince] = useState("")
  const [validUntil, setValidUntil] = useState("")
  const [reason, setReason] = useState("")
  const [dirty, setDirty] = useState(false)
  const [pending, setPending] = useState(false)
  const router = useRouter()

  const resetForm = () => {
    setStep(fixedUser ? "details" : "user")
    setLookupBy("username")
    setQuery("")
    setSelectedUser(fixedUser ?? null)
    setLookupStatus("idle")
    setLookupMessage("")
    setValidSince("")
    setValidUntil("")
    setReason("")
    setDirty(false)
  }

  const closeAndReset = () => {
    toast.dismiss(DISCARD_TOAST_ID)
    setOpen(false)
    resetForm()
  }

  const requestClose = () => {
    if (pending) return
    if (!dirty) {
      closeAndReset()
      return
    }

    toast.warning("Discard grant changes?", {
      id: DISCARD_TOAST_ID,
      description: "Your edits will be lost.",
      position: "bottom-center",
      duration: Number.POSITIVE_INFINITY,
      className: "grant-discard-toast",
      action: {
        label: "Discard",
        onClick: closeAndReset,
      },
      cancel: {
        label: "Keep editing",
        onClick: () => undefined,
      },
    })
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      resetForm()
      setOpen(true)
      return
    }
    requestClose()
  }

  const changeLookupBy = (value: string[]) => {
    const next = value[0]
    if (next !== "username" && next !== "id") return
    setLookupBy(next)
    setQuery("")
    setSelectedUser(null)
    setLookupStatus("idle")
    setLookupMessage("")
    setDirty(true)
  }

  const lookup = async () => {
    const normalized = query.trim()
    const numericId = Number(normalized)
    if (!normalized || (lookupBy === "id" && (!Number.isInteger(numericId) || numericId <= 0))) {
      setLookupStatus("error")
      setLookupMessage(lookupBy === "id" ? "Enter a positive numeric Telegram ID." : "Enter a Telegram username.")
      return
    }

    setSelectedUser(null)
    setLookupStatus("loading")
    setLookupMessage("")
    try {
      const result = await findTelegramUser({
        data: lookupBy === "username" ? { by: "username", username: normalized } : { by: "id", userId: numericId },
      })
      if (result.status === "found" && result.user) {
        setSelectedUser(result.user)
        setLookupStatus("idle")
      } else {
        setLookupStatus(result.status === "not-found" ? "not-found" : "error")
        setLookupMessage(
          result.status === "not-found"
            ? `No Telegram user was found for this ${lookupBy === "id" ? "ID" : "username"}.`
            : (result.message ?? "Telegram user lookup failed.")
        )
      }
    } catch (error) {
      console.error(error)
      setLookupStatus("error")
      setLookupMessage("Telegram user lookup failed. Check your connection and try again.")
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const since = new Date(validSince)
    const until = new Date(validUntil)
    if (
      !selectedUser ||
      !validSince ||
      !validUntil ||
      Number.isNaN(since.getTime()) ||
      Number.isNaN(until.getTime()) ||
      since < earliestGrantStart() ||
      until <= since ||
      pending
    )
      return

    setPending(true)
    try {
      const result = await createTelegramGrant({
        data: { userId: selectedUser.id, since, until, reason: reason.trim() || undefined },
      })
      if (result.error) {
        toast.error(grantMutationError(result.error))
        return
      }
      toast.success(`Grant created for ${displayName(selectedUser)}.`)
      closeAndReset()
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
      toast.error("The grant could not be created. Check your permissions and try again.")
    } finally {
      setPending(false)
    }
  }

  const sinceTime = new Date(validSince).getTime()
  const untilTime = new Date(validUntil).getTime()
  const minimumSince = toDateTimeInput(earliestGrantStart())
  const invalidStart = Boolean(validSince) && (Number.isNaN(sinceTime) || sinceTime < earliestGrantStart().getTime())
  const invalidEnd = Boolean(validUntil) && (Number.isNaN(untilTime) || (Boolean(validSince) && untilTime <= sinceTime))
  const detailsUser = fixedUser ?? selectedUser

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <CalendarPlus data-icon="inline-start" /> Add grant
      </DialogTrigger>
      <DialogContent className="max-w-lg gap-0 overflow-hidden border-border p-0">
        <DialogHeader className="gap-5 border-b border-border py-5 pr-16 pl-6">
          <DialogTitle className="text-xl font-semibold tracking-[-0.03em]">New Grant</DialogTitle>
        </DialogHeader>

        {!fixedUser && <GrantStepper step={step} canOpenDetails={Boolean(selectedUser)} onStepChange={setStep} />}

        {step === "user" ? (
          <form
            className="flex flex-col gap-4 px-6 pb-5"
            onSubmit={(event) => {
              event.preventDefault()
              void lookup()
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="grant-user-lookup-method">Find Telegram user</FieldLabel>
                <ToggleGroup
                  id="grant-user-lookup-method"
                  variant="outline"
                  size="sm"
                  value={[lookupBy]}
                  onValueChange={changeLookupBy}
                  disabled={lookupStatus === "loading"}
                  aria-label="Telegram user lookup method"
                >
                  <ToggleGroupItem value="username">Username</ToggleGroupItem>
                  <ToggleGroupItem value="id">Telegram ID</ToggleGroupItem>
                </ToggleGroup>
              </Field>
              <Field data-invalid={lookupStatus === "error" || undefined}>
                <FieldLabel htmlFor="grant-user-query">
                  {lookupBy === "username" ? "Telegram username" : "Numeric Telegram ID"}
                </FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="grant-user-query"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value)
                      setSelectedUser(null)
                      setLookupStatus("idle")
                      setLookupMessage("")
                      setDirty(true)
                    }}
                    type={lookupBy === "id" ? "text" : "search"}
                    inputMode={lookupBy === "id" ? "numeric" : undefined}
                    placeholder={lookupBy === "username" ? "@username" : "123456789"}
                    autoComplete="off"
                    disabled={lookupStatus === "loading"}
                    aria-invalid={lookupStatus === "error"}
                    aria-describedby="grant-user-status"
                  />
                  <Button type="submit" variant="secondary" disabled={!query.trim() || lookupStatus === "loading"}>
                    {lookupStatus === "loading" ? (
                      <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />
                    ) : (
                      <Search data-icon="inline-start" />
                    )}
                    {lookupStatus === "loading" ? "Looking up" : "Find user"}
                  </Button>
                </div>
                {lookupStatus === "error" && <FieldError id="grant-user-status">{lookupMessage}</FieldError>}
              </Field>
            </FieldGroup>
            {(lookupStatus === "not-found" || selectedUser) && (
              <div aria-live="polite">
                {lookupStatus === "not-found" && (
                  <Alert id="grant-user-status">
                    <UserRound />
                    <AlertTitle>User not found</AlertTitle>
                    <AlertDescription>{lookupMessage}</AlertDescription>
                  </Alert>
                )}
                {selectedUser && (
                  <UserInformation
                    user={selectedUser}
                    clearable
                    onClear={() => {
                      setSelectedUser(null)
                      setQuery("")
                      setDirty(true)
                    }}
                  />
                )}
              </div>
            )}
            <DialogFooter className="-mx-6 -mb-5 mt-1 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
              <Button type="button" variant="outline" size="sm" onClick={closeAndReset}>
                Cancel
              </Button>
              <Button type="button" size="sm" disabled={!selectedUser} onClick={() => setStep("details")}>
                Continue
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form className="flex flex-col gap-3 px-6 py-4" onSubmit={(event) => void submit(event)}>
            {!fixedUser && (
              <Button type="button" variant="ghost" size="xs" className="-ml-2 w-fit" onClick={() => setStep("user")}>
                <ArrowLeft data-icon="inline-start" /> Change user
              </Button>
            )}
            {detailsUser && <UserInformation user={detailsUser} />}
            <GrantDateTimeFields
              validSince={validSince}
              validUntil={validUntil}
              onValidSinceChange={(value) => {
                setValidSince(value)
                setDirty(true)
              }}
              onValidUntilChange={(value) => {
                setValidUntil(value)
                setDirty(true)
              }}
              minimumSince={minimumSince}
              minimumUntil={validSince || minimumSince}
              invalidStart={invalidStart}
              invalidEnd={invalidEnd}
            />
            <Field>
              <FieldLabel htmlFor="grant-reason">
                Motivation <span className="font-normal text-muted-foreground">(optional)</span>
              </FieldLabel>
              <Textarea
                id="grant-reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value)
                  setDirty(true)
                }}
                placeholder="Why is this grant authorized?"
                maxLength={500}
              />
            </Field>
            <DialogFooter className="-mx-6 -mb-5 mt-1 flex-row justify-end border-t border-border bg-muted/50 px-6 py-4">
              <Button type="button" variant="outline" size="sm" onClick={closeAndReset}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!detailsUser || !validSince || !validUntil || invalidStart || invalidEnd || pending}
              >
                {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
                Create grant
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
