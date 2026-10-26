# People area: backend contract

The dashboard calls these procedures under `people.*` on the tRPC backend (`@polinetwork/backend`). They do not exist
yet: this file is the spec for the backend project. **`src/features/people/people.contract.ts` is the source of
truth** for every shape and input (zod schemas); where this file differs, the code wins. In agent mode the dashboard
serves the same shapes from `src/features/people/people.fixtures.server.ts`.

Every procedure checks permissions server-side; the "Needs" column is the minimum. Dates are ISO `YYYY-MM-DD` strings
(`Europe/Rome`); timestamps ISO 8601. Academic years are strings like `"2026/27"` and start on 1 September: the
dashboard labels the current census and fee year from today's date (`currentYear()` in `people-format.ts`).

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
  course: string // "" until known
  year: string // "2nd year", "1st year MSc", "Graduated"; "" until known
  campus: Campus | null // null until known: records created from PoliNetwork Auth or Microsoft 365
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
  | {
      status: "invite"
      email: string
      sentOn: string
      expiresOn: string
      sentBy: string
    }
  | {
      status: "linked"
      email: string
      via: string
      linkedOn: string
      how: string
    }
  | { status: "review"; reviewId: string; issue: string }

// Every list row: the record without notes, discrepancies and activity.
type PersonRow = Omit<PersonRecord, "notes" | "discrepancies" | "activity">

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
    kind: "declared-member" | "telegram-mismatch" | "needs-review" | "admin-removal"
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

