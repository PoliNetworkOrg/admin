import type { ReactNode } from "react"
import type { z } from "zod"

import { DateField, fieldControl, fieldHintId, FormField, InlineAlert } from "@/components/primitives"
import { Input } from "@/components/ui/input"
import { formatDay } from "@/features/people/people-format"
import { cn } from "@/lib/utils"

import { codiceFiscaleProblem, matchesBirthDate, normalizeCodiceFiscale } from "./codice-fiscale"
import { formatMemberNumber, socioName } from "./soci-format"
import type { SocioDetails, SocioRow } from "./soci.contract"

/** What the bookkeeping fields hold while editing: plain strings, empty when unknown. */
export type DetailsDraft = {
  firstName: string
  lastName: string
  alias: string
  codiceFiscale: string
  birthDate: string
  birthPlace: string
  street: string
  postalCode: string
  city: string
  province: string
  country: string
}

export const EMPTY_DETAILS: DetailsDraft = {
  firstName: "",
  lastName: "",
  alias: "",
  codiceFiscale: "",
  birthDate: "",
  birthPlace: "",
  street: "",
  postalCode: "",
  city: "",
  province: "",
  country: "IT",
}

export function draftOf(details: SocioDetails): DetailsDraft {
  return {
    firstName: details.firstName,
    lastName: details.lastName,
    alias: details.alias ?? "",
    codiceFiscale: details.codiceFiscale ?? "",
    birthDate: details.birthDate ?? "",
    birthPlace: details.birthPlace ?? "",
    street: details.residence.street ?? "",
    postalCode: details.residence.postalCode ?? "",
    city: details.residence.city ?? "",
    province: details.residence.province ?? "",
    country: details.residence.country ?? "",
  }
}

/** The contract's input shape; the schemas trim, upper-case and turn empty strings into `null`. */
export function detailsInput(draft: DetailsDraft) {
  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    alias: draft.alias,
    codiceFiscale: draft.codiceFiscale,
    birthDate: draft.birthDate,
    birthPlace: draft.birthPlace,
    residence: {
      street: draft.street,
      postalCode: draft.postalCode,
      city: draft.city,
      province: draft.province,
      country: draft.country,
    },
  }
}

const FIELD_KEYS = [
  "firstName",
  "lastName",
  "alias",
  "codiceFiscale",
  "birthDate",
  "birthPlace",
  "street",
  "postalCode",
  "city",
  "province",
  "country",
  "account",
  "number",
  "admittedOn",
  "accountFirstName",
  "accountLastName",
  "accountEmail",
] as const
type FieldKey = (typeof FIELD_KEYS)[number]
export type FieldErrors = { [Key in FieldKey]?: string }

/**
 * The first message per field from a failed parse of a contract input: `details.residence.city` becomes `city`, and
 * `account.firstName` becomes `accountFirstName` (and `account.sendEmailTo` `accountEmail`), apart from the legal name.
 */
export function fieldErrors(error: z.ZodError | undefined) {
  const errors: FieldErrors = {}
  for (const issue of error?.issues ?? []) {
    const [head, next] = issue.path
    const name =
      head !== "account"
        ? issue.path.find((part) => part !== "details" && part !== "residence")
        : next === "firstName"
          ? "accountFirstName"
          : next === "lastName"
            ? "accountLastName"
            : next === "sendEmailTo"
              ? "accountEmail"
              : "account"
    const key = FIELD_KEYS.find((candidate) => candidate === name)
    if (key && !errors[key]) errors[key] = issue.message.startsWith("Invalid input") ? "Fill this in." : issue.message
  }
  return errors
}

/** The records that already have this codice fiscale, other than `self`. */
export function holdersOf(code: string, register: readonly SocioRow[], self?: number) {
  const normalized = normalizeCodiceFiscale(code)
  if (codiceFiscaleProblem(normalized)) return { active: null, former: [] }
  const same = register.filter((socio) => socio.codiceFiscale === normalized && socio.number !== self)
  return { active: same.find((socio) => !socio.endedOn) ?? null, former: same.filter((socio) => socio.endedOn) }
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="pt-1 text-[13px] font-semibold text-(--pn-fg)">{children}</h3>
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <Heading>{title}</Heading>
      {children}
    </section>
  )
}

type DetailsFieldsProps = {
  id: string
  draft: DetailsDraft
  onChange: (draft: DetailsDraft) => void
  errors: FieldErrors
  /** Admission needs everything but the alias; a socio registered afterwards may complete them later. */
  required: boolean
  /** The register, to warn when the codice fiscale belongs to a former or active socio. */
  register: readonly SocioRow[]
  /** The record being edited, which doesn't count as another holder of its own code. */
  self?: number
}

