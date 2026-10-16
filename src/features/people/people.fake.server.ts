import { nextReceiptNumber, receiptFileName, receiptNumberFromFileName } from "./people-fees"
import type { PeopleApi, PeopleViewer } from "./people.api.server"
import {
  type AccountMatch,
  type Campaign,
  type CampaignDetail,
  type CapoArea,
  type Discrepancy,
  type FeeDetail,
  type Fees,
  type FilePayload,
  type ImportPreview,
  type MyArea,
  type PersonRecord,
  type PersonRow,
  type Receipt,
  type Signer,
  type SignedUpload,
  TEAM_IDS,
  TEAMS,
  type TeamId,
  type TeamSummary,
} from "./people.contract"
import {
  addDays,
  buildPeopleStore,
  emptyFeeState,
  FAMILIES,
  FAMILY_IDS,
  FEE_AMOUNT_CENTS,
  FEE_BENEFICIARY,
  FEE_DUE_ON,
  FEE_IBAN,
  FEE_YEAR,
  GROUP_IDS,
  m365Address,
  OFFICERS,
  receiptId,
  type PeopleStore,
  type StoredPerson,
} from "./people.fixtures.server"
import { downloadName, looksSigned, receiptPdf, sampleTransferPdf, zipFiles } from "./receipt-files.server"

/**
 * Agent mode's stand-in for the backend's `people.*` procedures, over `people.fixtures.server.ts`. State lives for the
 * dev server's lifetime, so mutations show up on reload. It enforces the same visibility rules the backend must:
 * contacts and notes only with `people:read`, a Capo Admin's scope, or a Team Lead's team.
 */

let store: PeopleStore | null = null
/** The agent user's own state when `AGENT_PERSON` is `none` or `match:P-…`. */
type SelfState = { matchConfirmed: boolean; matchRejected: boolean; askedOn: string | null }
const self: SelfState = { matchConfirmed: false, matchRejected: false, askedOn: null }
const importedFiles = new Set<string>()
const previews = new Map<string, ImportPreview>()
const closedCampaigns = new Set<string>()
/** Signed copies uploaded by an officer, by receipt ID. Receipts without one are generated on download. */
const signedFiles = new Map<string, Uint8Array>()
/** Members' uploaded transfer receipts, by person ID. Seeded uploads have no file and preview a sample. */
const transferFiles = new Map<string, { name: string; type: string; bytes: Uint8Array }>()
/** Signed files read by Upload signed receipts, until they are sent. */
const signedUploads = new Map<string, { fileId: string; name: string; bytes: Uint8Array; signed: boolean }[]>()

