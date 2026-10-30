# People area: backend contract

The dashboard calls these procedures under `people.*` on the tRPC backend (`@polinetwork/backend`). They do not exist
yet: this file is the spec for the backend project. **`src/features/people/people.contract.ts` is the source of
truth** for every shape and input (zod schemas); where this file differs, the code wins. In agent mode the dashboard
serves the same shapes from `src/features/people/people.fixtures.server.ts`.

Every procedure checks permissions server-side; the "Needs" column is the minimum. Dates are ISO `YYYY-MM-DD` strings
(`Europe/Rome`); timestamps ISO 8601.

> [!IMPORTANT]
> **Removed from the contract (#138).** Soci (the member register), fees and receipts, the census, record matching
> and Telegram group tracking are no longer part of People. The dashboard no longer calls `people.members.*`,
> `people.fees.*`, `people.receipts.*`, `people.census.*`, `people.linking.reviews` / `resolve` / `dismiss`,
> `people.capo.approve` / `decline`, or `people.me.confirmMatch` / `rejectMatch` / `answerCensus` /
> `requestCorrection` / `revokePhotoConsent` / `uploadTransferReceipt` / `receipt` / `askToBeAdded`, and the backend
> drops them in PoliNetworkOrg/backend#104 (issue PoliNetworkOrg/backend#100). The Member register, Receipts and Census pages stay as unconnected UI mockups with their
> own sample data (`src/features/people/mockup-data.ts`), to be rebuilt in Phase 2 (#144, Soci and fees on Microsoft
> 365 members) and Phase 3 (#145, the census).
>
> Until the backend cleanup deploys, the backend still sends `member`, `isMember`, `census`, `fees`, `admin.groups`,
> `admin.requested`, `capo.get`'s `groups` and `requests`, and in My area `feeInstructions`, `campaign`, the `none`
> state's `request` and the contacts' and roster's `email`. The dashboard's schemas strip unknown keys, so these are
> ignored, and nothing requires them. An account in `review` reads as `none`, and a My area `match` as `none`.

## Shared types

```ts
type PersonId = string // "P-0142"
type AccountStatus = "none" | "invite" | "linked"
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

// Every list row: the record without notes, discrepancies and activity.
type PersonRow = Omit<PersonRecord, "notes" | "discrepancies" | "activity">

type PersonRecord = {
  id: PersonId
  profile: Profile
  admin: AdminRole | null
  teams: TeamMembership[]
  consents: {
    privacy: { version: string; acceptedOn: string } | null
    photo: { status: "granted" | "denied" | "revoked"; on: string } | null
  }
  account: Account
  notes: string | null // null without people:read
  discrepancies: {
    kind: string // the dashboard acts on "telegram-mismatch" only
    message: string
    suggestedTelegram?: string
  }[]
  activity: { actor: string; text: string; at: string }[]
}
```

Team fields (`TEAM_FIELDS`): `it` → `github` (text), `areas` (Frontend, Backend, Bot, Infrastructure); `design` →
`tools` (Figma, Illustrator, Photoshop, After Effects, InDesign, Premiere), `portfolio` (URL); `hr` and `events` →
`focus` (multi); `intl` → `languages` (multi).

## Procedures

| Procedure                          | Kind     | Input                                                                                                   | Output                                                                                                                            | Needs                                                       |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `people.persons.list`              | query    | —                                                                                                       | `PersonRow[]`                                                                                                                     | `people:read`                                               |
| `people.persons.get`               | query    | `{ id }`                                                                                                | `PersonRecord`                                                                                                                    | `people:read`                                               |
| `people.persons.create`            | mutation | `Profile` fields + `{ admin: boolean }`                                                                 | `{ id }`                                                                                                                          | `people:write`                                              |
| `people.persons.update`            | mutation | `{ id } & Partial<Profile>`                                                                             | `void`                                                                                                                            | `people:write`                                              |
| `people.persons.setNote`           | mutation | `{ id, note: string }` (empty string clears the note)                                                   | `void`                                                                                                                            | `people:write`                                              |
| `people.admins.end`                | mutation | `{ personId, reason }`                                                                                  | `void`                                                                                                                            | `people:write`                                              |
| `people.admins.setCapoScope`       | mutation | `{ personId, scope: string \| null }`                                                                   | `void`                                                                                                                            | `people:appoint`                                            |
| `people.admins.setCapoOfReference` | mutation | `{ personId, capoId: PersonId \| null }`                                                                | `void`                                                                                                                            | `people:write`                                              |
| `people.teams.list`                | query    | —                                                                                                       | `{ id, name, lead, members: PersonRow[] }[]` (members include ended memberships)                                                  | `people:read`, or Lead of that team (only their team)       |
| `people.teams.candidates`          | query    | `{ teamId }`                                                                                            | `{ id, name, course }[]`: people not active in the team, for Add to team                                                          | `people:read`, or Lead of that team                         |
| `people.teams.addMember`           | mutation | `{ teamId, personId, role, since, fields }`                                                             | `void`                                                                                                                            | `people:write` or Lead (role `lead` needs `people:appoint`) |
| `people.teams.updateFields`        | mutation | `{ teamId, personId, fields }`                                                                          | `void`                                                                                                                            | `people:write` or Lead                                      |
| `people.teams.endMembership`       | mutation | `{ teamId, personId, lastDay, reason, note? }`                                                          | `void`                                                                                                                            | `people:write` or Lead                                      |
| `people.linking.invites`           | query    | —                                                                                                       | `{ personId, name, email, sentOn, expiresOn, sentBy }[]`                                                                          | `people:read`                                               |
| `people.linking.sendInvite`        | mutation | `{ personId }` (sends or resends; the old link stops working)                                           | `void`                                                                                                                            | `people:write`                                              |
| `people.linking.revokeInvite`      | mutation | `{ personId }`                                                                                          | `void`                                                                                                                            | `people:write`                                              |
| `people.linking.searchAccounts`    | query    | `{ personId, query }`                                                                                   | `{ id, name, email, telegram, via, linkedTo: { id, name } \| null, reason: "same-telegram" \| "same-email" \| "similar-name" }[]` | `people:write`                                              |
| `people.linking.link`              | mutation | `{ personId, accountId, reason }` (fails `CONFLICT` when the account is linked elsewhere)               | `void`                                                                                                                            | `people:write`                                              |
| `people.linking.unlink`            | mutation | `{ personId }`                                                                                          | `void`                                                                                                                            | `people:write`                                              |
| `people.capo.get`                  | query    | —                                                                                                       | `{ scope, admins: PersonRow[] }` (active admins whose Capo Admin of reference is the caller)                                      | Capo Admin (scope from record)                              |
| `people.me.get`                    | query    | —                                                                                                       | `MyArea` (below)                                                                                                                  | `people:self`                                               |
| `people.me.roles`                  | query    | —                                                                                                       | `{ capoScope: string \| null, leads: TeamId[] }` (caller's Capo Admin scope and led teams for navigation)                         | `people:self`                                               |
| `people.me.acceptInvite`           | mutation | `{ token }` (43-character base64url, from the invite link `/dashboard/account/me?peopleInvite=<token>`) | `void` (links the caller's account to the invited record)                                                                         | `people:self`                                               |

```ts
type MyArea =
  | {
      state: "linked"
      person: PersonRecord
      contacts: {
        role: "capo" | "lead" | "hr"
        name: string
        telegram: string | null
        team?: TeamId
      }[]
      roster: {
        team: TeamId
        members: {
          name: string
          role: TeamRole
          telegram: string | null
        }[]
      } | null
    }
  | { state: "none" }
```

## Permissions

IdP permissions (in `src/server/permissions.ts`): `people:self`, `people:read`, `people:write` and `people:appoint`.
`people:members:read`, `people:members:write`, `people:fees:write` and `people:receipts:sign` are gone with Soci, fees
and receipts (#138, deleted from the IdP in PoliNetworkOrg/auth#77). Capo Admin and Team Lead are not permissions:
they come from the signed-in person's record (`people.me.get`), and the backend scopes `people.capo.get` and team
writes to them.

## Backend rules

The dashboard checks these too, but the backend owns them (from the security review of PR 97):

- **`admin:access`**: every `people.*` procedure except `people.me.*`, `people.capo.*` and the team procedures needs it on
  top of the permission in the table. `people:self` alone reaches only My area, Capo Admin and the caller's own team. For team procedures, the general
  `people:read`/`people:write` branch requires `admin:access`; otherwise require `people:self` and an active, confirmed
  Lead role over the requested team. A stray general permission without `admin:access` never widens team access.
- **`people.teams.list`**: a Lead without `people:read` gets contacts (phone, personal email) only for the team's
  current members; former members come back without them.
- **`people.teams.endMembership`**: ending a lead's membership needs `people:appoint`, like appointing one. A team has at most one Lead:
  `people.teams.addMember` with `role: "lead"` fails `CONFLICT` while another Lead's appointment is open.
- **`people.admins.end`**: ending a Capo Admin's admin role also ends the scope, so it needs `people:appoint` too.
- **`people.me.acceptInvite`**: the token alone identifies the invited record (store it hashed); it fails while the
  invite is revoked, expired or already used, or when the caller already has a linked record.
- **Input limits**: the input schemas in `people.contract.ts` bound every string, array and record (team fields: at most
  10 keys of 40 characters, values of 200, lists of 20). Telegram usernames are empty or 5–32 letters, digits and
  underscores, with an optional leading `@`.

Security review verification (PR #97): scope checks, the Capo Admin area and ending Lead roles are exercised in
`tests/people-access.test.mjs`; bounded input and parsing of the current backend's legacy fields in
`tests/people-input.test.mjs`. General People middleware starts from `adminMiddleware`; team exceptions follow the
rule above.

Input limits also cover opaque IDs (128 chars), emails (254) and real ISO calendar dates
(invalid days are rejected). Reject oversize requests before parsing.
