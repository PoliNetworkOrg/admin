import { romeDay } from "@/features/people/people-format"

import { matchesBirthDate } from "./codice-fiscale"
import { feeYearLabel, feeYearOf, MAX_RECEIPT_BYTES, renewalDeadline, RECEIPT_TYPES } from "./soci-fees"
import type { SociApi } from "./soci.api.server"
import {
  type Fee,
  type FeeFile,
  SELF_FIELDS,
  type SocioActivity,
  type SocioDetails,
  type SocioRecord,
  type SocioRow,
} from "./soci.contract"
import { samplePdf, samplePng } from "./soci.samples.server"

/**
 * Agent mode's stand-in for the backend's `soci.members.*` procedures. State lives for the dev server's lifetime, so
 * changes show up on reload. It follows the backend's rules where a page depends on them: numbers are never reused
 * (by a record, or held by another account), one active record per codice fiscale, and only accounts in the Soci
 * group without a record can be registered, and fees follow the Regolamento's calendar. The sample register covers
 * active, ended, unregistered and mismatched soci, and this fee year has every status: paid, a receipt to review (after
 * an earlier rejection), due after a rejection, due without an upload, exempt after a summer admission, and not opened.
 * `AGENT_SOCIO` picks the socio My area shows.
 */

type Account = {
  id: string
  displayName: string
  givenName: string
  surname: string
  mail: string
  employeeId: string | null
  createdDateTime: string
}

type Stored = Omit<SocioRecord, "inSoci" | "mismatch" | "accountNumber" | "activity" | "fee" | "fees"> & {
  activity: SocioActivity[]
  /** Oldest year first. */
  fees: Fee[]
}

/** `held`: every number a record has ever held, and the account of that record. */
type State = {
  records: Stored[]
  accounts: Account[]
  soci: Set<string>
  held: Map<number, string>
  files: Map<string, FeeFile>
}

const AGENT = "sub-agent"

function account(id: string, name: string, employeeId: string | null, created: string): Account {
  const [givenName = "", surname = ""] = name.split(" ")
  return {
    id,
    displayName: name,
    givenName,
    surname,
    mail: `${givenName}.${surname}`.toLowerCase().replace(/[^a-z.]/g, "") + "@polinetwork.org",
    employeeId,
    createdDateTime: `${created}T09:00:00Z`,
  }
}

function record(
  number: number,
  acc: Account,
  admittedOn: string,
  details: Partial<SocioDetails>,
  end: Pick<Stored, "endedOn" | "endReason" | "endNote" | "accountState" | "accountDeletedOn"> | null = null
): Stored {
  const at = `${admittedOn}T10:00:00Z`
  return {
    number,
    entraObjectId: acc.id,
    mailbox: acc.mail,
    displayName: acc.displayName,
    firstName: details.firstName ?? acc.givenName,
    lastName: details.lastName ?? acc.surname,
    alias: details.alias ?? null,
    codiceFiscale: details.codiceFiscale ?? null,
    birthDate: details.birthDate ?? null,
    birthPlace: details.birthPlace ?? null,
    residence: details.residence ?? null,
    phone: details.phone ?? null,
    admittedOn,
    endedOn: end?.endedOn ?? null,
    endReason: end?.endReason ?? null,
    endNote: end?.endNote ?? null,
    accountState: end?.accountState ?? "active",
    accountDeletedOn: end?.accountDeletedOn ?? null,
    fees: [],
    createdBy: AGENT,
    createdAt: at,
    updatedBy: AGENT,
    updatedAt: at,
    activity: [{ actor: AGENT, text: `Admitted with number ${number}; account ${acc.mail} created`, at }],
  }
}

const milano = (street: string) => `${street}, 20133 Milano (MI)`

const today = () => romeDay(new Date())
const now = () => new Date().toISOString()

/** `days` before `day`, but not before `floor`. */
function daysBefore(day: string, days: number, floor: string) {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - days)
  const result = date.toISOString().slice(0, 10)
  return result < floor ? floor : result
}

