# People area: backend contract

The dashboard calls these procedures under `people.*` on the tRPC backend (`@polinetwork/backend`). They do not exist
yet: this file is the spec for the backend project. **`src/features/people/people.contract.ts` is the source of
truth** for every shape and input (zod schemas); where this file differs, the code wins. Notably, list procedures
return full rows (`PersonRow`: profile, member, admin, teams, census, consents, account) rather than the summary below,
and `people.me.roles` returns `{ capoScope, leads }` for the navigation. In agent mode the
dashboard serves the same shapes from `src/features/people/people.fixtures.server.ts`.

Every procedure checks permissions server-side; the "Needs" column is the minimum. Dates are ISO `YYYY-MM-DD` strings
(`Europe/Rome`); timestamps ISO 8601. Academic years are strings like `"2026/27"`.

## Shared types

```ts
type PersonId = string // "P-0142"
type AccountStatus = "none" | "invite" | "linked" | "review"
type MemberStatus = "active" | "suspended" | "expired" | "former"
type FeeStatus = "due" | "receipt" | "paid" | "unpaid"
type CensusAnswer = "continues" | "leaving"
type CensusSource = "forms" | "dashboard"
type TeamId = "it" | "hr" | "design" | "intl" | "events"
type TeamRole = "member" | "lead"
type Campus = "Leonardo" | "Bovisa" | "Cremona" | "Piacenza" | "Mantova" | "Lecco" | "External"

type Profile = {
  firstName: string
  lastName: string
  personalEmail: string | null // omitted (null) without contact rights
  phone: string | null // omitted (null) without contact rights
  telegramUsername: string | null
  telegramId: string | null
  course: string
  year: string // "2nd year", "1st year MSc", "Graduated"
  campus: Campus
  otherAssociations: string[]
  studentRepresentative: string | null
}

type Membership = {
  number: string // "0412"
  status: MemberStatus
  admittedOn: string
  fee: FeeStatus | null // current academic year; null for former members
  m365Email: string
}

type AdminRole = {
  status: "active" | "former"
  since: string
  endedOn: string | null
  endReason: string | null
  groups: { chatId: string; title: string }[] // detected by the bot
  requested: { chatId: string; title: string; requestedOn: string }[]
  availableAsCapo: boolean
  capoOfReference: { id: PersonId; name: string } | null
  capoScope: string | null // set when this person is a Capo Admin, e.g. "Ingegneria Informatica"
}

type TeamMembership = {
  team: TeamId
  role: TeamRole
  since: string
  endedOn: string | null
  endReason: string | null
  fields: Record<string, string | string[]> // per team, see TEAM_FIELDS
}

type CensusEntry = {
  year: string
  answer: CensusAnswer | null // null = expected, no answer
  answeredOn: string | null
  source: CensusSource | null
  declaredMember: boolean | null
  reminders: number
}

type Account =
  | { status: "none" }
  | { status: "invite"; email: string; sentOn: string; expiresOn: string; sentBy: string }
  | { status: "linked"; email: string; via: string; linkedOn: string; how: string }
  | { status: "review"; reviewId: string; issue: string }

type PersonSummary = {
  id: PersonId
  name: string
  personalEmail: string | null
  course: string
  year: string
  campus: Campus
  telegramUsername: string | null
  member: Pick<Membership, "number" | "status" | "fee" | "admittedOn" | "m365Email"> | null // see Backend rules
  isMember: boolean // current member; always present
  admin:
    | (Pick<
        AdminRole,
        "status" | "since" | "groups" | "requested" | "availableAsCapo" | "capoOfReference" | "capoScope"
      > & {
        studentRepresentative: string | null
        otherAssociations: string[]
      })
    | null
  teams: Pick<TeamMembership, "team" | "role" | "since" | "endedOn">[]
  account: AccountStatus
  lastCensus: { year: string; answer: CensusAnswer } | null
  census2627: CensusEntry | null // current campaign entry
  photoConsent: "granted" | "denied" | null
}

type PersonRecord = {
  id: PersonId
  profile: Profile
  member: Membership | null // see Backend rules
  isMember: boolean // current member; always present
  admin: AdminRole | null
  teams: TeamMembership[]
  census: CensusEntry[]
  consents: {
    privacy: { version: string; acceptedOn: string } | null
    photo: { status: "granted" | "denied" | "revoked"; on: string } | null
  }
  account: Account
  notes: string | null // null without people:read
  discrepancies: {
    kind: "declared-member" | "telegram-mismatch" | "needs-review"
    message: string
    suggestedTelegram?: string
  }[]
  activity: { actor: string; text: string; at: string }[]
}
```

