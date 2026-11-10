import type { SociApi } from "./soci.api.server"
import type { SocioActivity, SocioDetails, SocioRecord, SocioRow } from "./soci.contract"

/**
 * Agent mode's stand-in for the backend's `soci.members.*` procedures. State lives for the dev server's lifetime, so
 * changes show up on reload. It follows the backend's rules where a page depends on them: numbers are never reused
 * (by a record, or held by another account), one active record per codice fiscale, and only accounts in the Soci
 * group without a record can be registered. The sample register covers active, ended, unregistered and mismatched
 * soci.
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

type Stored = Omit<SocioRecord, "inSoci" | "mismatch" | "accountNumber" | "activity"> & { activity: SocioActivity[] }

/** `held`: every number a record has ever held, and the account of that record. */
type State = { records: Stored[]; accounts: Account[]; soci: Set<string>; held: Map<number, string> }

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

const NO_RESIDENCE = { street: null, postalCode: null, city: null, province: null, country: null }

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
    residence: details.residence ?? NO_RESIDENCE,
    admittedOn,
    endedOn: end?.endedOn ?? null,
    endReason: end?.endReason ?? null,
    endNote: end?.endNote ?? null,
    accountState: end?.accountState ?? "active",
    accountDeletedOn: end?.accountDeletedOn ?? null,
    createdBy: AGENT,
    createdAt: at,
    updatedBy: AGENT,
    updatedAt: at,
    activity: [{ actor: AGENT, text: `Admitted with number ${number}; account ${acc.mail} created`, at }],
  }
}

const milano = (street: string) => ({ street, postalCode: "20133", city: "Milano", province: "MI", country: "IT" })

/** Deterministic, so the same register comes back after a dev server restart. */
function build(): State {
  const giulia = account("acc-giulia", "Giulia Rossi", "1", "2019-10-14")
  const marco = account("acc-marco", "Marco Bianchi", "4", "2019-11-02")
  const sara = account("acc-sara", "Sara Colombo", "7", "2020-10-05")
  const luca = account("acc-luca", "Luca Ferrari", "12", "2021-03-18")
  const elena = account("acc-elena", "Elena Ricci", "23", "2023-09-28")
  const paolo = account("acc-paolo", "Paolo Greco", "30", "2020-01-20")
  const anna = account("acc-anna", "Anna Bruno", "34", "2024-10-07")
  const matteo = account("acc-matteo", "Matteo Gallo", "41", "2025-10-13")
  const chiara = account("acc-chiara", "Chiara Esposito", "15", "2021-10-11")
  const federico = account("acc-federico", "Federico Conti", null, "2026-10-20")
  const records = [
    record(1, giulia, "2019-10-14", {
      codiceFiscale: "RSSGLI95P41F205I",
      birthDate: "1995-09-01",
      birthPlace: "Milano",
      residence: milano("Via Bonardi 9"),
    }),
    record(4, marco, "2019-11-02", {
      firstName: "Marco Antonio",
      alias: "Marco",
      codiceFiscale: "BNCMCN96A15H501G",
      birthDate: "1996-01-15",
      birthPlace: "Roma",
      residence: milano("Piazza Leonardo da Vinci 32"),
    }),
    record(7, sara, "2020-10-05", {
      codiceFiscale: "CLMSRA99D50L219L",
      birthDate: "1999-04-10",
      birthPlace: "Torino",
      residence: { street: "Rue de Rivoli 12", postalCode: "75001", city: "Paris", province: null, country: "FR" },
    }),
    // Ended, but still in Soci: a mismatch.
    record(
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
    record(23, elena, "2023-09-28", { birthPlace: "Bergamo" }),
    record(
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
    record(34, anna, "2024-10-07", {}),
    // Registered from Microsoft 365, with personal data still to complete.
    record(41, matteo, "2025-10-13", {}),
  ]
  const accounts = [giulia, marco, sara, luca, elena, anna, matteo, chiara, federico]
  // Elena is missing (active record, not in Soci); Chiara and Federico have no record yet.
  const soci = new Set(
    ["giulia", "marco", "sara", "luca", "anna", "matteo", "chiara", "federico"].map((n) => `acc-${n}`)
  )
  return { records, accounts, soci, held: new Map(records.map((r) => [r.number, r.entraObjectId])) }
}

let state: State | null = null
const data = () => {
  state ??= build()
  return state
}

const now = () => new Date().toISOString()

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
  }
}

function find(s: State, number: number) {
  const found = s.records.find((r) => r.number === number)
  if (!found) throw new Error(`There is no socio with number ${number}.`)
  return found
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

const log = (r: Stored, text: string) => r.activity.unshift({ actor: AGENT, text, at: now() })

export function fakeSociApi(): SociApi {
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
      return { ...r, ...row(s, r), accountNumber: acc?.employeeId ?? null, activity: [...r.activity] }
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
  }
}