const reference = (year: number, r: Pick<Stored, "number" | "firstName" | "lastName">) =>
  `Quota ${feeYearLabel(year)} ${String(r.number).padStart(4, "0")} ${r.firstName} ${r.lastName}`

function openFee(year: number, status: Fee["status"]): Fee {
  return {
    year,
    label: feeYearLabel(year),
    status,
    amountCents: 500,
    upload: null,
    lastRejection: null,
    payment: null,
  }
}

function paidAtAdmission(year: number, admittedOn: string): Fee {
  return {
    ...openFee(year, "paid"),
    payment: { paidOn: admittedOn, method: "admission", note: null, recordedBy: AGENT },
  }
}

/** A transfer receipt the socio uploaded: a sample PDF, or the cut-off PNG. */
function upload(s: State, r: Stored, year: number, transferDate: string, kind: "pdf" | "png" = "pdf"): Fee["upload"] {
  // Fixed per socio and year, so a page open across a dev server reload still names the same file.
  const fileId = `00000000-0000-4000-8000-${String(r.number * 10_000 + year).padStart(12, "0")}`
  const fileName = kind === "pdf" ? `bonifico-${transferDate}.pdf` : "IMG_2041.png"
  s.files.set(fileId, {
    fileName,
    contentType: kind === "pdf" ? "application/pdf" : "image/png",
    base64:
      kind === "pdf"
        ? samplePdf([
            "Banca Esempio - Contabile bonifico SEPA",
            `Data esecuzione: ${transferDate}`,
            `Ordinante: ${r.firstName} ${r.lastName}`,
            "Beneficiario: PoliNetwork APS",
            "IBAN beneficiario: IT60 X054 2811 1010 0000 0123 456",
            "Importo: EUR 5,00",
            `Causale: ${reference(year, r)}`,
          ])
        : samplePng(),
  })
  return {
    fileId,
    fileName,
    contentType: kind === "pdf" ? "application/pdf" : "image/png",
    transferDate,
    declaredCents: 500,
    uploadedAt: `${transferDate}T19:30:00Z`,
  }
}

/**
 * Every fee year from the admission's to the last one: the admission's paid at admission, the others paid by a
 * confirmed transfer, then `overrides` per year.
 */
function feeHistory(s: State, r: Stored, last: number, overrides: Record<number, (fee: Fee) => Fee | null> = {}) {
  const first = feeYearOf(r.admittedOn)
  for (let year = first; year <= last; year++) {
    let fee: Fee | null
    if (year === first) fee = paidAtAdmission(year, r.admittedOn)
    else {
      const paidOn = `${year}-${10 + (r.number % 3)}-${String(3 + (r.number % 20)).padStart(2, "0")}`
      fee = {
        ...openFee(year, "paid"),
        upload: upload(s, r, year, paidOn),
        payment: { paidOn, method: "transfer", note: null, recordedBy: AGENT },
      }
    }
    fee = overrides[year] ? overrides[year](fee) : fee
    if (fee) r.fees.push(fee)
  }
}