Team fields (`TEAM_FIELDS`): `it` → `github` (text), `areas` (Frontend, Backend, Bot, Infrastructure); `design` →
`tools` (Figma, Illustrator, Photoshop, After Effects, InDesign, Premiere), `portfolio` (URL); `hr` and `events` →
`focus` (multi); `intl` → `languages` (multi).

## Register projection

`people.members.list()` returns `MemberRegisterRow[]` with `admin:access` + `people:members:read`, independently
of `people:read`. Each row is `{ id, profile: { firstName, lastName, personalEmail }, member, account: { status } }`.
Include past/current members and names of non-members for the existing admission picker. `personalEmail` is null
without `people:read`. Never include volunteer fields, census, consents, phone, notes or account-link details.
The UI links to full person records only with `people:read`. Write permissions do not imply read permissions.

## Procedures

| Procedure                          | Kind     | Input                                                                                                      | Output                                                                                                                                                          | Needs                                                       |
| ---------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `people.persons.list`              | query    | —                                                                                                          | `PersonSummary[]`                                                                                                                                               | `people:read`                                               |
| `people.persons.get`               | query    | `{ id }`                                                                                                   | `PersonRecord`                                                                                                                                                  | `people:read`                                               |
| `people.persons.create`            | mutation | `Profile` fields + `{ roles: ("admin")[] }`                                                                | `{ id }`                                                                                                                                                        | `people:write`                                              |
| `people.persons.update`            | mutation | `{ id } & Partial<Profile>`                                                                                | `void`                                                                                                                                                          | `people:write`                                              |
| `people.persons.setNote`           | mutation | `{ id, note: string \| null }`                                                                             | `void`                                                                                                                                                          | `people:write`                                              |
| `people.members.create`            | mutation | `{ personId, number, admittedOn, fee }`                                                                    | `{ m365Email }`                                                                                                                                                 | `people:members:write`                                      |
| `people.members.setStatus`         | mutation | `{ personId, status, reason? }`                                                                            | `void`                                                                                                                                                          | `people:members:write`                                      |
| `people.members.setNumber`         | mutation | `{ personId, number }`                                                                                     | `void` (also updates the M365 member ID)                                                                                                                        | `people:members:write`                                      |
| `people.members.export`            | mutation | —                                                                                                          | `{ filename, csv }`                                                                                                                                             | `people:members:write`                                      |
| `people.admins.end`                | mutation | `{ personId, reason }`                                                                                     | `void`                                                                                                                                                          | `people:write`                                              |
| `people.admins.setCapoScope`       | mutation | `{ personId, scope: string \| null }`                                                                      | `void`                                                                                                                                                          | `people:appoint`                                            |
| `people.admins.setCapoOfReference` | mutation | `{ personId, capoId: PersonId \| null }`                                                                   | `void`                                                                                                                                                          | `people:write`                                              |
| `people.teams.list`                | query    | —                                                                                                          | `{ id, name, lead, members: (PersonSummary & { membership: TeamMembership; phone: string \| null })[] }[]`                                                      | `people:read`, or Lead of that team (only their team)       |
| `people.teams.candidates`          | query    | `{ teamId }`                                                                                               | `{ id, name, course }[]`: people not active in the team, for Add to team                                                                                        | `people:read`, or Lead of that team                         |
| `people.teams.addMember`           | mutation | `{ teamId, personId, role, since, fields }`                                                                | `void`                                                                                                                                                          | `people:write` or Lead (role `lead` needs `people:appoint`) |
| `people.teams.updateFields`        | mutation | `{ teamId, personId, fields }`                                                                             | `void`                                                                                                                                                          | `people:write` or Lead                                      |
| `people.teams.endMembership`       | mutation | `{ teamId, personId, lastDay, reason, note? }`                                                             | `void`                                                                                                                                                          | `people:write` or Lead                                      |
| `people.census.campaigns`          | query    | —                                                                                                          | `{ id, year, status: "open" \| "closed", openedOn, closesOn, expected, continuing, leaving, noAnswer }[]`                                                       | `people:read`                                               |
| `people.census.campaign`           | query    | `{ id }`                                                                                                   | campaign + `PersonSummary[]` with that year's `CensusEntry`                                                                                                     | `people:read`                                               |
| `people.census.answers`            | query    | `{ personId, year }`                                                                                       | `{ question, answer }[]`                                                                                                                                        | `people:read`                                               |
| `people.census.remind`             | mutation | `{ campaignId, personId? }`                                                                                | `{ sent, skipped }` (skips reminded < 3 days)                                                                                                                   | `people:write`                                              |
| `people.census.close`              | mutation | `{ campaignId }`                                                                                           | `void`                                                                                                                                                          | `people:write`                                              |
| `people.census.importPreview`      | mutation | `FormData` (`campaignId`, `file` .xlsx/.csv)                                                               | `ImportPreview`                                                                                                                                                 | `people:write`                                              |
| `people.census.importCommit`       | mutation | `{ importId, duplicates: Record<pairId, "same" \| "different">, telegram: Record<rowId, string \| null> }` | `{ imported }`                                                                                                                                                  | `people:write`                                              |
| `people.linking.reviews`           | query    | —                                                                                                          | `Review[]`                                                                                                                                                      | `people:read`                                               |
| `people.linking.resolve`           | mutation | `{ reviewId, resolution, reason }`                                                                         | `void`                                                                                                                                                          | `people:write`                                              |
| `people.linking.dismiss`           | mutation | `{ reviewId }`                                                                                             | `void`                                                                                                                                                          | `people:write`                                              |
| `people.linking.invites`           | query    | —                                                                                                          | `{ personId, name, email, sentOn, expiresOn, sentBy }[]`                                                                                                        | `people:read`                                               |
| `people.linking.sendInvite`        | mutation | `{ personId }` (sends or resends; the old link stops working)                                              | `void`                                                                                                                                                          | `people:write`                                              |
| `people.linking.revokeInvite`      | mutation | `{ personId }`                                                                                             | `void`                                                                                                                                                          | `people:write`                                              |
| `people.linking.searchAccounts`    | query    | `{ personId, query }`                                                                                      | `{ id, name, email, telegram, via, linkedTo: { id, name } \| null, reason: "same-telegram" \| "same-email" \| "similar-name" }[]`                               | `people:write`                                              |
| `people.linking.link`              | mutation | `{ personId, accountId, reason }` (fails `CONFLICT` when the account is linked elsewhere)                  | `void`                                                                                                                                                          | `people:write`                                              |
| `people.linking.unlink`            | mutation | `{ personId }`                                                                                             | `void`                                                                                                                                                          | `people:write`                                              |
| `people.capo.get`                  | query    | —                                                                                                          | `{ scope, groups: { chatId, title, admins: number }[], admins: (PersonSummary & { phone: string \| null })[], requests: { id, person, group, requestedOn }[] }` | Capo Admin (scope from record)                              |
| `people.capo.approve` / `.decline` | mutation | `{ requestId }`                                                                                            | `void`                                                                                                                                                          | Capo Admin of that group                                    |
| `people.me.get`                    | query    | —                                                                                                          | `MyArea` (below)                                                                                                                                                | `people:self`                                               |
| `people.me.confirmMatch`           | mutation | —                                                                                                          | `void`                                                                                                                                                          | `people:self`                                               |
| `people.me.rejectMatch`            | mutation | —                                                                                                          | `void` (creates a Needs review item)                                                                                                                            | `people:self`                                               |
| `people.me.askToBeAdded`           | mutation | `{ roles: string[], groupsOrTeam?, telegramUsername? }`                                                    | `void`                                                                                                                                                          | `people:self`                                               |
| `people.me.answerCensus`           | mutation | `{ answer, course, year, campus, keepGroups: string[], keepTeams: TeamId[], reason?, note? }`              | `void`                                                                                                                                                          | `people:self`                                               |
| `people.me.requestCorrection`      | mutation | `{ field, value, note? }`                                                                                  | `void`                                                                                                                                                          | `people:self`                                               |
| `people.me.revokePhotoConsent`     | mutation | —                                                                                                          | `void`                                                                                                                                                          | `people:self`                                               |

