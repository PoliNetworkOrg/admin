import type { StatusTone } from "@/components/primitives"

/**
 * Static sample data for the People page kept as an unconnected UI mockup: the census. Nothing here comes from or goes
 * to the backend, and none of it is part of the People contract (`people.contract.ts`). Phase 3 (#145) rebuilds it.
 */

type Tone = { label: string; tone: StatusTone }

export type MockCensusAnswer = "continues" | "leaving"

export const MOCK_CENSUS_ANSWER = {
  continues: { label: "Continues", tone: "success" },
  leaving: { label: "Leaving", tone: "warning" },
} satisfies Record<MockCensusAnswer, Tone>

export const MOCK_NO_ANSWER = { label: "No answer", tone: "neutral" } satisfies Tone

export const MOCK_CENSUS_SOURCE = { forms: "Imported from Forms", dashboard: "Dashboard" } as const

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