/** Deterministic, so the same register comes back after a dev server restart. */
function build(): State {
  const day = today()
  const current = feeYearOf(day)
  const yearStart = `${current}-09-01`
  const giulia = account("acc-giulia", "Giulia Rossi", "1", "2019-10-14")
  const marco = account("acc-marco", "Marco Bianchi", "4", "2019-11-02")
  const sara = account("acc-sara", "Sara Colombo", "7", "2020-10-05")
  const luca = account("acc-luca", "Luca Ferrari", "12", "2021-03-18")
  const elena = account("acc-elena", "Elena Ricci", "23", "2023-09-28")
  const paolo = account("acc-paolo", "Paolo Greco", "30", "2020-01-20")
  // Admitted in the summer: this fee year is exempt.
  const anna = account("acc-anna", "Anna Bruno", "34", `${current}-07-10`)
  const matteo = account("acc-matteo", "Matteo Gallo", "41", "2025-10-13")
  const chiara = account("acc-chiara", "Chiara Esposito", "15", "2021-10-11")
  const federico = account("acc-federico", "Federico Conti", null, "2026-10-20")
  const records = {
    giulia: record(1, giulia, "2019-10-14", {
      codiceFiscale: "RSSGLI95P41F205I",
      birthDate: "1995-09-01",
      birthPlace: "Milano",
      residence: milano("Via Bonardi 9"),
      phone: "+393331234567",
    }),
    marco: record(4, marco, "2019-11-02", {
      firstName: "Marco Antonio",
      alias: "Marco",
      codiceFiscale: "BNCMCN96A15H501G",
      birthDate: "1996-01-15",
      birthPlace: "Roma",
      residence: milano("Piazza Leonardo da Vinci 32"),
    }),
    sara: record(7, sara, "2020-10-05", {
      codiceFiscale: "CLMSRA99D50L219L",
      birthDate: "1999-04-10",
      birthPlace: "Torino",
      residence: "Rue de Rivoli 12, 75001 Paris, France",
      phone: "+33612345678",
    }),
    // Ended, but still in Soci: a mismatch.
    luca: record(
      12,
      luca,
      "2021-03-18",
      { codiceFiscale: "FRRLCU98C18F205V", birthDate: "1998-03-18", birthPlace: "Milano" },
      {
        endedOn: "2025-12-31",
        endReason: "resigned",
        endNote: "Resigned by email",
        accountState: "pending_deletion",
        accountDeletedOn: null,
      }
    ),
    // Active, but no longer in Soci: a mismatch.
    elena: record(23, elena, "2023-09-28", { birthPlace: "Bergamo" }),
    paolo: record(
      30,
      paolo,
      "2020-01-20",
      { codiceFiscale: "GRCPLA97B10F205F", birthDate: "1997-02-10", birthPlace: "Milano" },
      {
        endedOn: "2024-12-31",
        endReason: "lapsed",
        endNote: null,
        accountState: "deleted",
        accountDeletedOn: "2025-02-03",
      }
    ),
    anna: record(34, anna, `${current}-07-10`, {}),
    // Registered from Microsoft 365, with personal data still to complete.
    matteo: record(41, matteo, "2025-10-13", {}),
  }
  const accounts = [giulia, marco, sara, luca, elena, anna, matteo, chiara, federico]
  // Elena is missing (active record, not in Soci); Chiara and Federico have no record yet.
  const soci = new Set(
    ["giulia", "marco", "sara", "luca", "anna", "matteo", "chiara", "federico"].map((n) => `acc-${n}`)
  )
  const s: State = {
    records: Object.values(records),
    accounts,
    soci,
    held: new Map(Object.values(records).map((r) => [r.number, r.entraObjectId])),
    files: new Map(),
  }

  const rejection = (reason: string, at: string) => ({ reason, by: AGENT, at: `${at}T09:15:00Z` })
  feeHistory(s, records.giulia, current, {
    // Paid in cash two years ago, recorded by hand.
    [current - 2]: (fee) => ({
      ...fee,
      upload: null,
      payment: { paidOn: `${current - 2}-11-20`, method: "other", note: "Cash at the assembly", recordedBy: AGENT },
    }),
  })
  feeHistory(s, records.marco, current, {
    // A receipt to review, after the first one was refused.
    [current]: () => ({
      ...openFee(current, "uploaded"),
      upload: upload(s, records.marco, current, daysBefore(day, 2, yearStart)),
      lastRejection: rejection(
        `The transfer is for ${feeYearLabel(current - 1)}: upload this year's receipt.`,
        daysBefore(day, 6, yearStart)
      ),
    }),
  })
  feeHistory(s, records.sara, current, {
    // Due again: the photo was refused.
    [current]: () => ({
      ...openFee(current, "due"),
      upload: upload(s, records.sara, current, daysBefore(day, 9, yearStart), "png"),
      lastRejection: rejection(
        "The photo is cut off: the amount and the reference aren't readable. Upload the bank's PDF receipt.",
        daysBefore(day, 5, yearStart)
      ),
    }),
  })
  feeHistory(s, records.luca, feeYearOf("2025-12-31"))
  feeHistory(s, records.elena, current, { [current]: () => openFee(current, "due") })
  // Lapsed: the 2024/25 fee was never paid.
  feeHistory(s, records.paolo, 2024, { 2024: () => openFee(2024, "due") })
  feeHistory(s, records.anna, current, { [current]: () => openFee(current, "exempt") })
  // This year's fee isn't open yet: registered after the daily job ran.
  feeHistory(s, records.matteo, feeYearOf("2025-10-13"))
  return s
}