```ts
type Review = {
  id: string
  kind: "telegram-conflict" | "ask-to-be-added" | "two-records" | "not-me" | "name-only"
  since: string
  account: { name: string; email: string; telegram: string | null; via: string }
  record: { id: PersonId; name: string } | null
  other: { id: PersonId; name: string } | null
  message: string | null
}

type ImportPreview = {
  importId: string
  fileName: string
  rows: number
  counts: {
    newPeople: number
    updates: number
    duplicates: number
    invalid: number
    discrepancies: number
    alreadyImported: number
    leaving: number
  }
  tabs: Record<
    "newPeople" | "updates" | "duplicates" | "invalid" | "discrepancies" | "alreadyImported",
    { row: number; name: string; detail: string; answer: CensusAnswer | null }[]
  >
  duplicates: {
    pairId: string
    row: number
    file: Record<string, string>
    record: { id: PersonId } & Record<string, string>
  }[]
  telegram: {
    rowId: string
    name: string
    username: string
    suggestion: { telegramId: string; name: string; info: string } | null
  }[]
}

type MyArea =
  | {
      state: "linked"
      person: PersonRecord
      campaign: { year: string; closesOn: string; entry: CensusEntry } | null
      contacts: {
        role: "capo" | "lead" | "hr"
        name: string
        telegram: string | null
        email: string | null
        team?: TeamId
      }[]
      roster: {
        team: TeamId
        members: { name: string; role: TeamRole; telegram: string | null; email: string | null }[]
      } | null
    }
  | {
      state: "match"
      candidate: { id: PersonId; name: string; course: string; year: string; campus: Campus; roles: string[] }
      reason: string
    }
  | { state: "none"; request: { sentOn: string } | null }
```

