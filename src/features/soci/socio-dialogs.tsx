import { useNavigate } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Hash, TriangleAlert } from "lucide-react"
import { useState } from "react"

import {
  checkboxControl,
  ConfirmDialog,
  DateField,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  InlineAlert,
  SegmentedControl,
  SelectField,
} from "@/components/primitives"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { formatDay, romeDay, todayIso } from "@/features/people/people-format"
import { errorMessage, useRefreshAfter } from "@/features/people/people-hooks"
import { cn } from "@/lib/utils"

import { isLocalPart, isPoliNetworkAddress, MAIL_DOMAIN, type MailboxKind, standardLocalPart } from "./mailbox"
import { isMemberNumber } from "./member-number"
import { formatMemberNumber, socioName } from "./soci-format"
import { admitSocio, registerSocio, setSocioNumber, updateSocio } from "./soci-write.functions"
import {
  admitInputSchema,
  registerInputSchema,
  type SocioRecord,
  type SocioRow,
  type Unregistered,
  updateInputSchema,
} from "./soci.contract"
import {
  type DetailsDraft,
  detailsBlocked,
  DetailsFields,
  detailsInput,
  draftOf,
  EMPTY_DETAILS,
  type FieldErrors,
  fieldErrors,
  FormSection,
} from "./socio-form"

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void }

const MAILBOX_KINDS = [
  { value: "standard", label: "Standard" },
  { value: "custom", label: "Custom" },
] as const

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NUMBER_ERROR = "Enter a positive member number."

