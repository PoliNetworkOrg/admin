import type { StatusTone } from "@/components/primitives"

/**
 * Static sample data for the People pages kept as unconnected UI mockups: the member register (Soci), fees, receipts
 * and the census. Nothing here comes from or goes to the backend, and none of it is part of the People contract
 * (`people.contract.ts`). Phase 2 (#144) rebuilds Soci, fees and receipts on Microsoft 365 members; Phase 3 (#145)
 * rebuilds the census.
 */

type Tone = { label: string; tone: StatusTone }

export const MOCK_MEMBER_STATUSES = ["active", "suspended", "expired", "former"] as const
export const MOCK_FEE_STATUSES = ["due", "receipt", "paid", "unpaid"] as const
export const MOCK_RECEIPT_STATUSES = ["toSign", "signed", "sent", "failed", "voided"] as const

export type MockMemberStatus = (typeof MOCK_MEMBER_STATUSES)[number]
export type MockFeeStatus = (typeof MOCK_FEE_STATUSES)[number]
export type MockReceiptStatus = (typeof MOCK_RECEIPT_STATUSES)[number]
export type MockSigner = "president" | "vicePresident"
export type MockCensusAnswer = "continues" | "leaving"

export const MOCK_MEMBER_STATUS = {
  active: { label: "Active", tone: "success", description: "Full member for the current year." },
  suspended: { label: "Suspended", tone: "danger", description: "Rights paused by the Direttivo; keeps the number." },
  expired: { label: "Expired", tone: "warning", description: "Fee not renewed; becomes Former after a year." },
  former: { label: "Former", tone: "neutral", description: "No longer a member. The number is never reused." },
} satisfies Record<MockMemberStatus, Tone & { description: string }>

export const MOCK_FEE_STATUS = {
  paid: { label: "Paid", tone: "success" },
  receipt: { label: "Receipt uploaded", tone: "brand" },
  due: { label: "Due", tone: "warning" },
  unpaid: { label: "Unpaid", tone: "danger" },
} satisfies Record<MockFeeStatus, Tone>

export const MOCK_RECEIPT_STATUS = {
  toSign: { label: "To sign", tone: "warning" },
  signed: { label: "Signed", tone: "brand" },
  sent: { label: "Sent", tone: "success" },
  failed: { label: "Send failed", tone: "danger" },
  voided: { label: "Voided", tone: "neutral" },
} satisfies Record<MockReceiptStatus, Tone>

export const MOCK_SIGNER_LABEL = { president: "President", vicePresident: "Vice-president" } satisfies Record<
  MockSigner,
  string
>

export const MOCK_CENSUS_ANSWER = {
  continues: { label: "Continues", tone: "success" },
  leaving: { label: "Leaving", tone: "warning" },
} satisfies Record<MockCensusAnswer, Tone>

export const MOCK_NO_ANSWER = { label: "No answer", tone: "neutral" } satisfies Tone

export const MOCK_CENSUS_SOURCE = { forms: "Imported from Forms", dashboard: "Dashboard" } as const

/** "€10.00": the mock amounts are integer cents. */
export function formatCents(cents: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(cents / 100)
}

/** The fee year every mockup shows. */
export const MOCK_FEE_YEAR = "2026/27"

export type MockMember = {
  id: string
  name: string
  number: string
  status: MockMemberStatus
  admittedOn: string
  /** The current fee year's fee; `null` for former members. */
  fee: MockFeeStatus | null
  m365Email: string
}

export const MOCK_MEMBERS: readonly MockMember[] = [
  member("0001", "Giulia Rossi", "active", "2019-10-14", "paid"),
  member("0004", "Marco Bianchi", "active", "2019-11-02", "receipt"),
  member("0007", "Sara Colombo", "active", "2020-10-05", "due"),
  member("0012", "Luca Ferrari", "suspended", "2021-03-18", "unpaid"),
  member("0015", "Chiara Esposito", "expired", "2021-10-11", "unpaid"),
  member("0021", "Davide Romano", "active", "2022-10-03", "paid"),
  member("0023", "Elena Ricci", "active", "2023-09-28", "due"),
  member("0030", "Paolo Greco", "former", "2020-01-20", null),
  member("0034", "Anna Bruno", "active", "2024-10-07", "paid"),
  member("0041", "Matteo Gallo", "active", "2025-10-13", "receipt"),
]

function member(number: string, name: string, status: MockMemberStatus, admittedOn: string, fee: MockFeeStatus | null) {
  const [first = "", last = ""] = name.toLocaleLowerCase().split(" ")
  return { id: `mock-${number}`, name, number, status, admittedOn, fee, m365Email: `${first}.${last}@polinetwork.org` }
}

export type MockReceipt = {
  id: string
  /** The fee year's first calendar year and a sequence never reused. */
  number: string
  name: string
  memberNumber: string
  amountCents: number
  issuedOn: string
  status: MockReceiptStatus
  signer: MockSigner
  signedBy: string | null
}

export const MOCK_OFFICERS = { president: "Giulia Rossi", vicePresident: "Marco Bianchi" } satisfies Record<
  MockSigner,
  string
>