let state: State | null = null
const data = () => {
  state ??= build()
  return state
}

function currentFee(r: Stored) {
  return r.fees.find((fee) => fee.year === feeYearOf(today())) ?? null
}

/** Newest year first, as the backend sends them. */
const feesOf = (r: Stored) => r.fees.toSorted((a, b) => b.year - a.year).map((fee) => structuredClone(fee))

function row(s: State, r: Stored): SocioRow {
  const inSoci = r.accountState === "deleted" ? false : s.soci.has(r.entraObjectId)
  return {
    number: r.number,
    entraObjectId: r.entraObjectId,
    mailbox: r.mailbox,
    displayName: r.displayName,
    firstName: r.firstName,
    lastName: r.lastName,
    alias: r.alias,
    codiceFiscale: r.codiceFiscale,
    admittedOn: r.admittedOn,
    endedOn: r.endedOn,
    endReason: r.endReason,
    accountState: r.accountState,
    inSoci,
    mismatch: !r.endedOn && !inSoci ? "not_in_soci" : r.endedOn && inSoci ? "still_in_soci" : null,
    fee: currentFee(r)?.status ?? null,
  }
}

function find(s: State, number: number) {
  const found = s.records.find((r) => r.number === number)
  if (!found) throw new Error(`There is no socio with number ${number}.`)
  return found
}

function requireFee(r: Stored, year: number) {
  const fee = r.fees.find((candidate) => candidate.year === year)
  if (!fee) throw new Error(`Socio ${r.number} has no fee for ${feeYearLabel(year)}.`)
  return fee
}

/** A review applies only to the receipt that was reviewed, not to one the socio uploaded since. */
function requireReviewable(fee: Fee, fileId: string, verb: string) {
  if (fee.status !== "uploaded") throw new Error(`Only an uploaded receipt can be ${verb}.`)
  if (fee.upload?.fileId !== fileId)
    throw new Error("The socio uploaded a new receipt in the meantime: review that one.")
  return fee.upload
}

/** Free only if no record has ever held it (but `accountId`'s own), and no other account has it. */
function requireFreeNumber(s: State, number: number, accountId?: string) {
  const owner = s.held.get(number)
  if (owner !== undefined && owner !== accountId)
    throw new Error(`Member number ${number} was already given to a socio: numbers are never reused.`)
  const holder = s.accounts.find((a) => a.employeeId === String(number) && a.id !== accountId)
  if (holder) throw new Error(`Member number ${number} is already assigned in Microsoft 365 to ${holder.displayName}.`)
}

function requireUniqueCode(s: State, code: string | null, self?: Stored) {
  if (!code) return
  const active = s.records.find((r) => r.codiceFiscale === code && !r.endedOn && r !== self)
  if (active) throw new Error(`This codice fiscale belongs to socio ${active.number}, who is still active.`)
}

const log = (r: Stored, text: string, actor = AGENT) => r.activity.unshift({ actor, text, at: now() })

const SELF_LABELS = {
  codiceFiscale: "codice fiscale",
  birthDate: "birth date",
  birthPlace: "birth place",
  residence: "residence",
  phone: "phone",
} satisfies Record<(typeof SELF_FIELDS)[number], string>