## Permissions

New IdP permissions (add to `src/server/permissions.ts`): `people:self`, `people:read`, `people:write`,
`people:members:read`, `people:members:write`, `people:appoint`. Capo Admin and Team Lead are not permissions: they
come from the signed-in person's record (`people.me.get`), and the backend scopes `people.capo.*` and team writes to
them.

## Backend rules

The dashboard checks these too, but the backend owns them (from the security review of PR 97):

- **`admin:access`**: every `people.*` procedure except `people.me.*`, `people.capo.*` and the team procedures needs it on
  top of the permission in the table. `people:self` alone reaches only My area, Capo Admin and the caller's own team. For team procedures, the general
  `people:read`/`people:write` branch requires `admin:access`; otherwise require `people:self` and an active, confirmed
  Lead role over the requested team. A stray general permission without `admin:access` never widens team access.
- **Member details**: `member` (number, status, fee, admission date, Microsoft 365 address) needs
  `people:members:read`, except on the caller's own record. Without it `member` is `null` and only `isMember` says
  whether the person is a current member, in every procedure that returns people.
- **Unconfirmed match**: while the signed-in account is only a `match` candidate (not confirmed, or rejected), it acts as
  a person with no record: no team, no Capo Admin scope, no census answer or correction on the candidate's record. Only
  `people.me.get`, `confirmMatch` and `rejectMatch` see the candidate.
- **`people.capo.approve` / `.decline`**: only requests for groups in the caller's own Capo Admin scope; anything else
  answers as already handled, so request IDs of other scopes leak nothing.
- **`people.teams.endMembership`**: ending a lead's membership needs `people:appoint`, like appointing one.
- **`people.members.export`**: every CSV cell is quoted, and a cell starting with `=`, `+`, `-`, `@`, tab or carriage
  return gets a leading `'`, so spreadsheets don't run it as a formula.
- **`people.census.importPreview`**: check the content, not the extension: a real .xlsx (ZIP) or UTF-8 CSV, at most
  10 MB uploaded, 50 MB decompressed, at most 1,000 ZIP entries and 5,000 response rows, and reject anything else
  before parsing.
- **Input limits**: the input schemas in `people.contract.ts` bound every string, array and record (team fields: at most
  10 keys of 40 characters, values of 200, lists of 20; import decisions: at most 5,000). Telegram usernames are empty or
  5–32 letters, digits and underscores, with an optional leading `@`. `requestCorrection.field` is one of
  `CORRECTION_FIELDS`.

Security review verification (PR #97): scope checks, unconfirmed matches, CSV escaping, ending Lead roles and member
redaction are exercised in `tests/people-access.test.mjs`; bounded input and binary/renamed/oversized imports in
`tests/people-input.test.mjs`. General People middleware starts from `adminMiddleware`; team exceptions follow the
rule above. BFF workbook checks inspect the ZIP directory; the backend must enforce actual decompression and parsed
row limits, not trust ZIP size declarations. The backend is pending, so these are requirements, not a production audit.

Input limits also cover opaque IDs (128 chars), review resolutions (64), emails (254), academic years (`YYYY/YY`)
requested roles (at most 3) and real ISO calendar dates (invalid days are rejected). Reject oversize requests before parsing; imports are bound to the caller, expire,
and may only commit decisions for rows/pairs in that caller's preview.