function data() {
  store ??= buildPeopleStore()
  return store
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function nowStamp() {
  return new Date().toISOString()
}

function fullName(person: StoredPerson) {
  return `${person.profile.firstName} ${person.profile.lastName}`
}

function find(id: string) {
  const person = data().byId.get(id)
  if (!person) throw new Error("This person no longer exists.")
  return person
}

function log(person: StoredPerson, actor: string, text: string) {
  person.activity.unshift({ actor, text, at: nowStamp() })
}

function discrepancies(person: StoredPerson): Discrepancy[] {
  const out: Discrepancy[] = []
  const current = person.census.find((entry) => entry.year === "2026/27")
  const isMember = person.member !== null && person.member.status !== "former"
  if (current?.declaredMember && !isMember) {
    out.push({
      kind: "declared-member",
      message: "Declared a member in the 2026/27 census, but not in the member register.",
      suggestedTelegram: null,
    })
  }
  if (person.censusTelegram && person.censusTelegram !== person.profile.telegramUsername) {
    out.push({
      kind: "telegram-mismatch",
      message: `The 2026/27 census says @${person.censusTelegram}, but the record says @${person.profile.telegramUsername ?? "—"}.`,
      suggestedTelegram: person.censusTelegram,
    })
  }
  if (person.account.status === "review") {
    out.push({
      kind: "needs-review",
      message: "A sign-in matches this record but needs review before it can be linked.",
      suggestedTelegram: null,
    })
  }
  return out
}

/**
 * The contract row, with contacts kept only when `withContacts`. Member details (number, status, fee, Microsoft 365
 * address) need `people:members:read` or the person's own record; everyone else sees only `isMember`.
 */
function row(person: StoredPerson, viewer: PeopleViewer, withContacts: boolean): PersonRow {
  const ownRecord = linkedRecord(viewer)?.id === person.id
  const withMember = ownRecord || viewer.permissions.includes("people:members:read")
  return {
    id: person.id,
    profile: {
      ...person.profile,
      personalEmail: withContacts ? person.profile.personalEmail : null,
      phone: withContacts ? person.profile.phone : null,
    },
    member: withMember ? person.member : null,
    isMember: person.member !== null && person.member.status !== "former",
    admin: person.admin,
    teams: person.teams,
    census: person.census,
    consents: person.consents,
    account: person.account,
  }
}

function record(person: StoredPerson, viewer: PeopleViewer): PersonRecord {
  const canRead = viewer.permissions.includes("people:read")
  const ownRecord = linkedRecord(viewer)?.id === person.id
  return {
    ...row(person, viewer, canRead || ownRecord),
    notes: canRead ? person.notes : null,
    discrepancies: discrepancies(person),
    activity: [...person.activity].sort((a, b) => (a.at < b.at ? 1 : -1)),
    fees: ownRecord || viewer.permissions.includes("people:members:read") ? fees(person) : null,
  }
}

/** Due before the deadline, Unpaid after it. */
function unpaidStatus() {
  return today() > FEE_DUE_ON ? "unpaid" : "due"
}

function feeDetail(person: StoredPerson): FeeDetail | null {
  const state = person.feeState
  const status = person.member?.fee
  if (!state || !status) return null
  return {
    year: FEE_YEAR,
    status,
    amountCents: FEE_AMOUNT_CENTS,
    dueOn: FEE_DUE_ON,
    upload: state.upload,
    rejection: state.rejection,
    payment: state.payment,
    lastReminder: state.lastReminder,
  }
}

function fees(person: StoredPerson): Fees | null {
  if (!person.member) return null
  const receipts = data()
    .receipts.filter((receipt) => receipt.person.id === person.id)
    .sort((a, b) => (a.number < b.number ? 1 : -1))
  return { current: feeDetail(person), receipts }
}

function officerName(id: string) {
  const person = data().byId.get(id)
  return person ? fullName(person) : "—"
}

/** The office the signed-in person signs receipts for: they need `people:receipts:sign` and to hold it. */
function viewerSigner(viewer: PeopleViewer): Signer | null {
  if (!viewer.permissions.includes("people:receipts:sign")) return null
  const me = linkedRecord(viewer)?.id
  return me === OFFICERS.president ? "president" : me === OFFICERS.vicePresident ? "vicePresident" : null
}

function findReceipt(id: string) {
  const receipt = data().receipts.find((candidate) => candidate.id === id)
  if (!receipt) throw new Error("This receipt no longer exists.")
  return receipt
}

function currentMember(personId: string) {
  const person = find(personId)
  const member = person.member
  if (!member || member.status === "former" || !member.fee) throw new Error("This person isn't a current member.")
  person.feeState ??= emptyFeeState()
  return { person, member, state: person.feeState }
}

/** Issues the next receipt of the fee year, waiting for the President's signature (the Vice-president's for theirs). */
function issueReceipt(person: StoredPerson, payment: NonNullable<FeeDetail["payment"]>) {
  const member = person.member
  if (!member) throw new Error("This person isn't a member.")
  const number = nextReceiptNumber(
    FEE_YEAR,
    data().receipts.map((receipt) => receipt.number)
  )
  const receipt: Receipt = {
    id: receiptId(number),
    number,
    year: FEE_YEAR,
    person: { id: person.id, name: fullName(person) },
    memberNumber: member.number,
    amountCents: payment.amountCents,
    issuedOn: today(),
    paidOn: payment.paidOn,
    method: payment.method,
    transferDate: payment.transferDate,
    status: "toSign",
    signer: person.id === OFFICERS.president ? "vicePresident" : "president",
    signedBy: null,
    signedOn: null,
    sentAt: null,
    sentTo: null,
    failure: null,
    voided: null,
  }
  data().receipts.push(receipt)
  log(person, "System", `issued receipt ${number} for the ${FEE_YEAR} fee`)
  return receipt
}

/** Emails a signed receipt to the member's Microsoft 365 address; a mailbox flagged in the sample data refuses it. */
function sendReceipt(receipt: Receipt) {
  const person = find(receipt.person.id)
  const email = person.member?.m365Email ?? ""
  receipt.sentTo = email
  if (person.feeState?.mailFails) {
    receipt.status = "failed"
    receipt.failure = "The mail server rejected the address: mailbox unavailable."
    log(person, "System", `couldn't email receipt ${receipt.number}`)
    return false
  }
  receipt.status = "sent"
  receipt.sentAt = nowStamp()
  receipt.failure = null
  log(person, "System", `emailed receipt ${receipt.number} to ${email}`)
  return true
}

function receiptFile(receipt: Receipt): FilePayload {
  const bytes =
    signedFiles.get(receipt.id) ??
    receiptPdf(receipt, {
      president: officerName(OFFICERS.president),
      vicePresident: officerName(OFFICERS.vicePresident),
    })
  return {
    fileName: downloadName(receipt),
    contentType: "application/pdf",
    base64: Buffer.from(bytes).toString("base64"),
  }
}

function require(viewer: PeopleViewer, permission: string) {
  if (!viewer.permissions.includes(permission)) throw new Error("UNAUTHORIZED")
}

function viewerName(viewer: PeopleViewer) {
  const person = viewer.personId ? data().byId.get(viewer.personId) : undefined
  return person ? fullName(person) : "Agent"
}

/** The person the agent user is in My area: `AGENT_PERSON` without its `match:` prefix. */
function viewerRecord(viewer: PeopleViewer) {
  if (!viewer.personId || viewer.personId === "none") return null
  const id = viewer.personId.replace(/^match:/, "")
  return data().byId.get(id) ?? null
}

/**
 * The record the signed-in person acts as. A first-sign-in match (`match:` prefix) is not theirs until they confirm
 * it, and never after "This isn't me": until then they see the proposed match in My area and nothing else.
 */
function linkedRecord(viewer: PeopleViewer) {
  if (self.matchRejected) return null
  if (viewer.personId?.startsWith("match:") && !self.matchConfirmed) return null
  return viewerRecord(viewer)
}

/**
 * One CSV cell, quoted. A value starting with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with `'`, so
 * spreadsheet apps show it as text instead of running it as a formula (OWASP CSV injection).
 */
function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

/**
 * A request to join one of the groups the signed-in Capo Admin coordinates. Any other request reads as already
 * handled, so a caller can't tell whether a request of another course exists.
 */
function capoRequest(viewer: PeopleViewer, requestId: string) {
  const scope = linkedRecord(viewer)?.admin?.capoScope
  const family = scope ? familyOfScope(scope) : undefined
  const titles: readonly string[] = family ? FAMILIES[family].groups : []
  const request = data().joinRequests.find(
    (candidate) => candidate.id === requestId && titles.includes(candidate.group)
  )
  if (!request) throw new Error("This request was already handled.")
  return request
}

function leadsOf(person: StoredPerson | null): TeamId[] {
  if (!person) return []
  return person.teams.filter((team) => team.role === "lead" && !team.endedOn).map((team) => team.team)
}

function campaigns(): Campaign[] {
  const people = data().people
  const count = (year: string) => {
    const entries = people.flatMap((person) => person.census.filter((entry) => entry.year === year))
    const expected = year === "2026/27" ? people.filter((person) => person.expected).length : entries.length
    const continuing = entries.filter((entry) => entry.answer === "continues").length
    const leaving = entries.filter((entry) => entry.answer === "leaving").length
    return { expected, continuing, leaving, noAnswer: expected - continuing - leaving }
  }
  return [
    {
      id: "2026",
      year: "2026/27",
      status: closedCampaigns.has("2026") ? "closed" : "open",
      openedOn: "2026-09-15",
      closesOn: "2026-10-31",
      source: "Modulo Volontari 2026/27",
      ...count("2026/27"),
    },
    {
      id: "2025",
      year: "2025/26",
      status: "closed",
      openedOn: "2025-09-15",
      closesOn: "2025-10-31",
      source: "Modulo Volontari 2025/26",
      ...count("2025/26"),
    },
  ]
}

function familyOfScope(scope: string) {
  return FAMILY_IDS.find((family) => FAMILIES[family].scope === scope)
}

function buildPreview(fileName: string): ImportPreview {
  const people = data().people.filter((person) => person.census.some((entry) => entry.source === "forms"))
  const reimport = importedFiles.has(fileName)
  const withErrors = fileName.toLowerCase().endsWith(".csv")
  const answer = (person: StoredPerson) =>
    person.census.find((entry) => entry.year === "2026/27")?.answer ?? "continues"
  const newNames = [
    "Leonardo Sala",
    "Greta Bellini",
    "Samuele Riva",
    "Ludovica Neri",
    "Emanuele Vitali",
    "Arianna Donati",
    "Jacopo Piras",
    "Bianca Sartori",
    "Diego Milani",
  ]
  const counts = reimport
    ? { newPeople: 4, updates: 8, duplicates: 0, invalid: 0, discrepancies: 1, alreadyImported: 148, leaving: 1 }
    : {
        newPeople: 9,
        updates: 136,
        duplicates: 3,
        invalid: withErrors ? 4 : 0,
        discrepancies: 6,
        alreadyImported: 0,
        leaving: 7,
      }
  const giulia = find("P-0142")
  const duplicatePeople = people.slice(10, 10 + counts.duplicates)
  return {
    importId: `import-${Date.now()}`,
    fileName,
    rows: reimport ? 160 : withErrors ? 152 : 148,
    counts,
    tabs: {
      newPeople: newNames.slice(0, counts.newPeople).map((name, index) => ({
        row: 140 + index,
        name,
        detail: [
          "Ingegneria Gestionale · 1st year · Bovisa",
          "Design della Comunicazione · 1st year · Bovisa",
          "Ingegneria Informatica · 1st year · Leonardo",
        ][index % 3],
        answer: "continues",
      })),
      updates: people.slice(0, Math.min(8, counts.updates)).map((person, index) => ({
        row: 3 + index * 7,
        name: fullName(person),
        detail: [
          `Year ${person.profile.year} → next year`,
          "Campus Leonardo → Bovisa",
          "Phone updated",
          "Telegram username updated",
        ][index % 4],
        answer: answer(person),
      })),
      duplicates: duplicatePeople.map((person, index) => ({
        row: 44 + index * 31,
        name: fullName(person),
        detail:
          index === 1
            ? `Same name as ${person.id}; different course and Telegram`
            : `Same name as ${person.id}; same Telegram, different email`,
        answer: "continues",
      })),
      invalid: [
        { row: 23, name: "Pietro Gallo", detail: "Personal email is missing", answer: null },
        { row: 57, name: "Unnamed row", detail: "Name is empty", answer: null },
        { row: 88, name: "Sofia Marchetti", detail: "Year “4th” isn't a valid year", answer: null },
        { row: 131, name: "Luca Moretti", detail: "Telegram username “luca moretti” has a space", answer: null },
      ].slice(0, counts.invalid),
      discrepancies: [
        {
          row: 12,
          name: fullName(giulia),
          detail: "Declared a member, but not in the member register",
          answer: "continues" as const,
        },
        ...people.slice(20, 20 + counts.discrepancies - 1).map((person, index) => ({
          row: 30 + index * 9,
          name: fullName(person),
          detail: [
            "Telegram username differs from the record",
            "Says they administer Statistica; the bot hasn't seen them there",
            "Campus Cremona in the form, Leonardo on the record",
            "Answered “No” but administers 2 groups",
          ][index % 4],
          answer: answer(person),
        })),
      ].slice(0, counts.discrepancies),
      alreadyImported: reimport
        ? people.slice(0, 8).map((person, index) => ({
            row: 1 + index,
            name: fullName(person),
            detail: "Already imported, skipped",
            answer: answer(person),
          }))
        : [],
    },
    duplicates: duplicatePeople.map((person, index) => {
      const fileEmail =
        index === 1
          ? `${person.profile.firstName.toLowerCase()}.${person.profile.lastName.toLowerCase()}@mail.polimi.it`
          : (person.profile.personalEmail ?? "").replace("@", "1@")
      const telegram = `@${person.profile.telegramUsername ?? "—"}`
      return {
        pairId: `pair-${index}`,
        row: 44 + index * 31,
        recordId: person.id,
        fields: [
          { label: "Name", file: fullName(person), record: fullName(person), mono: false },
          { label: "Email", file: fileEmail, record: person.profile.personalEmail ?? "—", mono: true },
          {
            label: "Course",
            file: index === 1 ? "Ingegneria Civile" : person.profile.course,
            record: person.profile.course,
            mono: false,
          },
          { label: "Telegram", file: index === 1 ? `${telegram}99` : telegram, record: telegram, mono: true },
          { label: "Year", file: person.profile.year, record: person.profile.year, mono: false },
        ],
      }
    }),
    telegram: people.slice(30, 36).map((person, index) => ({
      rowId: `row-${person.id}`,
      name: fullName(person),
      username: `@${person.profile.telegramUsername ?? `${person.profile.firstName.toLowerCase()}`}`,
      suggestion:
        index === 4
          ? null
          : {
              telegramId: person.profile.telegramId ?? "",
              name: fullName(person),
              info: person.admin ? `Admin in ${Math.max(1, person.admin.groups.length)} groups` : "Member of 3 groups",
            },
    })),
  }
}

export function fakePeopleApi(viewer: PeopleViewer): PeopleApi {
  const actor = viewerName(viewer)
  return {
    listMembers: async () => {
      require(viewer, "people:members:read")
      return data().people.map((person) => ({
        id: person.id,
        profile: {
          firstName: person.profile.firstName,
          lastName: person.profile.lastName,
          personalEmail: viewer.permissions.includes("people:read") ? person.profile.personalEmail : null,
        },
        member: person.member,
        account: { status: person.account.status },
      }))
    },
    listPeople: async () => {
      require(viewer, "people:read")
      return data().people.map((person) => row(person, viewer, true))
    },
    getPerson: async (id) => {
      require(viewer, "people:read")
      return record(find(id), viewer)
    },
    createPerson: async (input) => {
      require(viewer, "people:write")
      const { people, byId } = data()
      if (people.some((person) => person.profile.personalEmail === input.personalEmail)) {
        throw new Error(`${input.personalEmail} already belongs to another record.`)
      }
      const id = `P-${String(people.length + 1).padStart(4, "0")}`
      const person: StoredPerson = {
        id,
        family: "inf",
        profile: {
          firstName: input.firstName,
          lastName: input.lastName,
          personalEmail: input.personalEmail,
          phone: input.phone || null,
          telegramUsername: input.telegramUsername || null,
          telegramId: null,
          course: input.course,
          year: input.year,
          campus: input.campus,
          otherAssociations: [],
          studentRepresentative: null,
        },
        member: null,
        admin: input.admin
          ? {
              status: "active",
              since: today(),
              endedOn: null,
              endReason: null,
              groups: [],
              requested: [],
              availableAsCapo: false,
              capoOfReference: null,
              capoScope: null,
            }
          : null,
        teams: [],
        census: [],
        consents: { privacy: null, photo: null },
        account: { status: "none" },
        notes: null,
        activity: [],
        feeState: null,
        start: input.admin ? today() : null,
        censusTelegram: null,
        expected: false,
      }
      log(person, actor, "created the record")
      people.push(person)
      byId.set(id, person)
      return { id }
    },
    updatePerson: async (input) => {
      require(viewer, "people:write")
      const person = find(input.id)
      Object.assign(person.profile, {
        firstName: input.firstName,
        lastName: input.lastName,
        personalEmail: input.personalEmail,
        phone: input.phone || null,
        telegramUsername: input.telegramUsername || null,
        course: input.course,
        year: input.year,
        campus: input.campus,
      })
      log(person, actor, "edited the profile")
    },
    setNote: async (input) => {
      require(viewer, "people:write")
      const person = find(input.id)
      person.notes = input.note || null
      log(person, actor, "edited the HR notes")
    },
    createMember: async (input) => {
      require(viewer, "people:members:write")
      const person = find(input.personId)
      if (person.member) throw new Error("This person is already registered as a member.")
      if (data().people.some((other) => other.member?.number === input.number)) {
        throw new Error(`Member number ${input.number} is already taken.`)
      }
      person.member = {
        number: input.number,
        status: "active",
        admittedOn: input.admittedOn,
        fee: input.fee,
        m365Email: m365Address(person.profile.firstName, person.profile.lastName),
      }
      person.feeState = emptyFeeState()
      log(person, actor, `admitted ${person.profile.firstName} as member ${input.number}`)
      if (input.fee === "paid") {
        const payment = {
          paidOn: input.admittedOn,
          method: "transfer" as const,
          amountCents: FEE_AMOUNT_CENTS,
          transferDate: input.admittedOn,
        }
        person.feeState.payment = payment
        issueReceipt(person, payment)
      }
    },
    setMemberStatus: async (input) => {
      require(viewer, "people:members:write")
      const person = find(input.personId)
      if (!person.member) throw new Error("This person isn't a member.")
      person.member.status = input.status
      if (input.status === "former") person.member.fee = null
      log(person, actor, `changed the member status to ${input.status}${input.reason ? `: ${input.reason}` : ""}`)
    },
    setMemberNumber: async (input) => {
      require(viewer, "people:members:write")
      const person = find(input.personId)
      if (!person.member) throw new Error("This person isn't a member.")
      const taken = data().people.find((other) => other !== person && other.member?.number === input.number)
      if (taken) throw new Error(`Member number ${input.number} belongs to ${fullName(taken)}.`)
      const previous = person.member.number
      person.member.number = input.number
      log(person, actor, `changed the member number from ${previous} to ${input.number}`)
    },
    exportMembers: async () => {
      require(viewer, "people:members:write")
      const lines = [["Number", "Name", "Status", "Admitted on", "Fee", "Microsoft 365"].join(",")]
      for (const person of data().people) {
        const member = person.member
        if (!member) continue
        lines.push(
          [member.number, fullName(person), member.status, member.admittedOn, member.fee ?? "", member.m365Email]
            .map(csvCell)
            .join(",")
        )
      }
      return { filename: `member-register-${today()}.csv`, csv: lines.join("\n") }
    },
    endAdmin: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      if (!person.admin || person.admin.status !== "active") throw new Error("This person isn't an active admin.")
      if (person.admin.capoScope) require(viewer, "people:appoint")
      Object.assign(person.admin, {
        status: "former",
        endedOn: today(),
        endReason: input.reason,
        groups: [],
        requested: [],
        capoScope: null,
      })
      log(person, actor, `ended the admin role: ${input.reason}`)
    },
    setCapoScope: async (input) => {
      require(viewer, "people:appoint")
      const person = find(input.personId)
      if (!person.admin || person.admin.status !== "active") throw new Error("Only active admins can be Capo Admins.")
      person.admin.capoScope = input.scope
      log(
        person,
        actor,
        input.scope ? `appointed ${person.profile.firstName} Capo Admin of ${input.scope}` : "ended the Capo Admin role"
      )
    },
    setCapoOfReference: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      if (!person.admin || person.admin.status !== "active") throw new Error("Only active admins have a Capo Admin.")
      if (input.capoId === null) {
        person.admin.capoOfReference = null
        log(person, actor, "removed the Capo Admin of reference")
        return
      }
      const capo = find(input.capoId)
      if (!capo.admin?.capoScope) throw new Error(`${fullName(capo)} isn't a Capo Admin.`)
      person.admin.capoOfReference = { id: capo.id, name: fullName(capo) }
      log(person, actor, `set ${fullName(capo)} as Capo Admin of reference`)
    },
    listTeams: async () => {
      const canRead = viewer.permissions.includes("people:read")
      const leads = leadsOf(linkedRecord(viewer))
      if (!canRead && !leads.length) throw new Error("UNAUTHORIZED")
      const teams: TeamSummary[] = []
      for (const id of TEAM_IDS) {
        if (!canRead && !leads.includes(id)) continue
        const members = data().people.filter((person) => person.teams.some((team) => team.team === id))
        const lead = members.find((person) =>
          person.teams.some((team) => team.team === id && team.role === "lead" && !team.endedOn)
        )
        teams.push({
          id,
          name: TEAMS[id].name,
          lead: lead ? { id: lead.id, name: fullName(lead) } : null,
          members: members.map((person) => row(person, viewer, true)),
        })
      }
      return teams
    },
    listTeamCandidates: async (input) => {
      const canRead = viewer.permissions.includes("people:read")
      if (!canRead && !leadsOf(linkedRecord(viewer)).includes(input.teamId)) throw new Error("UNAUTHORIZED")
      return data()
        .people.filter((person) => !person.teams.some((team) => team.team === input.teamId && !team.endedOn))
        .map((person) => ({ id: person.id, name: fullName(person), course: person.profile.course }))
        .toSorted((a, b) => a.name.localeCompare(b.name))
    },
    addTeamMember: async (input) => {
      const canWrite = viewer.permissions.includes("people:write")
      if (!canWrite && !leadsOf(linkedRecord(viewer)).includes(input.teamId)) throw new Error("UNAUTHORIZED")
      if (input.role === "lead") require(viewer, "people:appoint")
      const person = find(input.personId)
      if (person.teams.some((team) => team.team === input.teamId && !team.endedOn)) {
        throw new Error(`${fullName(person)} is already in ${TEAMS[input.teamId].name}.`)
      }
      person.teams.push({
        team: input.teamId,
        role: input.role,
        since: input.since,
        endedOn: null,
        endReason: null,
        fields: input.fields,
      })
      log(
        person,
        actor,
        `added ${person.profile.firstName} to ${TEAMS[input.teamId].name} as ${input.role === "lead" ? "Team Lead" : "Member"}`
      )
    },
    updateTeamFields: async (input) => {
      const canWrite = viewer.permissions.includes("people:write")
      if (!canWrite && !leadsOf(linkedRecord(viewer)).includes(input.teamId)) throw new Error("UNAUTHORIZED")
      const membership = find(input.personId).teams.find((team) => team.team === input.teamId && !team.endedOn)
      if (!membership) throw new Error("This membership has ended.")
      membership.fields = input.fields
    },
    endTeamMembership: async (input) => {
      const canWrite = viewer.permissions.includes("people:write")
      if (!canWrite && !leadsOf(linkedRecord(viewer)).includes(input.teamId)) throw new Error("UNAUTHORIZED")
      const person = find(input.personId)
      const membership = person.teams.find((team) => team.team === input.teamId && !team.endedOn)
      if (!membership) throw new Error("This membership has already ended.")
      if (membership.role === "lead") require(viewer, "people:appoint")
      membership.endedOn = input.lastDay
      membership.endReason = input.reason
      log(person, actor, `ended the ${TEAMS[input.teamId].name} membership: ${input.reason}`)
    },
    listCampaigns: async () => {
      require(viewer, "people:read")
      return campaigns()
    },
    getCampaign: async (id) => {
      require(viewer, "people:read")
      const campaign = campaigns().find((candidate) => candidate.id === id)
      if (!campaign) throw new Error("NOT_FOUND")
      const people =
        campaign.status === "open"
          ? data().people.filter((person) => person.expected)
          : data().people.filter((person) => person.census.some((entry) => entry.year === campaign.year))
      return { campaign, people: people.map((person) => row(person, viewer, true)) } satisfies CampaignDetail
    },
    getAnswers: async (input) => {
      require(viewer, "people:read")
      const person = find(input.personId)
      const entry = person.census.find((candidate) => candidate.year === input.year)
      if (!entry?.answer) throw new Error("No answer for this year.")
      return [
        {
          question: `Will you continue volunteering in ${input.year}?`,
          answer: entry.answer === "continues" ? "Yes" : "No",
        },
        ...(entry.answer === "leaving"
          ? [{ question: "Why are you leaving?", answer: person.admin?.endReason ?? "Graduating" }]
          : []),
        { question: "Course and year", answer: `${person.profile.course}, ${person.profile.year}` },
        { question: "Campus", answer: person.profile.campus },
        {
          question: "Telegram username",
          answer: `@${person.censusTelegram ?? person.profile.telegramUsername ?? "—"}`,
        },
        {
          question: "Groups you administer",
          answer: person.admin?.groups.map((group) => group.title).join(", ") || "—",
        },
        { question: "Are you a PoliNetwork member (socio)?", answer: entry.declaredMember ? "Yes" : "No" },
        { question: "Available as Capo Admin?", answer: person.admin?.availableAsCapo ? "Yes" : "No" },
        {
          question: "Photo and video consent",
          answer: person.consents.photo?.status === "granted" ? "I agree" : "I don't agree",
        },
      ]
    },
    remind: async (input) => {
      require(viewer, "people:write")
      if (campaigns().find((campaign) => campaign.id === input.campaignId)?.status !== "open") {
        throw new Error("Reminders go out only while the campaign is open.")
      }
      const targets = data().people.filter(
        (person) =>
          person.expected &&
          (input.personId === null || person.id === input.personId) &&
          person.census.some((entry) => entry.year === "2026/27" && entry.answer === null)
      )
      let sent = 0
      let skipped = 0
      for (const person of targets) {
        const entry = person.census.find((candidate) => candidate.year === "2026/27")
        if (!entry) continue
        if (input.personId === null && entry.reminders >= 2) {
          skipped++
          continue
        }
        entry.reminders++
        sent++
      }
      return { sent, skipped }
    },
    closeCampaign: async (id) => {
      require(viewer, "people:write")
      const campaign = campaigns().find((candidate) => candidate.id === id)
      if (!campaign) throw new Error("NOT_FOUND")
      if (campaign.status === "closed") throw new Error("This campaign is already closed.")
      closedCampaigns.add(id)
    },
    importPreview: async (_campaignId, file) => {
      require(viewer, "people:write")
      const preview = buildPreview(file.name)
      previews.set(preview.importId, preview)
      return preview
    },
    importCommit: async (input) => {
      require(viewer, "people:write")
      const preview = previews.get(input.importId)
      if (!preview) throw new Error("This import expired. Upload the file again.")
      importedFiles.add(preview.fileName)
      previews.delete(input.importId)
      return { imported: preview.rows - preview.counts.invalid - preview.counts.alreadyImported }
    },
    listReviews: async () => {
      require(viewer, "people:read")
      return data().reviews
    },
    resolveReview: async (input) => {
      require(viewer, "people:write")
      const store = data()
      const review = store.reviews.find((candidate) => candidate.id === input.reviewId)
      if (!review) throw new Error("This item was already resolved.")
      store.reviews = store.reviews.filter((candidate) => candidate !== review)
      const linksOther = ["link-other", "link-second"].includes(input.resolution)
      const linked = linksOther ? review.other : review.record
      const target = linked ? store.byId.get(linked.id) : undefined
      if (
        target &&
        ["move-telegram", "link-other", "link-first", "link-second", "link-anyway"].includes(input.resolution)
      ) {
        target.account = {
          status: "linked",
          email: review.account.email,
          via: review.account.via,
          linkedOn: today(),
          how: `Resolved by ${actor}`,
        }
        log(target, actor, `linked ${review.account.email}: ${input.reason}`)
      } else if (target && target.account.status === "review") {
        target.account = { status: "none" }
      }
    },
    dismissReview: async (input) => {
      require(viewer, "people:write")
      const store = data()
      const review = store.reviews.find((candidate) => candidate.id === input.reviewId)
      store.reviews = store.reviews.filter((candidate) => candidate.id !== input.reviewId)
      const target = review?.record ? store.byId.get(review.record.id) : undefined
      if (target?.account.status === "review") target.account = { status: "none" }
    },
    listInvites: async () => {
      require(viewer, "people:read")
      return data().people.flatMap((person) =>
        person.account.status === "invite"
          ? [
              {
                personId: person.id,
                name: fullName(person),
                email: person.account.email,
                sentOn: person.account.sentOn,
                expiresOn: person.account.expiresOn,
                sentBy: person.account.sentBy,
              },
            ]
          : []
      )
    },
    sendInvite: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      if (person.account.status === "linked") throw new Error(`${fullName(person)} has already linked an account.`)
      if (!person.profile.personalEmail) throw new Error("Add a personal email before sending an invite.")
      person.account = {
        status: "invite",
        email: person.profile.personalEmail,
        sentOn: today(),
        expiresOn: addDays(today(), 14),
        sentBy: actor,
      }
      log(person, actor, `sent an invite to ${person.profile.personalEmail}`)
    },
    revokeInvite: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      if (person.account.status !== "invite") throw new Error("There is no pending invite.")
      person.account = { status: "none" }
      log(person, actor, "revoked the invite")
    },
    searchAccounts: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      const { firstName, lastName, personalEmail, telegramUsername } = person.profile
      const otherFirst = `${firstName.slice(0, -1)}${firstName.endsWith("a") ? "o" : "a"}`
      const accounts: AccountMatch[] = [
        {
          id: "acc-1",
          name: fullName(person),
          email: personalEmail ?? `${firstName.toLowerCase()}@gmail.com`,
          telegram: telegramUsername ? `@${telegramUsername}` : null,
          via: "Signed in with Telegram on 13 Oct 2026",
          linkedTo: null,
          reason: "same-telegram",
        },
        {
          id: "acc-2",
          name: `${firstName} ${lastName}ni`,
          email: `${firstName[0].toLowerCase()}.${lastName.toLowerCase()}ni@outlook.it`,
          telegram: null,
          via: "Signed in with Google on 2 Oct 2026",
          linkedTo: null,
          reason: "similar-name",
        },
        {
          id: "acc-3",
          name: `${otherFirst} ${lastName}`,
          email: `${otherFirst.toLowerCase()}.${lastName.toLowerCase()}@mail.polimi.it`,
          telegram: null,
          via: "Signed in with Microsoft 365 on 28 Sep 2026",
          linkedTo: { id: "P-0057", name: `${otherFirst} ${lastName}` },
          reason: "similar-name",
        },
      ]
      const query = input.query.toLowerCase().replace(/^@/, "")
      return query
        ? accounts.filter((account) =>
            `${account.name} ${account.email} ${account.telegram ?? ""}`.toLowerCase().includes(query)
          )
        : accounts
    },
    linkAccount: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      const accounts = await fakePeopleApi(viewer).searchAccounts({ personId: input.personId, query: "" })
      const account = accounts.find((candidate) => candidate.id === input.accountId)
      if (!account) throw new Error("This account no longer exists.")
      if (account.linkedTo) {
        throw new Error(
          `This account is already linked to ${account.linkedTo.name} (${account.linkedTo.id}). Unlink it there first, or pick another account.`
        )
      }
      person.account = {
        status: "linked",
        email: account.email,
        via: account.via.split(" on ")[0].replace("Signed in with ", ""),
        linkedOn: today(),
        how: `Linked by ${actor}`,
      }
      log(person, actor, `linked ${account.email}: ${input.reason}`)
    },
    unlinkAccount: async (input) => {
      require(viewer, "people:write")
      const person = find(input.personId)
      if (person.account.status !== "linked") throw new Error("No account is linked.")
      log(person, actor, `unlinked ${person.account.email}`)
      person.account = { status: "none" }
    },
    getCapoArea: async () => {
      require(viewer, "people:self")
      const me = linkedRecord(viewer)
      const scope = me?.admin?.capoScope
      const family = scope ? familyOfScope(scope) : undefined
      if (!scope || !family) throw new Error("UNAUTHORIZED")
      const titles = FAMILIES[family].groups
      const admins = data().people.filter(
        (person) =>
          person.admin?.status === "active" && person.admin.groups.some((group) => titles.includes(group.title))
      )
      return {
        scope,
        groups: titles.map((title) => ({
          chatId: GROUP_IDS.get(title) ?? "",
          title,
          admins: admins.filter((person) => person.admin?.groups.some((group) => group.title === title)).length,
        })),
        admins: admins.map((person) => ({
          ...row(person, viewer, true),
          profile: { ...person.profile, personalEmail: null },
        })),
        requests: data()
          .joinRequests.filter((request) => titles.includes(request.group))
          .map((request) => {
            const person = find(request.personId)
            return {
              id: request.id,
              person: { id: person.id, name: fullName(person) },
              group: { chatId: GROUP_IDS.get(request.group) ?? "", title: request.group },
              requestedOn: request.requestedOn,
            }
          }),
      } satisfies CapoArea
    },
    approveJoinRequest: async (input) => {
      require(viewer, "people:self")
      const store = data()
      const request = capoRequest(viewer, input.requestId)
      const person = find(request.personId)
      if (person.admin && !person.admin.groups.some((group) => group.title === request.group)) {
        person.admin.groups.push({ chatId: GROUP_IDS.get(request.group) ?? "", title: request.group })
        person.admin.requested = person.admin.requested.filter((group) => group.title !== request.group)
      }
      store.joinRequests = store.joinRequests.filter((candidate) => candidate !== request)
      log(person, actor, `approved ${person.profile.firstName} as admin of ${request.group}`)
    },
    declineJoinRequest: async (input) => {
      require(viewer, "people:self")
      const store = data()
      const request = capoRequest(viewer, input.requestId)
      const person = find(request.personId)
      if (person.admin) person.admin.requested = person.admin.requested.filter((group) => group.title !== request.group)
      store.joinRequests = store.joinRequests.filter((candidate) => candidate !== request)
    },
    getMyRoles: async () => {
      const me = linkedRecord(viewer)
      return { capoScope: me?.admin?.capoScope ?? null, leads: leadsOf(me) }
    },
    getMyArea: async () => {
      require(viewer, "people:self")
      const me = viewerRecord(viewer)
      if (!me || self.matchRejected)
        return { state: "none", request: self.askedOn ? { sentOn: self.askedOn } : null } satisfies MyArea
      if (viewer.personId?.startsWith("match:") && !self.matchConfirmed) {
        const roles = [
          ...(me.member && me.member.status !== "former" ? ["Member"] : []),
          ...(me.admin?.status === "active" ? ["Admin"] : []),
          ...me.teams.filter((team) => !team.endedOn).map((team) => TEAMS[team.team].name),
        ]
        return {
          state: "match",
          candidate: {
            id: me.id,
            name: fullName(me),
            course: me.profile.course,
            year: me.profile.year,
            campus: me.profile.campus,
            roles,
          },
          reason: me.profile.telegramUsername
            ? `Matched on your verified Telegram account, @${me.profile.telegramUsername}.`
            : "Matched on your email address.",
        } satisfies MyArea
      }
      const contacts: Extract<MyArea, { state: "linked" }>["contacts"] = []
      const capo = me.admin?.capoOfReference ? data().byId.get(me.admin.capoOfReference.id) : undefined
      if (capo)
        contacts.push({
          role: "capo",
          name: fullName(capo),
          telegram: capo.profile.telegramUsername,
          email: null,
          team: null,
        })
      for (const membership of me.teams.filter((team) => !team.endedOn)) {
        const lead = data().people.find(
          (person) =>
            person !== me &&
            person.teams.some((team) => team.team === membership.team && team.role === "lead" && !team.endedOn)
        )
        if (lead)
          contacts.push({
            role: "lead",
            name: fullName(lead),
            telegram: lead.profile.telegramUsername,
            email: null,
            team: membership.team,
          })
      }
      contacts.push({ role: "hr", name: "HR team", telegram: null, email: "hr@polinetwork.org", team: null })
      const team = me.teams.find((membership) => !membership.endedOn)?.team ?? null
      const roster = team
        ? {
            team,
            members: data()
              .people.flatMap((person) => {
                const membership = person.teams.find((candidate) => candidate.team === team && !candidate.endedOn)
                if (!membership) return []
                const email =
                  person.member || person.account.status === "linked"
                    ? m365Address(person.profile.firstName, person.profile.lastName)
                    : null
                return [
                  {
                    id: person.id,
                    name: fullName(person),
                    role: membership.role,
                    telegram: person.profile.telegramUsername,
                    email,
                  },
                ]
              })
              .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === "lead" ? -1 : 1)),
          }
        : null
      const current = me.member && me.member.status !== "former" ? me.member : null
      return {
        state: "linked",
        person: { ...record(me, { ...viewer, personId: me.id }), notes: null },
        feeInstructions: current
          ? {
              beneficiary: FEE_BENEFICIARY,
              iban: FEE_IBAN,
              reference: `Quota ${FEE_YEAR} ${current.number} ${fullName(me)}`,
            }
          : null,
        campaign: me.expected ? { id: "2026", year: "2026/27", closesOn: "2026-10-31" } : null,
        contacts,
        roster,
      } satisfies MyArea
    },
    confirmMatch: async () => {
      require(viewer, "people:self")
      const me = viewerRecord(viewer)
      if (!me || self.matchRejected || !viewer.personId?.startsWith("match:")) {
        throw new Error("There is no record to link.")
      }
      self.matchConfirmed = true
      me.account = {
        status: "linked",
        email: me.profile.personalEmail ?? "",
        via: "Telegram",
        linkedOn: today(),
        how: `Confirmed by ${fullName(me)} at first sign-in`,
      }
    },
    rejectMatch: async () => {
      require(viewer, "people:self")
      self.matchRejected = true
      self.askedOn = today()
    },
    acceptInvite: async () => {
      require(viewer, "people:self")
      const me = viewerRecord(viewer)
      if (!me || linkedRecord(viewer) || self.matchRejected || me.account.status !== "invite") {
        throw new Error("Invitation expired or not addressed to this account.")
      }
      self.matchConfirmed = true
      me.account = {
        status: "linked",
        email: me.account.email,
        via: "Email",
        linkedOn: today(),
        how: "Accepted the email invitation",
      }
    },
    askToBeAdded: async () => {
      require(viewer, "people:self")
      self.askedOn = today()
    },
    answerCensus: async (input) => {
      require(viewer, "people:self")
      const me = linkedRecord(viewer)
      if (!me) throw new Error("There is no record to answer for.")
      if (me.census.some((entry) => entry.year === "2026/27" && entry.answer))
        throw new Error("Census already answered.")
      me.census = me.census.filter((entry) => entry.year !== "2026/27")
      me.census.unshift({
        year: "2026/27",
        answer: input.answer,
        answeredOn: today(),
        source: "dashboard",
        declaredMember: me.member !== null && me.member.status !== "former",
        reminders: 0,
      })
      Object.assign(me.profile, { course: input.course, year: input.year, campus: input.campus })
      log(me, fullName(me), `answered the 2026/27 census: ${input.answer === "continues" ? "continues" : "leaving"}`)
    },
    requestCorrection: async (input) => {
      require(viewer, "people:self")
      const me = linkedRecord(viewer)
      if (me) log(me, fullName(me), `asked HR to correct ${input.field.toLowerCase()}`)
    },
    revokePhotoConsent: async () => {
      require(viewer, "people:self")
      const me = linkedRecord(viewer)
      if (!me?.consents.photo || me.consents.photo.status !== "granted")
        throw new Error("There is no photo and video consent to revoke.")
      me.consents.photo = { status: "revoked", on: today() }
      log(me, fullName(me), "revoked the photo and video consent")
    },
    getFeeReview: async (input) => {
      require(viewer, "people:fees:write")
      const { person, member, state } = currentMember(input.personId)
      const fee = feeDetail(person)
      if (!fee) throw new Error("This person isn't a current member.")
      return {
        person: { id: person.id, name: fullName(person) },
        memberNumber: member.number,
        m365Email: member.m365Email,
        fee,
        rejections: state.rejections,
        nextReceipt: nextReceiptNumber(
          FEE_YEAR,
          data().receipts.map((receipt) => receipt.number)
        ),
      }
    },
    getFeeUpload: async (input) => {
      require(viewer, "people:fees:write")
      const { person, member, state } = currentMember(input.personId)
      if (!state.upload) throw new Error("There is no transfer receipt to show.")
      const file = transferFiles.get(person.id)
      const bytes =
        file?.bytes ??
        sampleTransferPdf({
          name: fullName(person),
          memberNumber: member.number,
          date: state.upload.transferDate,
          amountCents: state.upload.amountCents,
        })
      return {
        fileName: state.upload.fileName,
        contentType: file?.type ?? "application/pdf",
        base64: Buffer.from(bytes).toString("base64"),
      }
    },
    approveFee: async (input) => {
      require(viewer, "people:fees:write")
      const { person, member, state } = currentMember(input.personId)
      if (member.fee !== "receipt" || !state.upload) throw new Error("There is no transfer receipt to review.")
      const payment = {
        paidOn: state.upload.transferDate,
        method: "transfer" as const,
        amountCents: state.upload.amountCents,
        transferDate: state.upload.transferDate,
      }
      member.fee = "paid"
      state.payment = payment
      state.upload = null
      state.rejection = null
      transferFiles.delete(person.id)
      log(person, actor, `approved the transfer receipt for ${FEE_YEAR}`)
      return { receipt: issueReceipt(person, payment).number }
    },
    rejectFee: async (input) => {
      require(viewer, "people:fees:write")
      const { person, member, state } = currentMember(input.personId)
      if (member.fee !== "receipt" || !state.upload) throw new Error("There is no transfer receipt to review.")
      const rejection = { reason: input.reason, by: actor, at: nowStamp() }
      member.fee = unpaidStatus()
      state.upload = null
      state.rejection = rejection
      state.rejections.unshift(rejection)
      transferFiles.delete(person.id)
      log(person, actor, `rejected the transfer receipt for ${FEE_YEAR}: “${input.reason}”`)
    },
    markFeePaid: async (input) => {
      require(viewer, "people:fees:write")
      const { person, member, state } = currentMember(input.personId)
      if (member.fee === "paid") throw new Error(`The ${FEE_YEAR} fee is already paid.`)
      const payment = {
        paidOn: input.paidOn,
        method: input.method,
        amountCents: input.amountCents,
        transferDate: input.method === "transfer" ? input.paidOn : null,
      }
      member.fee = "paid"
      state.payment = payment
      state.upload = null
      state.rejection = null
      transferFiles.delete(person.id)
      const how = input.method === "cash" ? "cash" : "bank transfer"
      log(person, actor, `marked the ${FEE_YEAR} fee as paid (${how})${input.note ? `: “${input.note}”` : ""}`)
      return { receipt: issueReceipt(person, payment).number }
    },
    remindFees: async (input) => {
      require(viewer, "people:fees:write")
      const recently = new Date(Date.now() - 3 * 86_400_000).toISOString()
      const targets =
        input.personId === null
          ? data().people.filter(
              (person) =>
                person.feeState &&
                person.member?.status !== "former" &&
                (person.member?.fee === "due" || person.member?.fee === "unpaid")
            )
          : [currentMember(input.personId).person]
      let sent = 0
      let skipped = 0
      for (const person of targets) {
        const state = person.feeState
        if (!state) continue
        if (person.member?.fee !== "due" && person.member?.fee !== "unpaid") {
          throw new Error(`${fullName(person)}'s fee isn't due.`)
        }
        if (input.personId === null && state.lastReminder && new Date(state.lastReminder).toISOString() > recently) {
          skipped++
          continue
        }
        state.lastReminder = nowStamp()
        log(person, actor, `sent a reminder for the ${FEE_YEAR} fee`)
        sent++
      }
      return { sent, skipped }
    },
    listReceipts: async (input) => {
      require(viewer, "people:members:read")
      const all = data().receipts
      const years = [...new Set(all.map((receipt) => receipt.year))].sort().reverse()
      const year = input.year ?? FEE_YEAR
      const ref = (id: string) => {
        const person = data().byId.get(id)
        return person ? { id, name: fullName(person) } : null
      }
      return {
        year,
        years: years.includes(FEE_YEAR) ? years : [FEE_YEAR, ...years],
        viewerSigner: viewerSigner(viewer),
        officers: { president: ref(OFFICERS.president), vicePresident: ref(OFFICERS.vicePresident) },
        receipts: all.filter((receipt) => receipt.year === year).sort((a, b) => (a.number < b.number ? 1 : -1)),
      }
    },
    downloadReceipt: async (input) => {
      require(viewer, "people:members:read")
      return receiptFile(findReceipt(input.receiptId))
    },
    downloadReceiptsToSign: async () => {
      require(viewer, "people:receipts:sign")
      const signer = viewerSigner(viewer)
      if (!signer) throw new Error("Only the President and the Vice-president sign receipts.")
      const waiting = data().receipts.filter((receipt) => receipt.status === "toSign" && receipt.signer === signer)
      if (waiting.length === 0) throw new Error("No receipts are waiting for your signature.")
      const zip = zipFiles(
        waiting.map((receipt) => ({
          name: receiptFileName(receipt.number),
          bytes: Buffer.from(receiptFile(receipt).base64, "base64"),
        }))
      )
      return {
        fileName: `Ricevute_da_firmare_${today()}.zip`,
        contentType: "application/zip",
        base64: zip.toString("base64"),
      }
    },
    previewSignedReceipts: async (files) => {
      require(viewer, "people:receipts:sign")
      const uploadId = `su-${Date.now().toString(36)}`
      const read = await Promise.all(
        files.map(async (file, index) => {
          const bytes = new Uint8Array(await file.arrayBuffer())
          return { fileId: `f${index + 1}`, name: file.name, bytes, signed: looksSigned(file.name, bytes) }
        })
      )
      signedUploads.set(uploadId, read)
      return {
        uploadId,
        files: read.map((file) => {
          const number = receiptNumberFromFileName(file.name)
          const receipt = number ? data().receipts.find((candidate) => candidate.number === number) : undefined
          return {
            fileId: file.fileId,
            fileName: file.name,
            size: file.bytes.length,
            receiptId: receipt?.id ?? null,
            signature: { valid: file.signed, signer: file.signed ? actor : null },
          }
        }),
      } satisfies SignedUpload
    },
    sendSignedReceipts: async (input) => {
      require(viewer, "people:receipts:sign")
      const signer = viewerSigner(viewer)
      if (!signer) throw new Error("Only the President and the Vice-president sign receipts.")
      const upload = signedUploads.get(input.uploadId)
      if (!upload) throw new Error("This upload expired. Add the files again.")
      const chosen = Object.entries(input.assignments).map(([fileId, id]) => {
        const file = upload.find((candidate) => candidate.fileId === fileId)
        if (!file) throw new Error("This upload changed. Add the files again.")
        const receipt = findReceipt(id)
        if (!file.signed) throw new Error(`${file.name} isn't signed.`)
        if (receipt.status !== "toSign") throw new Error(`Receipt ${receipt.number} is already signed.`)
        if (receipt.signer !== signer) throw new Error(`Receipt ${receipt.number} needs another signer.`)
        return { file, receipt }
      })
      const ids = chosen.map(({ receipt }) => receipt.id)
      if (new Set(ids).size !== ids.length) throw new Error("Two files point at the same receipt.")
      let sent = 0
      let failed = 0
      for (const { file, receipt } of chosen) {
        receipt.status = "signed"
        receipt.signedBy = actor
        receipt.signedOn = today()
        signedFiles.set(receipt.id, file.bytes)
        log(find(receipt.person.id), actor, `uploaded receipt ${receipt.number}, signed`)
        if (sendReceipt(receipt)) sent++
        else failed++
      }
      signedUploads.delete(input.uploadId)
      return { sent, failed }
    },
    retryReceipt: async (input) => {
      require(viewer, "people:fees:write")
      const receipt = findReceipt(input.receiptId)
      if (receipt.status !== "failed") throw new Error(`Receipt ${receipt.number} isn't waiting for a retry.`)
      // In the sample data the address gets fixed before anyone retries.
      const person = find(receipt.person.id)
      if (person.feeState) person.feeState.mailFails = false
      if (!sendReceipt(receipt)) throw new Error(receipt.failure ?? "The receipt couldn't be sent.")
    },
    voidReceipt: async (input) => {
      require(viewer, "people:fees:write")
      const receipt = findReceipt(input.receiptId)
      if (receipt.status === "voided") throw new Error(`Receipt ${receipt.number} is already voided.`)
      receipt.status = "voided"
      receipt.voided = { reason: input.reason, by: actor, on: today() }
      const person = find(receipt.person.id)
      log(person, actor, `voided receipt ${receipt.number}: “${input.reason}”`)
      const stillValid = data().receipts.some(
        (other) => other.person.id === person.id && other.year === receipt.year && other.status !== "voided"
      )
      // Voiding this year's only receipt reopens the fee, so the admin can issue a correct one.
      if (receipt.year === FEE_YEAR && !stillValid && person.member?.fee === "paid" && person.feeState) {
        person.member.fee = unpaidStatus()
        person.feeState.payment = null
      }
    },
    uploadTransferReceipt: async (file, input) => {
      require(viewer, "people:self")
      const me = linkedRecord(viewer)
      if (!me) throw new Error("There is no record to upload for.")
      const { member, state } = currentMember(me.id)
      if (member.fee === "paid") throw new Error(`Your ${FEE_YEAR} fee is already paid.`)
      const bytes = new Uint8Array(await file.arrayBuffer())
      transferFiles.set(me.id, { name: file.name, type: file.type || "application/pdf", bytes })
      state.upload = {
        fileName: file.name,
        size: bytes.length,
        uploadedAt: nowStamp(),
        transferDate: input.transferDate,
        amountCents: input.amountCents,
      }
      state.rejection = null
      member.fee = "receipt"
      log(me, fullName(me), `uploaded a transfer receipt for ${FEE_YEAR}`)
    },
    downloadMyReceipt: async (input) => {
      require(viewer, "people:self")
      const me = linkedRecord(viewer)
      const receipt = findReceipt(input.receiptId)
      // Members get their own receipts once signed; anything else reads as missing.
      if (!me || receipt.person.id !== me.id || receipt.status === "toSign" || receipt.status === "voided") {
        throw new Error("This receipt no longer exists.")
      }
      return receiptFile(receipt)
    },
  }
}