/** `socio`: the member number My area shows (`AGENT_SOCIO`), or `none`. */
export function fakeSociApi({ socio }: { socio: string }): SociApi {
  const mine = () => {
    const s = data()
    return socio === "none" ? null : (s.records.find((r) => String(r.number) === socio) ?? null)
  }
  const requireMine = () => {
    const r = mine()
    if (!r) throw new Error("Your account has no socio record.")
    if (r.endedOn) throw new Error("Your socio status has ended.")
    return r
  }

  return {
    async list() {
      const s = data()
      return {
        members: s.records.toSorted((a, b) => a.number - b.number).map((r) => row(s, r)),
        directoryAvailable: true,
      }
    },

    async get({ number }) {
      const s = data()
      const r = find(s, number)
      const acc = s.accounts.find((a) => a.id === r.entraObjectId)
      return {
        ...r,
        ...row(s, r),
        accountNumber: acc?.employeeId ?? null,
        activity: [...r.activity],
        fees: feesOf(r),
      }
    },

    async unregistered() {
      const s = data()
      return s.accounts
        .filter((a) => s.soci.has(a.id) && !s.records.some((r) => r.entraObjectId === a.id))
        .map((a) => ({
          entraObjectId: a.id,
          displayName: a.displayName,
          givenName: a.givenName,
          surname: a.surname,
          mail: a.mail,
          employeeId: a.employeeId,
          createdDateTime: a.createdDateTime,
        }))
    },

    async admit(input) {
      const s = data()
      const localPart =
        input.account.mailbox.kind === "custom"
          ? input.account.mailbox.localPart
          : `${input.account.firstName}.${input.account.lastName}`
              .normalize("NFD")
              .replace(/\p{M}/gu, "")
              .replace(/['\s]/g, "")
              .toLowerCase()
      const mail = `${localPart}@polinetwork.org`
      if (s.accounts.some((a) => a.mail === mail)) throw new Error(`The address ${mail} is already in use.`)
      requireFreeNumber(s, input.number)
      requireUniqueCode(s, input.details.codiceFiscale)
      const acc: Account = {
        id: `acc-${crypto.randomUUID()}`,
        displayName: `${input.account.firstName} ${input.account.lastName}`,
        givenName: input.account.firstName,
        surname: input.account.lastName,
        mail,
        employeeId: String(input.number),
        createdDateTime: now(),
      }
      s.accounts.push(acc)
      s.soci.add(acc.id)
      const r = record(input.number, acc, input.admittedOn, input.details)
      r.createdAt = r.updatedAt = r.activity[0].at = now()
      // Admission records its fee year as paid.
      r.fees.push(paidAtAdmission(feeYearOf(input.admittedOn), input.admittedOn))
      s.records.push(r)
      s.held.set(input.number, acc.id)
      return { number: input.number, entraObjectId: acc.id, mailbox: mail, welcomeMailSent: true }
    },

    async register(input) {
      const s = data()
      const existing = s.records.find((r) => r.entraObjectId === input.entraObjectId)
      if (existing) throw new Error(`This account already has a record: socio ${existing.number}.`)
      const acc = s.accounts.find((a) => a.id === input.entraObjectId)
      if (!acc || !s.soci.has(acc.id)) throw new Error("This account isn't in the Soci group in Microsoft 365.")
      const accountNumber = acc.employeeId ? Number(acc.employeeId) : null
      if (accountNumber !== null && input.number !== undefined && input.number !== accountNumber)
        throw new Error(`The account has member number ${accountNumber}: register it with that number, then change it.`)
      const number = accountNumber ?? input.number
      if (number === undefined) throw new Error("The account has no member number in Microsoft 365: choose one.")
      requireFreeNumber(s, number, acc.id)
      requireUniqueCode(s, input.details.codiceFiscale)
      acc.employeeId = String(number)
      const r = record(number, acc, input.admittedOn, input.details)
      r.createdAt = r.updatedAt = now()
      r.activity = [{ actor: AGENT, text: `Registered from Microsoft 365 with number ${number}`, at: now() }]
      // Registering records the admission's fee year as paid; later years open with the daily job.
      r.fees.push(paidAtAdmission(feeYearOf(input.admittedOn), input.admittedOn))
      s.records.push(r)
      s.held.set(number, acc.id)
      return { number }
    },

    async update(input) {
      const s = data()
      const r = find(s, input.number)
      if (!r.endedOn) requireUniqueCode(s, input.details.codiceFiscale, r)
      const next = { ...input.details, admittedOn: input.admittedOn }
      const fields = [
        "firstName",
        "lastName",
        "alias",
        "codiceFiscale",
        "birthDate",
        "birthPlace",
        "residence",
        "phone",
        "admittedOn",
      ] as const
      const changed = fields.filter((key) => JSON.stringify(next[key]) !== JSON.stringify(r[key]))
      if (!changed.length) return
      Object.assign(r, next, { updatedBy: AGENT, updatedAt: now() })
      log(r, `Edited ${changed.join(", ")}`)
    },

    async setNumber(input) {
      const s = data()
      const r = find(s, input.number)
      if (input.newNumber === r.number) throw new Error(`The socio already has number ${r.number}.`)
      const acc = s.accounts.find((a) => a.id === r.entraObjectId)
      if (!acc || r.accountState === "deleted") throw new Error("The socio's account has been deleted.")
      requireFreeNumber(s, input.newNumber, acc.id)
      acc.employeeId = String(input.newNumber)
      log(r, `Member number changed from ${r.number} to ${input.newNumber}`)
      r.number = input.newNumber
      s.held.set(input.newNumber, acc.id)
      return { number: input.newNumber, notificationSent: input.notifyEmail ? true : null }
    },

    fees: {
      async list(input) {
        const s = data()
        const year = input.year ?? feeYearOf(today())
        const totals = { due: 0, uploaded: 0, paid: 0, exempt: 0 }
        const rows = s.records.flatMap((r) => {
          const fee = r.fees.find((candidate) => candidate.year === year)
          if (!fee) return []
          totals[fee.status]++
          if (input.status && fee.status !== input.status) return []
          return [
            {
              number: r.number,
              firstName: r.firstName,
              lastName: r.lastName,
              alias: r.alias,
              mailbox: r.mailbox,
              endedOn: r.endedOn,
              fee: structuredClone(fee),
            },
          ]
        })
        return { year, label: feeYearLabel(year), totals, fees: rows.toSorted((a, b) => a.number - b.number) }
      },

      async file({ fileId }) {
        const file = data().files.get(fileId)
        if (!file) throw new Error("There is no such file.")
        return file
      },

      async confirm(input) {
        const r = find(data(), input.number)
        const fee = requireFee(r, input.year)
        const upload = requireReviewable(fee, input.fileId, "confirmed")
        fee.status = "paid"
        fee.payment = { paidOn: upload.transferDate, method: "transfer", note: null, recordedBy: AGENT }
        log(r, `Confirmed the ${feeYearLabel(input.year)} fee`)
      },

      async reject(input) {
        const r = find(data(), input.number)
        const fee = requireFee(r, input.year)
        requireReviewable(fee, input.fileId, "rejected")
        fee.status = "due"
        fee.lastRejection = { reason: input.reason, by: AGENT, at: now() }
        log(r, `Rejected the ${feeYearLabel(input.year)} receipt: ${input.reason}`)
      },

      async markPaid(input) {
        const r = find(data(), input.number)
        const label = feeYearLabel(input.year)
        if (input.year > feeYearOf(today())) throw new Error(`The ${label} fee year hasn't started.`)
        if (input.year < feeYearOf(r.admittedOn)) throw new Error(`Socio ${r.number} was admitted after ${label}.`)
        if (input.paidOn > today()) throw new Error("The payment date is in the future.")
        const payment = { paidOn: input.paidOn, method: input.method, note: input.note, recordedBy: AGENT }
        const fee = r.fees.find((candidate) => candidate.year === input.year)
        if (!fee) {
          const [admittedYear = 0, month = 0] = r.admittedOn.split("-").map(Number)
          if (month >= 6 && month <= 8 && admittedYear === input.year) throw new Error(`The ${label} fee is exempt.`)
          r.fees.push({ ...openFee(input.year, "paid"), payment })
          r.fees.sort((a, b) => a.year - b.year)
        } else {
          if (fee.status === "paid") throw new Error(`The ${label} fee is already paid.`)
          if (fee.status === "exempt") throw new Error(`The ${label} fee is exempt.`)
          Object.assign(fee, { status: "paid", payment })
        }
        log(r, `Marked the ${label} fee as paid (${input.method}, ${input.paidOn})`)
      },
    },

    me: {
      async get() {
        const r = mine()
        if (!r) return null
        const year = feeYearOf(today())
        return {
          number: r.number,
          admittedOn: r.admittedOn,
          endedOn: r.endedOn,
          endReason: r.endReason,
          details: {
            firstName: r.firstName,
            lastName: r.lastName,
            alias: r.alias,
            codiceFiscale: r.codiceFiscale,
            birthDate: r.birthDate,
            birthPlace: r.birthPlace,
            residence: r.residence,
            phone: r.phone,
          },
          missing: SELF_FIELDS.filter((key) => key !== "phone" && r[key] === null),
          payment: {
            year,
            label: feeYearLabel(year),
            amountCents: 500,
            deadline: renewalDeadline(year),
            reference: reference(year, r),
            iban: "IT60X0542811101000000123456",
            beneficiary: "PoliNetwork APS",
          },
          fees: feesOf(r),
        }
      },

      async uploadReceipt(input) {
        const s = data()
        const r = requireMine()
        const year = feeYearOf(today())
        const label = feeYearLabel(year)
        const fee = r.fees.find((candidate) => candidate.year === year)
        if (!fee) throw new Error(`Your ${label} fee isn't open yet: try again tomorrow.`)
        if (fee.status === "paid") throw new Error(`Your ${label} fee is already paid.`)
        if (fee.status === "exempt") throw new Error(`You're exempt from the ${label} fee.`)
        if (input.transferDate > today()) throw new Error("The transfer date is in the future.")
        if (input.file.size === 0) throw new Error("The file is empty.")
        if (input.file.size > MAX_RECEIPT_BYTES) throw new Error("The file is larger than 10 MB.")
        const contentType = RECEIPT_TYPES.find((type) => type === input.file.type)
        if (!contentType) throw new Error("Upload a PDF, JPEG or PNG.")
        const fileId = crypto.randomUUID()
        const fileName = input.file.name.slice(0, 200) || "receipt"
        s.files.set(fileId, {
          fileName,
          contentType,
          base64: Buffer.from(await input.file.arrayBuffer()).toString("base64"),
        })
        Object.assign(fee, {
          status: "uploaded",
          upload: {
            fileId,
            fileName,
            contentType,
            transferDate: input.transferDate,
            declaredCents: input.declaredCents,
            uploadedAt: now(),
          },
        })
        log(r, `Uploaded a transfer receipt for ${label}`, `sub-socio-${r.number}`)
      },

      async completeDetails(input) {
        const s = data()
        const r = requireMine()
        const given = SELF_FIELDS.filter((key) => input[key] !== null)
        const recorded = given.filter((key) => r[key] !== null)
        if (recorded.length)
          throw new Error(
            `Already recorded: ${recorded.map((key) => SELF_LABELS[key]).join(", ")}. Ask the Direttivo to change it.`
          )
        const code = input.codiceFiscale ?? r.codiceFiscale
        const birthDate = input.birthDate ?? r.birthDate
        if (code && birthDate && !matchesBirthDate(code, birthDate))
          throw new Error("The birth date doesn't match the codice fiscale.")
        if (input.codiceFiscale) requireUniqueCode(s, input.codiceFiscale, r)
        for (const key of given) r[key] = input[key]
        r.updatedAt = now()
        log(r, `Completed ${given.map((key) => SELF_LABELS[key]).join(", ")}`, `sub-socio-${r.number}`)
      },
    },
  }
}