/** Today's fee year, written `2026/27`: it starts on 1 September. */
function feeYear(date: string) {
  const [year = 0, month = 0] = date.split("-").map(Number)
  const start = month >= 9 ? year : year - 1
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`
}

function AdmissionDate({
  id,
  value,
  onChange,
  error,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  return (
    <FormField label="Admission date" htmlFor={id} error={error}>
      <DateField
        id={id}
        value={value}
        onChange={onChange}
        pastYears={15}
        futureYears={0}
        invalid={!!error}
        describedBy={error ? fieldHintId(id) : undefined}
      />
    </FormField>
  )
}

/**
 * Admit socio: today's Microsoft 365 account (name, address, member number, welcome email), the bookkeeping data and
 * the admission date. The backend creates the account in Soci, then writes the record, and deletes the account if the
 * record can't be written.
 */
export function AdmitSocioDialog({ open, onOpenChange, register }: DialogProps & { register: readonly SocioRow[] }) {
  const admit = useServerFn(admitSocio)
  const refresh = useRefreshAfter()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [mailbox, setMailbox] = useState<MailboxKind>("standard")
  const [customLocalPart, setCustomLocalPart] = useState("")
  const [email, setEmail] = useState("")
  const [number, setNumber] = useState("")
  const [details, setDetails] = useState<DetailsDraft>(EMPTY_DETAILS)
  /** The legal name follows the account's until it is edited. */
  const [legalEdited, setLegalEdited] = useState(false)
  const [admittedOn, setAdmittedOn] = useState(todayIso())
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [confirmingRecipient, setConfirmingRecipient] = useState(false)

  const namesGiven = firstName.trim() !== "" && lastName.trim() !== ""
  const standard = namesGiven ? standardLocalPart(firstName, lastName) : null
  const localPart = mailbox === "standard" ? standard : isLocalPart(customLocalPart) ? customLocalPart : null
  const address = localPart === null ? null : `${localPart}@${MAIL_DOMAIN}`
  const recipient = email.trim()
  const sameAddress = address !== null && recipient.toLowerCase() === address
  const addressError =
    mailbox === "standard"
      ? namesGiven && standard === null
        ? "This name can't form a standard address. Choose Custom."
        : undefined
      : submitted && localPart === null
        ? "Use lowercase letters and digits, with single dots or hyphens between them."
        : undefined
  const emailError = submitted
    ? !EMAIL_PATTERN.test(recipient)
      ? "Enter a valid email address."
      : sameAddress
        ? "This is the address being created and has no mailbox yet. Use the person's personal email."
        : undefined
    : undefined
  const numberError = submitted && !isMemberNumber(number) ? NUMBER_ERROR : errors.number
  const takenNumber = register.find((socio) => String(socio.number) === number)

  function setAccountName(next: { firstName?: string; lastName?: string }) {
    const first = next.firstName ?? firstName
    const last = next.lastName ?? lastName
    setFirstName(first)
    setLastName(last)
    if (!legalEdited) setDetails((current) => ({ ...current, firstName: first, lastName: last }))
  }

  const dirty =
    [firstName, lastName, customLocalPart, email, number].some((value) => value.trim() !== "") ||
    JSON.stringify(details) !== JSON.stringify({ ...EMPTY_DETAILS, firstName, lastName })

  async function create() {
    const parsed = admitInputSchema.parse(input())
    try {
      const result = await admit({ data: parsed })
      onOpenChange(false)
      await refresh(
        result.welcomeMailSent
          ? `${formatMemberNumber(result.number)} admitted: ${result.mailbox} created and the welcome email sent.`
          : `${formatMemberNumber(result.number)} admitted and ${result.mailbox} created, but the welcome email couldn't be sent.`,
        result.welcomeMailSent ? "success" : "warning"
      )
      await navigate({ to: "/dashboard/people/soci/$number", params: { number: String(result.number) } })
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't admit the socio. Check the values and try again."), {
        cause: caught,
      })
    }
  }

  function input() {
    return {
      account: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mailbox:
          mailbox === "custom"
            ? { kind: "custom" as const, localPart: localPart ?? "" }
            : { kind: "standard" as const },
        sendEmailTo: recipient,
      },
      number: Number.parseInt(number, 10),
      details: detailsInput(details),
      admittedOn,
    }
  }

  async function submit() {
    setSubmitted(true)
    const parsed = admitInputSchema.safeParse(input())
    setErrors(fieldErrors(parsed.error))
    if (!isMemberNumber(number) || takenNumber) return
    if (!parsed.success || localPart === null || sameAddress || detailsBlocked(details, register)) return
    // The welcome email carries the new account's credentials, so it normally goes to a personal address.
    if (isPoliNetworkAddress(recipient)) {
      setConfirmingRecipient(true)
      return
    }
    await create()
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Admit socio"
      description="Creates their Microsoft 365 account in Soci and their record in the register."
      noun="admission"
      dirty={dirty}
      canSubmit={namesGiven && recipient !== "" && number !== ""}
      submitLabel="Admit socio"
      onSubmit={submit}
    >
      <FormSection title="Microsoft 365 account">
        <div className="grid gap-4 min-[480px]:grid-cols-2">
          <FormField
            label="First name"
            htmlFor="admit-first-name"
            hint="As the account shows it."
            error={errors.accountFirstName}
          >
            <Input
              id="admit-first-name"
              value={firstName}
              autoComplete="off"
              aria-invalid={errors.accountFirstName ? true : undefined}
              aria-describedby={fieldHintId("admit-first-name")}
              onChange={(event) => setAccountName({ firstName: event.target.value })}
              className={cn("h-9", fieldControl)}
            />
          </FormField>
          <FormField label="Last name" htmlFor="admit-last-name" error={errors.accountLastName}>
            <Input
              id="admit-last-name"
              value={lastName}
              autoComplete="off"
              aria-invalid={errors.accountLastName ? true : undefined}
              aria-describedby={errors.accountLastName ? fieldHintId("admit-last-name") : undefined}
              onChange={(event) => setAccountName({ lastName: event.target.value })}
              className={cn("h-9", fieldControl)}
            />
          </FormField>
        </div>
        <div role="group" aria-labelledby="admit-address-label" className="flex flex-col gap-1.5">
          <span id="admit-address-label" className="text-[13px] leading-5 font-medium text-(--pn-fg)">
            New Microsoft 365 address
          </span>
          <SegmentedControl label="Address format" items={MAILBOX_KINDS} value={mailbox} onValueChange={setMailbox} />
          {mailbox === "standard" ? (
            <output
              aria-live="polite"
              aria-describedby={fieldHintId("admit-address")}
              className={cn(
                "flex min-h-9 items-center rounded-(--pn-r-3) border border-(--pn-line) bg-(--pn-muted) px-3 font-mono text-[13px] break-all",
                address ? "text-(--pn-fg)" : "text-(--pn-fg-subtle)"
              )}
            >
              {address ?? `firstname.lastname@${MAIL_DOMAIN}`}
            </output>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                id="admit-local-part"
                value={customLocalPart}
                autoComplete="off"
                spellCheck={false}
                aria-label="Address before @polinetwork.org"
                aria-invalid={addressError ? true : undefined}
                aria-describedby={fieldHintId("admit-address")}
                onChange={(event) => setCustomLocalPart(event.target.value.replace(/\s/g, "").toLowerCase())}
                className={cn("h-9 min-w-0 flex-1 font-mono", fieldControl)}
              />
              <span className="shrink-0 font-mono text-[13px] text-(--pn-fg-muted)">@{MAIL_DOMAIN}</span>
            </div>
          )}
          <p
            id={fieldHintId("admit-address")}
            className={cn("text-xs", addressError ? "text-(--pn-danger-fg)" : "text-(--pn-fg-muted)")}
          >
            {addressError ??
              (mailbox === "standard"
                ? "Built from the first and last name, without accents, apostrophes or spaces."
                : "Lowercase letters, digits, dots and hyphens.")}
          </p>
        </div>
        <div className="grid gap-4 min-[480px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <FormField
            label="Send the welcome email to"
            htmlFor="admit-email"
            hint="Their personal email. It isn't stored."
            error={emailError}
          >
            <Input
              id="admit-email"
              type="email"
              value={email}
              autoComplete="off"
              spellCheck={false}
              placeholder="name@example.com"
              aria-invalid={emailError ? true : undefined}
              aria-describedby={fieldHintId("admit-email")}
              onChange={(event) => setEmail(event.target.value)}
              className={cn("h-9", fieldControl)}
            />
          </FormField>
          <FormField
            label="Member number"
            htmlFor="admit-number"
            error={
              numberError ??
              (takenNumber ? `Already given to ${socioName(takenNumber)}: numbers are never reused.` : undefined)
            }
          >
            <Input
              id="admit-number"
              inputMode="numeric"
              value={number}
              autoComplete="off"
              aria-invalid={numberError || takenNumber ? true : undefined}
              aria-describedby={numberError || takenNumber ? fieldHintId("admit-number") : undefined}
              onChange={(event) => setNumber(event.target.value.trim())}
              className={cn("h-9 font-mono tabular-nums", fieldControl)}
            />
          </FormField>
        </div>
      </FormSection>
      <FormSection title="Bookkeeping data">
        <DetailsFields
          id="admit"
          draft={details}
          onChange={(next) => {
            if (next.firstName !== details.firstName || next.lastName !== details.lastName) setLegalEdited(true)
            setDetails(next)
          }}
          errors={errors}
          required
          register={register}
        />
      </FormSection>
      <FormSection title="Admission">
        <AdmissionDate id="admit-date" value={admittedOn} onChange={setAdmittedOn} error={errors.admittedOn} />
        <InlineAlert tone="neutral">
          The Direttivo admits someone once they've paid: the {feeYear(admittedOn)} fee counts as paid on the admission
          date.
        </InlineAlert>
      </FormSection>
      <ConfirmDialog
        open={confirmingRecipient}
        onOpenChange={setConfirmingRecipient}
        title="Send credentials to a PoliNetwork address?"
        description={
          <>
            <span className="font-mono break-all">{recipient}</span> will receive the sign-in details for{" "}
            <span className="font-mono break-all">{address}</span>.
          </>
        }
        confirmLabel="Send to this address"
        cancelLabel="Change recipient"
        tone="primary"
        icon={TriangleAlert}
        onConfirm={create}
      />
    </FormDialog>
  )
}