| Procedure                          | Kind     | Input                                                                                                      | Output                                                                                                                            | Needs                                                       |
| ---------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `people.persons.list`              | query    | —                                                                                                          | `PersonRow[]`                                                                                                                     | `people:read`                                               |
| `people.persons.get`               | query    | `{ id }`                                                                                                   | `PersonRecord`                                                                                                                    | `people:read`                                               |
| `people.persons.create`            | mutation | `Profile` fields + `{ admin: boolean }`                                                                    | `{ id }`                                                                                                                          | `people:write`                                              |
| `people.persons.update`            | mutation | `{ id } & Partial<Profile>`                                                                                | `void`                                                                                                                            | `people:write`                                              |
| `people.persons.setNote`           | mutation | `{ id, note: string }` (empty string clears the note)                                                      | `void`                                                                                                                            | `people:write`                                              |
| `people.members.create`            | mutation | `{ personId, number, admittedOn, fee }`                                                                    | `void`                                                                                                                            | `people:members:write`                                      |
| `people.members.setStatus`         | mutation | `{ personId, status, reason? }`                                                                            | `void`                                                                                                                            | `people:members:write`                                      |
| `people.members.setNumber`         | mutation | `{ personId, number }`                                                                                     | `void` (also updates the M365 member ID)                                                                                          | `people:members:write`                                      |
| `people.members.export`            | mutation | —                                                                                                          | `{ filename, csv }`                                                                                                               | `people:members:write`                                      |
| `people.members.list`              | query    | —                                                                                                          | `MemberRegisterRow[]`                                                                                                             | `people:members:read`                                       |
| `people.admins.end`                | mutation | `{ personId, reason }`                                                                                     | `void`                                                                                                                            | `people:write`                                              |
| `people.admins.setCapoScope`       | mutation | `{ personId, scope: string \| null }`                                                                      | `void`                                                                                                                            | `people:appoint`                                            |
| `people.admins.setCapoOfReference` | mutation | `{ personId, capoId: PersonId \| null }`                                                                   | `void`                                                                                                                            | `people:write`                                              |
| `people.teams.list`                | query    | —                                                                                                          | `{ id, name, lead, members: PersonRow[] }[]` (members include ended memberships)                                                  | `people:read`, or Lead of that team (only their team)       |
| `people.teams.candidates`          | query    | `{ teamId }`                                                                                               | `{ id, name, course }[]`: people not active in the team, for Add to team                                                          | `people:read`, or Lead of that team                         |
| `people.teams.addMember`           | mutation | `{ teamId, personId, role, since, fields }`                                                                | `void`                                                                                                                            | `people:write` or Lead (role `lead` needs `people:appoint`) |
| `people.teams.updateFields`        | mutation | `{ teamId, personId, fields }`                                                                             | `void`                                                                                                                            | `people:write` or Lead                                      |
| `people.teams.endMembership`       | mutation | `{ teamId, personId, lastDay, reason, note? }`                                                             | `void`                                                                                                                            | `people:write` or Lead                                      |
| `people.census.campaigns`          | query    | —                                                                                                          | `{ id, year, status: "open" \| "closed", openedOn, closesOn, expected, continuing, leaving, noAnswer }[]`                         | `people:read`                                               |
| `people.census.campaign`           | query    | `{ id }`                                                                                                   | `{ campaign, people: PersonRow[] }`                                                                                               | `people:read`                                               |
| `people.census.answers`            | query    | `{ personId, year }`                                                                                       | `{ question, answer }[]`                                                                                                          | `people:read`                                               |
| `people.census.remind`             | mutation | `{ campaignId, personId: PersonId \| null }` (`null` reminds everyone)                                     | `{ sent, skipped }` (skips reminded < 3 days)                                                                                     | `people:write`                                              |
| `people.census.close`              | mutation | `{ campaignId }`                                                                                           | `void`                                                                                                                            | `people:write`                                              |
| `people.census.importPreview`      | mutation | `FormData` (`campaignId`, `file` .xlsx/.csv)                                                               | `ImportPreview`                                                                                                                   | `people:write`                                              |
| `people.census.importCommit`       | mutation | `{ importId, duplicates: Record<pairId, "same" \| "different">, telegram: Record<rowId, string \| null> }` | `{ imported }`                                                                                                                    | `people:write`                                              |
| `people.linking.reviews`           | query    | —                                                                                                          | `Review[]`                                                                                                                        | `people:read`                                               |
| `people.linking.resolve`           | mutation | `{ reviewId, resolution, reason }`                                                                         | `void`                                                                                                                            | `people:write`                                              |
| `people.linking.dismiss`           | mutation | `{ reviewId }`                                                                                             | `void`                                                                                                                            | `people:write`                                              |
| `people.linking.invites`           | query    | —                                                                                                          | `{ personId, name, email, sentOn, expiresOn, sentBy }[]`                                                                          | `people:read`                                               |
| `people.linking.sendInvite`        | mutation | `{ personId }` (sends or resends; the old link stops working)                                              | `void`                                                                                                                            | `people:write`                                              |
| `people.linking.revokeInvite`      | mutation | `{ personId }`                                                                                             | `void`                                                                                                                            | `people:write`                                              |
| `people.linking.searchAccounts`    | query    | `{ personId, query }`                                                                                      | `{ id, name, email, telegram, via, linkedTo: { id, name } \| null, reason: "same-telegram" \| "same-email" \| "similar-name" }[]` | `people:write`                                              |
| `people.linking.link`              | mutation | `{ personId, accountId, reason }` (fails `CONFLICT` when the account is linked elsewhere)                  | `void`                                                                                                                            | `people:write`                                              |
| `people.linking.unlink`            | mutation | `{ personId }`                                                                                             | `void`                                                                                                                            | `people:write`                                              |
| `people.capo.get`                  | query    | —                                                                                                          | `{ scope, admins: PersonRow[] }`                                                                                                  | Capo Admin (scope from record)                              |
| `people.me.get`                    | query    | —                                                                                                          | `MyArea` (below)                                                                                                                  | `people:self`                                               |
| `people.me.roles`                  | query    | —                                                                                                          | `{ capoScope: string \| null, leads: TeamId[] }` (caller's Capo Admin scope and led teams for navigation)                         | `people:self`                                               |
| `people.me.confirmMatch`           | mutation | —                                                                                                          | `void`                                                                                                                            | `people:self`                                               |
| `people.me.rejectMatch`            | mutation | —                                                                                                          | `void` (creates a Needs review item)                                                                                              | `people:self`                                               |
| `people.me.acceptInvite`           | mutation | `{ token }` (43-character base64url, from the invite link `/dashboard/account/me?peopleInvite=<token>`)    | `void` (links the caller's account to the invited record)                                                                         | `people:self`                                               |
| `people.me.askToBeAdded`           | mutation | `{ roles: string[], groupsOrTeam?, telegramUsername? }`                                                    | `void`                                                                                                                            | `people:self`                                               |
| `people.me.answerCensus`           | mutation | `{ answer, course, year, campus, keepTeams: TeamId[], reason?, note? }`                                    | `void` (`CONFLICT` once answered: the answer is final)                                                                            | `people:self`                                               |
| `people.me.requestCorrection`      | mutation | `{ field, value, note? }`                                                                                  | `void`                                                                                                                            | `people:self`                                               |
| `people.me.revokePhotoConsent`     | mutation | —                                                                                                          | `void`                                                                                                                            | `people:self`                                               |

```ts
type Review = {
  id: string
  kind: "telegram-conflict" | "ask-to-be-added" | "two-records" | "not-me" | "name-only"
  since: string
  account: {
    name: string
    email: string
    telegram: string | null
    via: string
  }
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
        members: {
          name: string
          role: TeamRole
          telegram: string | null
          email: string | null
        }[]
      } | null
    }
  | {
      state: "match"
      candidate: {
        id: PersonId
        name: string
        course: string
        year: string
        campus: Campus | null
        roles: string[]
      }
      reason: string
    }
  | { state: "none"; request: { sentOn: string } | null }
```

## Fees and receipts

The flow, screens and PDF template are in [`fees.md`](fees.md). `PersonRecord` gains `fees` (`null` for people who
were never members, or without `people:members:read` except on the caller's own record), and the linked `MyArea` gains
`feeInstructions` (bank details while the caller is a current member). Amounts are integer cents; files travel as
`{ fileName, contentType, base64 }`.

```ts
type FeeDetail = {
  year: string // "2026/27"
  status: FeeStatus // the same value as member.fee
  amountCents: number
  dueOn: string
  upload: {
    fileName: string
    size: number
    uploadedAt: string
    transferDate: string
    amountCents: number
  } | null
  rejection: { reason: string; by: string; at: string } | null // until the member uploads again
  payment: {
    paidOn: string
    method: "transfer" | "cash"
    amountCents: number
    transferDate: string | null
  } | null
  lastReminder: string | null
}

type Receipt = {
  id: string
  number: string // "2026/042", never reused
  year: string // fee year
  person: { id: PersonId; name: string }
  memberNumber: string
  amountCents: number
  issuedOn: string
  paidOn: string
  method: "transfer" | "cash"
  transferDate: string | null
  status: "toSign" | "signed" | "sent" | "failed" | "voided"
  signer: "president" | "vicePresident" // the Vice-president signs the President's own
  signedBy: string | null
  signedOn: string | null
  sentAt: string | null
  sentTo: string | null
  failure: string | null
  voided: { reason: string; by: string; on: string } | null
}

type Fees = { current: FeeDetail | null; receipts: Receipt[] } // newest first, voided included
```

| Procedure                           | Kind     | Input                                                                                             | Output                                                                                       | Needs                                 |
| ----------------------------------- | -------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------- |
| `people.fees.review`                | query    | `{ personId }`                                                                                    | `{ person, memberNumber, m365Email, fee: FeeDetail, rejections, nextReceipt }`               | `people:fees:write`                   |
| `people.fees.upload`                | query    | `{ personId }`                                                                                    | file: the uploaded transfer receipt                                                          | `people:fees:write`                   |
| `people.fees.approve`               | mutation | `{ personId }`                                                                                    | `{ receipt }` (the number issued)                                                            | `people:fees:write`                   |
| `people.fees.reject`                | mutation | `{ personId, reason }`                                                                            | `void` (fee back to Due, or Unpaid after the deadline)                                       | `people:fees:write`                   |
| `people.fees.markPaid`              | mutation | `{ personId, paidOn, amountCents, method, note }`                                                 | `{ receipt }`                                                                                | `people:fees:write`                   |
| `people.fees.remind`                | mutation | `{ personId: PersonId \| null }`                                                                  | `{ sent, skipped }` (all: Due and Unpaid, skips reminded < 3 days)                           | `people:fees:write`                   |
| `people.receipts.list`              | query    | `{ year: string \| null }` (null: current fee year)                                               | `{ year, years, viewerSigner, officers: { president, vicePresident }, receipts }`            | `people:members:read`                 |
| `people.receipts.download`          | query    | `{ receiptId }`                                                                                   | file: the signed copy once there is one, else the generated PDF                              | `people:members:read`                 |
| `people.receipts.prepareSignatures` | mutation | `{ receiptIds: string[] }` (1–10 distinct IDs)                                                    | `{ receiptId, requestId: UUID, title }[]`                                                    | `people:receipts:sign` + `esign:sign` |
| `people.receipts.toSign`            | mutation | —                                                                                                 | file: a ZIP of the receipts waiting for the caller's signature                               | `people:receipts:sign`                |
| `people.receipts.previewSigned`     | mutation | `FormData` (`files`: up to 100 PDF or .p7m, 10 MB each, 50 MB in all, names up to 200 characters) | `{ uploadId, files: { fileId, fileName, size, receiptId, signature: { valid, signer } }[] }` | `people:receipts:sign`                |
| `people.receipts.sendSigned`        | mutation | `{ uploadId, assignments: Record<fileId, receiptId> }`                                            | `{ sent, failed }`                                                                           | `people:receipts:sign`                |
| `people.receipts.retry`             | mutation | `{ receiptId }`                                                                                   | `void`                                                                                       | `people:fees:write`                   |
| `people.receipts.void`              | mutation | `{ receiptId, reason }`                                                                           | `void`                                                                                       | `people:fees:write`                   |
| `people.me.uploadTransferReceipt`   | mutation | `FormData` (`file` PDF/JPG/PNG ≤ 10 MB, `transferDate`, `amountCents`)                            | `void` (fee → Receipt uploaded; `CONFLICT` unless Due or Unpaid)                             | `people:self`                         |
| `people.me.receipt`                 | query    | `{ receiptId }`                                                                                   | file: one of the caller's own signed receipts                                                | `people:self`                         |

Backend rules for fees and receipts:

- **Officers**: the association's President and Vice-president are configuration on the backend (or a record field).
  `viewerSigner` is the caller's office, and only when they also hold `people:receipts:sign`. Every receipt's `signer`
  is `president`, except the President's own (`vicePresident`). `toSign`, `previewSigned` and `sendSigned` act only on
  receipts whose `signer` is the caller's office.
- **CIE preparation**: `prepareSignatures` requires `admin:access`, both signing permissions and the actual officer
  on the linked, confirmed People record. Validate the whole batch before creating anything: 1–10 distinct receipts,
  all `toSign`, all assigned to that officer. Return exactly those receipt IDs with distinct request IDs; an incomplete, duplicate or unrelated response is rejected. Resolve officer IdP subjects on the backend; the browser never chooses
  a signer, PDF, placement, recipient or output drive. Create or reuse one active eSign request per receipt/version
  under a uniqueness constraint; retries return the same requests. Use the issued PDF with its hash and fixed signature
  placement, the caller's office, and no separate eSign delivery (the receipt pipeline owns the email).
- **eSign provenance**: for requests created by this bridge, `esign.requests.list/get` return
  `request.peopleReceipt: { receiptId, number, year }` (list: each request has the field). Other requests omit it or
  return null; the dashboard accepts older responses without it. The title is `Receipt {number} · {member name}`.
  The association is backend-owned and cannot be supplied through generic eSign request creation. Signatures shows
  the receipt reference and links to `/dashboard/people/receipts?year={year}&q={number}` only for register readers.
- **Signing later from eSign**: jobs, manual signature uploads and completion recheck `people:receipts:sign`, the
  confirmed officer and current assignment/version, as well as `esign:sign`. Generic eSign permissions alone never
  authorize a receipt signature. `myTurn` reflects this eligibility. Reject placement changes for receipt requests:
  their issued signature box is fixed, including batch signing. Receipt requests cannot be generically deleted or
  cancelled; voiding through People owns invalidation and audit retention. eSign decline/failure leaves the receipt
  `toSign`; preparation reuses an active request or creates a replacement for the same receipt/version.
- **CIE completion**: bind the receipt to its eSign request persistently. The eSign completion transaction verifies
  the signature, officer, current receipt/version and `toSign` status, stores the signed PDF or `.p7m`, writes Activity and queues
  the receipt email exactly once. Cancellation or failure leaves the receipt `toSign` for retry or manual upload;
  voiding invalidates active eSign requests/jobs. A manual upload also completes or cancels the linked request/jobs.
  Use concurrency guards so an upload and CIE completion cannot replace each other's file or send twice. Completion
  and delivery must work with the browser closed, including requests signed later from Signatures › To sign. A
  receipt's active eSign request is system-owned: generic request deletion must not break receipt retention/audit.
- **Numbering**: per fee year, `YYYY/NNN` from the year's first calendar year; issued atomically, never reused, voided
  ones included.
- **Signatures**: verify each file for real (PAdES in the PDF or a CAdES `.p7m`), that the certificate is the officer's,
  and that the signed document is the receipt it is matched to. Refuse the whole send when any assignment points at an
  unsigned file, a receipt that isn't `toSign`, another officer's receipt, or the same receipt twice.
- **Email**: send the signed receipt to the member's Microsoft 365 address; on failure keep the receipt `failed` with
  the mail server's reason until Retry.
- **Reminders**: automatic ones go out 14 and 3 days before the deadline to members whose fee is Due; manual ones
  follow `people.fees.remind`. Each sets `lastReminder` and writes an activity line.
- **Uploads**: check the content, not the extension (PDF, JPEG or PNG; PDF or CMS for signed files), and the size.
- **Activity**: upload, approval, rejection (with the reason), Mark as paid (with the note), issue, signature, email,
  failure, retry, void and reminders each add a line to the person's activity.
- **Members** download only their own receipts, and only once signed (`signed`, `sent` or `failed`).

## Permissions

New IdP permissions (add to `src/server/permissions.ts`): `people:self`, `people:read`, `people:write`,
`people:members:read`, `people:members:write`, `people:appoint`, and for fees `people:fees:write` and
`people:receipts:sign`. Capo Admin and Team Lead are not permissions: they
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
- **`people.capo.get`**: requires an active Capo Admin role on the caller's confirmed record and returns only active
  admins who have that person as Capo of reference. Contacts exclude personal email and member details still require
  `people:members:read`. The response contains the scope and admins, with no Telegram group data.
- **`people.teams.list`**: a Lead without `people:read` gets contacts (phone, personal email) only for the team's
  current members; former members come back without them.
- **`people.teams.endMembership`**: ending a lead's membership needs `people:appoint`, like appointing one. A team has at most one Lead:
  `people.teams.addMember` with `role: "lead"` fails `CONFLICT` while another Lead's appointment is open.
- **`people.admins.end`**: ending a Capo Admin's admin role also ends the scope, so it needs `people:appoint` too.
- **`people.me.acceptInvite`**: the token alone identifies the invited record (store it hashed); it fails while the
  invite is revoked, expired or already used, or when the caller already has a linked record.
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

`people.members.create` admits an unregistered person only: refuse a record that already has a membership,
including a former membership. It must never overwrite a member number, account or fee history. Its initial fee is
`due` or `paid`; `receipt` requires an actual uploaded transfer receipt and cannot be selected at admission. `paid` issues a receipt, so it
also needs `people:fees:write`; without it the dashboard admits with the fee due.

### Census role changes

Team roles deselected in `people.me.answerCensus` end through PoliNetwork Auth. A leaving answer also ends the admin
role through Auth; a continuing answer keeps it. People does not track Telegram group assignments, requests to join
or pending group removals. Older records may still carry an `admin-removal` discrepancy, but no new ones are created.