/** The bookkeeping data the association keeps: legal name, alias, codice fiscale, birth and residence. */
export function DetailsFields({ id, draft, onChange, errors, required, register, self }: DetailsFieldsProps) {
  const set = (key: keyof DetailsDraft) => (value: string) => onChange({ ...draft, [key]: value })
  const optional = !required
  const italy = draft.country.trim().toUpperCase() === "IT"
  const code = normalizeCodiceFiscale(draft.codiceFiscale)
  const holders = holdersOf(code, register, self)
  const dateMismatch =
    !errors.birthDate &&
    draft.birthDate !== "" &&
    !codiceFiscaleProblem(code) &&
    !matchesBirthDate(code, draft.birthDate)

  const text = (key: keyof DetailsDraft, label: string, props: { mono?: boolean; optional?: boolean } = {}) => (
    <FormField label={label} htmlFor={`${id}-${key}`} optional={props.optional} error={errors[key]}>
      <Input
        id={`${id}-${key}`}
        value={draft[key]}
        autoComplete="off"
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? fieldHintId(`${id}-${key}`) : undefined}
        onChange={(event) => set(key)(event.target.value)}
        className={cn("h-9", props.mono && "font-mono uppercase", fieldControl)}
      />
    </FormField>
  )

  return (
    <>
      <div className="grid gap-4 min-[480px]:grid-cols-2">
        {text("firstName", "Legal first name")}
        {text("lastName", "Legal last name")}
      </div>
      <FormField
        label="Alias"
        htmlFor={`${id}-alias`}
        optional
        hint="The name they go by, shown with the legal name and used to greet them in emails."
        error={errors.alias}
      >
        <Input
          id={`${id}-alias`}
          value={draft.alias}
          autoComplete="off"
          aria-describedby={fieldHintId(`${id}-alias`)}
          onChange={(event) => set("alias")(event.target.value)}
          className={cn("h-9", fieldControl)}
        />
      </FormField>
      {text("codiceFiscale", "Codice fiscale", { mono: true, optional })}
      {holders.active ? (
        <InlineAlert tone="danger">
          This codice fiscale belongs to socio {formatMemberNumber(holders.active.number)}, {socioName(holders.active)},
          who is still active.
        </InlineAlert>
      ) : holders.former.length ? (
        <InlineAlert tone="warning">
          This codice fiscale belongs to a former socio:{" "}
          {holders.former
            .map(
              (socio) =>
                `${formatMemberNumber(socio.number)} ${socioName(socio)}, ended ${formatDay(socio.endedOn ?? "")}`
            )
            .join("; ")}
          . A new admission gets a new number.
        </InlineAlert>
      ) : null}
      <div className="grid gap-4 min-[480px]:grid-cols-2">
        <FormField
          label="Birth date"
          htmlFor={`${id}-birthDate`}
          optional={optional}
          error={errors.birthDate ?? (dateMismatch ? "The birth date doesn't match the codice fiscale." : undefined)}
        >
          <DateField
            id={`${id}-birthDate`}
            value={draft.birthDate}
            onChange={set("birthDate")}
            pastYears={100}
            futureYears={0}
            invalid={!!errors.birthDate || dateMismatch}
            describedBy={errors.birthDate || dateMismatch ? fieldHintId(`${id}-birthDate`) : undefined}
          />
        </FormField>
        {text("birthPlace", "Birth place", { optional })}
      </div>
      {text("street", "Street and number", { optional })}
      <div className="grid gap-4 min-[480px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        {text("postalCode", "Postal code", { optional })}
        {text("city", "City", { optional })}
      </div>
      <div className="grid gap-4 min-[480px]:grid-cols-2">
        <FormField
          label="Country"
          htmlFor={`${id}-country`}
          optional={optional}
          hint="Two letters, e.g. IT."
          error={errors.country}
        >
          <Input
            id={`${id}-country`}
            value={draft.country}
            maxLength={2}
            autoComplete="off"
            aria-describedby={fieldHintId(`${id}-country`)}
            onChange={(event) => {
              const country = event.target.value.toUpperCase()
              onChange({ ...draft, country, province: country === "IT" ? draft.province : "" })
            }}
            className={cn("h-9 font-mono uppercase", fieldControl)}
          />
        </FormField>
        {italy ? (
          <FormField
            label="Province"
            htmlFor={`${id}-province`}
            optional={optional}
            hint="Two letters, e.g. MI."
            error={errors.province}
          >
            <Input
              id={`${id}-province`}
              value={draft.province}
              maxLength={2}
              autoComplete="off"
              aria-describedby={fieldHintId(`${id}-province`)}
              onChange={(event) => set("province")(event.target.value.toUpperCase())}
              className={cn("h-9 font-mono uppercase", fieldControl)}
            />
          </FormField>
        ) : null}
      </div>
    </>
  )
}

/** Whether the parsed details may be sent: the codice fiscale isn't an active socio's and agrees with the birth date. */
export function detailsBlocked(draft: DetailsDraft, register: readonly SocioRow[], self?: number) {
  const code = normalizeCodiceFiscale(draft.codiceFiscale)
  if (holdersOf(code, register, self).active) return true
  return draft.birthDate !== "" && !codiceFiscaleProblem(code) && !matchesBirthDate(code, draft.birthDate)
}