/**
 * Register an account already in Soci: its number is the account's (or one chosen, when it has none), the admission
 * date is suggested from the account's creation, and only the legal name is required. The socio can complete the rest.
 */
export function RegisterSocioDialog({
  open,
  onOpenChange,
  accounts,
  register,
}: DialogProps & { accounts: readonly Unregistered[]; register: readonly SocioRow[] }) {
  const registerSocioFn = useServerFn(registerSocio)
  const refresh = useRefreshAfter()
  const [accountId, setAccountId] = useState<string | null>(
    accounts.length === 1 ? (accounts[0]?.entraObjectId ?? null) : null
  )
  const account = accounts.find((candidate) => candidate.entraObjectId === accountId) ?? null
  const [details, setDetails] = useState<DetailsDraft>(() => prefill(account))
  const [admittedOn, setAdmittedOn] = useState(() => suggestedDate(account))
  const [number, setNumber] = useState("")
  const [errors, setErrors] = useState<FieldErrors>({})
  const fixedNumber = account?.employeeId && isMemberNumber(account.employeeId) ? account.employeeId : null

  // Nothing but the name is known yet, so the country starts empty too.
  function prefill(next: Unregistered | null): DetailsDraft {
    return { ...EMPTY_DETAILS, country: "", firstName: next?.givenName ?? "", lastName: next?.surname ?? "" }
  }
  // The day in Rome, as the hint shows it: the fee year turns on that calendar.
  function suggestedDate(next: Unregistered | null) {
    return next?.createdDateTime ? romeDay(next.createdDateTime) : todayIso()
  }
  function choose(id: string) {
    const next = accounts.find((candidate) => candidate.entraObjectId === id) ?? null
    setAccountId(id)
    setDetails(prefill(next))
    setAdmittedOn(suggestedDate(next))
    setNumber("")
    setErrors({})
  }

  function input() {
    return {
      entraObjectId: accountId ?? "",
      number: fixedNumber ? undefined : number === "" ? undefined : Number.parseInt(number, 10),
      details: detailsInput(details),
      admittedOn,
    }
  }

  async function submit() {
    if (!account) return setErrors({ account: "Choose the account." })
    if (!fixedNumber && !isMemberNumber(number)) return setErrors({ number: NUMBER_ERROR })
    const parsed = registerInputSchema.safeParse(input())
    setErrors(fieldErrors(parsed.error))
    if (!parsed.success || detailsBlocked(details, register)) return
    try {
      const result = await registerSocioFn({ data: parsed.data })
      onOpenChange(false)
      await refresh(`${account.displayName ?? "Socio"} registered as ${formatMemberNumber(result.number)}.`)
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't register the socio. Check the values and try again."), {
        cause: caught,
      })
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Register existing socio"
      description="For an account already in Soci without a record. Fields left empty can be completed later."
      noun="registration"
      dirty={
        account !== null &&
        (JSON.stringify(details) !== JSON.stringify(prefill(account)) ||
          admittedOn !== suggestedDate(account) ||
          number !== "")
      }
      canSubmit={account !== null}
      submitLabel="Register socio"
      onSubmit={submit}
    >
      <FormSection title="Microsoft 365 account">
        <FormField label="Account" htmlFor="register-account" error={errors.account}>
          <SelectField
            id="register-account"
            value={accountId}
            placeholder="Choose an account in Soci"
            options={accounts.map((candidate) => ({
              value: candidate.entraObjectId,
              label: `${candidate.displayName ?? "Unnamed"} · ${candidate.mail ?? candidate.entraObjectId}`,
            }))}
            onChange={choose}
            invalid={!!errors.account}
          />
        </FormField>
        {account ? (
          fixedNumber ? (
            <p className="text-[13px] text-(--pn-fg-muted)">
              Member number <span className="font-mono text-(--pn-fg)">{formatMemberNumber(Number(fixedNumber))}</span>,
              from Microsoft 365. Change it after registering, if needed.
            </p>
          ) : (
            <FormField
              label="Member number"
              htmlFor="register-number"
              hint="The account has none in Microsoft 365: it gets this one."
              error={errors.number}
            >
              <Input
                id="register-number"
                inputMode="numeric"
                value={number}
                autoComplete="off"
                aria-describedby={fieldHintId("register-number")}
                onChange={(event) => setNumber(event.target.value.trim())}
                className={cn("h-9 font-mono tabular-nums", fieldControl)}
              />
            </FormField>
          )
        ) : null}
      </FormSection>
      {account ? (
        <>
          <FormSection title="Bookkeeping data">
            <DetailsFields
              id="register"
              draft={details}
              onChange={setDetails}
              errors={errors}
              required={false}
              register={register}
            />
          </FormSection>
          <FormSection title="Admission">
            <FormField
              label="Admission date"
              htmlFor="register-date"
              hint={
                account.createdDateTime
                  ? `Suggested from the account's creation, ${formatDay(account.createdDateTime)}.`
                  : undefined
              }
              error={errors.admittedOn}
            >
              <DateField
                id="register-date"
                value={admittedOn}
                onChange={setAdmittedOn}
                pastYears={15}
                futureYears={0}
                describedBy={fieldHintId("register-date")}
              />
            </FormField>
          </FormSection>
        </>
      ) : null}
    </FormDialog>
  )
}