export const MOCK_RECEIPTS: readonly MockReceipt[] = [
  receipt("2026/001", "Anna Bruno", "0034", "2026-09-15", "sent", "president"),
  receipt("2026/002", "Davide Romano", "0021", "2026-09-22", "sent", "president"),
  receipt("2026/003", "Giulia Rossi", "0001", "2026-09-30", "sent", "vicePresident"),
  receipt("2026/004", "Elena Ricci", "0023", "2026-10-06", "voided", "president"),
  receipt("2026/005", "Sara Colombo", "0007", "2026-10-12", "failed", "president"),
  receipt("2026/006", "Matteo Gallo", "0041", "2026-10-20", "signed", "president"),
  receipt("2026/007", "Marco Bianchi", "0004", "2026-10-27", "toSign", "president"),
]

function receipt(
  number: string,
  name: string,
  memberNumber: string,
  issuedOn: string,
  status: MockReceiptStatus,
  signer: MockSigner
): MockReceipt {
  const signed = status === "signed" || status === "sent" || status === "failed"
  return {
    id: `mock-${number}`,
    number,
    name,
    memberNumber,
    amountCents: 1000,
    issuedOn,
    status,
    signer,
    signedBy: signed ? MOCK_OFFICERS[signer] : null,
  }
}

export type MockMyFee = {
  year: string
  status: MockFeeStatus
  amountCents: number
  dueOn: string
  instructions: { beneficiary: string; iban: string; reference: string }
  receipts: { id: string; number: string; year: string; sentOn: string }[]
}

/** My area's fee card: a current member who still owes this year's fee, and last year's receipt. */
export const MOCK_MY_FEE = {
  year: MOCK_FEE_YEAR,
  status: "due",
  amountCents: 1000,
  dueOn: "2026-12-31",
  instructions: { beneficiary: "PoliNetwork APS", iban: "IT00 X000 0000 0000 0000 0000 000", reference: "Quota 0007" },
  receipts: [{ id: "mock-2025/019", number: "2025/019", year: "2025/26", sentOn: "2025-10-21" }],
} satisfies MockMyFee

export type MockCampaign = {
  id: string
  year: string
  status: "open" | "closed"
  openedOn: string
  closesOn: string
  source: string
  expected: number
  continuing: number
  leaving: number
  noAnswer: number
}

export type MockCampaignRow = {
  id: string
  name: string
  course: string
  roles: string[]
  answer: MockCensusAnswer | null
  answeredOn: string | null
  source: keyof typeof MOCK_CENSUS_SOURCE | null
  reminders: number
}

function row(
  name: string,
  course: string,
  roles: string[],
  answer: MockCensusAnswer | null,
  answeredOn: string | null,
  source: MockCampaignRow["source"],
  reminders = 0
): MockCampaignRow {
  return {
    id: `mock-${name.toLocaleLowerCase().replace(" ", "-")}`,
    name,
    course,
    roles,
    answer,
    answeredOn,
    source,
    reminders,
  }
}

/** A campaign with its people; the counts come from the people. */
function campaign(
  id: string,
  year: string,
  status: MockCampaign["status"],
  period: { openedOn: string; closesOn: string },
  people: readonly MockCampaignRow[]
) {
  const count = (answer: MockCensusAnswer | null) => people.filter((person) => person.answer === answer).length
  const summary: MockCampaign = {
    id,
    year,
    status,
    ...period,
    source: "Microsoft Forms",
    expected: people.length,
    continuing: count("continues"),
    leaving: count("leaving"),
    noAnswer: count(null),
  }
  return { campaign: summary, people }
}

const CAMPAIGN_DETAILS = [
  campaign("mock-2026", "2026/27", "open", { openedOn: "2026-09-15", closesOn: "2026-11-15" }, [
    row("Giulia Rossi", "Ingegneria Informatica", ["Member", "Admin"], "continues", "2026-09-18", "forms"),
    row("Marco Bianchi", "Ingegneria Gestionale", ["Member", "IT · Lead"], "continues", "2026-09-20", "dashboard"),
    row("Sara Colombo", "Design della Comunicazione", ["Member", "Design & Social"], "leaving", "2026-09-25", "forms"),
    row("Luca Ferrari", "Ingegneria Meccanica", ["Admin"], null, null, null, 2),
    row("Elena Ricci", "Architettura", ["Member", "HR"], "continues", "2026-10-02", "dashboard"),
    row("Paolo Greco", "Computer Science and Engineering", ["Admin", "Capo Admin · Informatica"], null, null, null, 1),
  ]),
  campaign("mock-2025", "2025/26", "closed", { openedOn: "2025-09-15", closesOn: "2025-11-15" }, [
    row("Giulia Rossi", "Ingegneria Informatica", ["Member", "Admin"], "continues", "2025-09-16", "forms"),
    row("Marco Bianchi", "Ingegneria Gestionale", ["Member", "IT"], "continues", "2025-09-19", "forms"),
    row("Paolo Greco", "Computer Science and Engineering", ["Admin"], "leaving", "2025-09-30", "forms"),
    row("Chiara Esposito", "Ingegneria Biomedica", ["Member"], null, null, null, 3),
  ]),
]

export const MOCK_CAMPAIGNS: readonly MockCampaign[] = CAMPAIGN_DETAILS.map((detail) => detail.campaign)

/** A campaign and its people, or `null` for an ID that isn't one of the mockups. */
export function mockCampaign(id: string) {
  return CAMPAIGN_DETAILS.find((detail) => detail.campaign.id === id) ?? null
}