/** Edit the bookkeeping data and the admission date. Only the legal name is required. */
export function EditSocioDialog({
  open,
  onOpenChange,
  socio,
  register,
}: DialogProps & { socio: SocioRecord; register: readonly SocioRow[] }) {
  const update = useServerFn(updateSocio)
  const refresh = useRefreshAfter()
  const initial = draftOf(socio)
  const [details, setDetails] = useState<DetailsDraft>(initial)
  const [admittedOn, setAdmittedOn] = useState(socio.admittedOn)
  const [errors, setErrors] = useState<FieldErrors>({})
  // An ended record may share its code with the person's current one.
  const others = socio.endedOn ? [] : register

  async function submit() {
    const parsed = updateInputSchema.safeParse({ number: socio.number, details: detailsInput(details), admittedOn })
    setErrors(fieldErrors(parsed.error))
    if (!parsed.success || detailsBlocked(details, others, socio.number)) return
    try {
      await update({ data: parsed.data })
      onOpenChange(false)
      await refresh("Socio updated.")
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't save the changes. Check the values and try again."), {
        cause: caught,
      })
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="Edit socio"
      description={`${formatMemberNumber(socio.number)} · ${socioName(socio)}`}
      noun="socio"
      dirty={JSON.stringify(details) !== JSON.stringify(initial) || admittedOn !== socio.admittedOn}
      submitLabel="Save"
      onSubmit={submit}
    >
      <FormSection title="Bookkeeping data">
        <DetailsFields
          id="edit"
          draft={details}
          onChange={setDetails}
          errors={errors}
          required={false}
          register={others}
          self={socio.number}
        />
      </FormSection>
      <FormSection title="Admission">
        <AdmissionDate id="edit-date" value={admittedOn} onChange={setAdmittedOn} error={errors.admittedOn} />
      </FormSection>
    </FormDialog>
  )
}

/**
 * Change number: on the Microsoft 365 account (`employeeId`) and on the record, after a confirmation, optionally
 * emailing it. The old number is never given to anyone else.
 */
export function ChangeNumberDialog({
  open,
  onOpenChange,
  socio,
}: DialogProps & { socio: Pick<SocioRecord, "number" | "firstName" | "lastName" | "mailbox"> }) {
  const setNumberFn = useServerFn(setSocioNumber)
  const refresh = useRefreshAfter()
  const navigate = useNavigate()
  const [number, setNumber] = useState("")
  const [notify, setNotify] = useState(true)
  const [email, setEmail] = useState(socio.mailbox)
  const [submitted, setSubmitted] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const recipient = email.trim()
  const numberError = submitted
    ? !isMemberNumber(number)
      ? NUMBER_ERROR
      : Number(number) === socio.number
        ? "That's the current number."
        : undefined
    : undefined
  const emailError = submitted && notify && !EMAIL_PATTERN.test(recipient) ? "Enter a valid email address." : undefined

  function submit() {
    setSubmitted(true)
    if (!isMemberNumber(number) || Number(number) === socio.number || (notify && !EMAIL_PATTERN.test(recipient))) return
    setConfirming(true)
  }

  async function save() {
    try {
      const result = await setNumberFn({
        data: { number: socio.number, newNumber: Number(number), notifyEmail: notify ? recipient : undefined },
      })
      onOpenChange(false)
      await navigate({ to: "/dashboard/people/soci/$number", params: { number: String(result.number) }, replace: true })
      await refresh(
        result.notificationSent === false
          ? "Number changed, but the email couldn't be sent."
          : result.notificationSent
            ? "Number changed and email sent."
            : "Number changed.",
        result.notificationSent === false ? "warning" : "success"
      )
    } catch (caught) {
      console.error(caught)
      throw new Error(errorMessage(caught, "Couldn't change the number. Check the value and try again."), {
        cause: caught,
      })
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Change number"
      description={`${socioName(socio)} · now ${formatMemberNumber(socio.number)}`}
      noun="number"
      dirty={number !== "" || !notify || email !== socio.mailbox}
      canSubmit={number !== "" && (!notify || recipient !== "")}
      submitLabel="Change number"
      onSubmit={submit}
    >
      <FormField
        label="New member number"
        htmlFor="socio-number"
        hint="Changes it in Microsoft 365 too. A number once given is never given to anyone else."
        error={numberError}
      >
        <Input
          id="socio-number"
          inputMode="numeric"
          value={number}
          autoComplete="off"
          aria-invalid={numberError ? true : undefined}
          aria-describedby={fieldHintId("socio-number")}
          onChange={(event) => setNumber(event.target.value.trim())}
          className={cn("h-9 font-mono tabular-nums", fieldControl)}
        />
      </FormField>
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox checked={notify} onCheckedChange={setNotify} className={checkboxControl} />
        <span className="text-[13px] leading-5 font-medium text-(--pn-fg)">Email the socio the new number</span>
      </label>
      {notify ? (
        <FormField label="Send the email to" htmlFor="socio-number-email" error={emailError}>
          <Input
            id="socio-number-email"
            type="email"
            value={email}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? fieldHintId("socio-number-email") : undefined}
            onChange={(event) => setEmail(event.target.value)}
            className={cn("h-9", fieldControl)}
          />
        </FormField>
      ) : null}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Change number?"
        description={
          <>
            {socioName(socio)} goes from {formatMemberNumber(socio.number)} to{" "}
            <strong className="font-semibold text-(--pn-fg)">
              {isMemberNumber(number) ? formatMemberNumber(Number(number)) : number}
            </strong>
            , in Microsoft 365 too. {formatMemberNumber(socio.number)} won't be given to anyone else.{" "}
            {notify ? (
              <>
                An email goes to <span className="font-mono break-all">{recipient}</span>.
              </>
            ) : (
              "No email is sent."
            )}
          </>
        }
        confirmLabel="Change number"
        tone="primary"
        icon={Hash}
        onConfirm={save}
      />
    </FormDialog>
  )
}
