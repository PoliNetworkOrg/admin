# People account linking: simplification plan

Status: implemented (milestones 1–5). Scope: auth#73, backend#99 and this PR (admin#136). Splitting the rest of the backend's
`src/people/service.ts` is a separate, later proposal (milestone 6).

## 1. Problem

A People record (backend register) points to a PoliNetwork Auth account through `accountSub`. Six paths create that
link, and the rule "is this account the same person as this record?" is written three times with different inputs:

| Where                                   | Used for                        | Compares                                                                                 |
| --------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| Auth `people-registration-matching.ts`  | preliminary persons             | declared email/Telegram ID/username vs verified app email, Telegram ID and username      |
| backend `candidate()` in `service.ts`   | "Is this you?" at first sign-in | record personal email and Telegram ID vs account email (`emailVerified`) and Telegram ID |
| backend `syncDirectory()` in `roles.ts` | automatic link of role holders  | Microsoft 365 object ID, Telegram ID, `@polinetwork.org` address                         |

Consequences found while verifying the current PRs:

- **Email matching never works in production.** The backend reads accounts from `/api/internal/esign-users`, which
  sends no `emailVerified`; `people/index.ts` turns the missing field into `false`. "Is this you?" by email and the
  "two records" review are dead code against real Auth.
- The three rules drifted: the duplicate name-only review and the username gap came from this.
- The backend reads accounts twice: `esign-users` plus the access snapshot for Telegram IDs (`options.directory`), and
  `people-roles` for roles and preliminary persons (`peopleRoles.directory`).
- Policy is inconsistent. A declared Telegram ID on a preliminary person only produces a proposal for a Master Admin;
  the same declared ID on an older record (typed by HR, or picked by username during a census import) links a role
  holder automatically, or lets the person self-confirm a record that carries roles (Auth then refuses the self-grant
  and the roles land in review).
- Linking code is spread over `service.ts` (lines ~480–640, ~1260–1500, ~1500–1640) and `roles.ts`.

## 2. Goals and non-goals

Goals:

1. One identity-matching rule, in one pure module, with one table of evidence and outcomes.
2. One account feed from Auth carrying verified identity per account.
3. All linking paths in one backend module; `service.ts` only authorizes and delegates.
4. Every path keeps its current user-visible flow unless listed in §5 "Behaviour changes".
5. A written model (this file) that matches the code.

Non-goals (this round):

- Existing review kinds and resolutions stay as they are. One kind is added, `identity-match` (resolutions
  `link-anyway`, `decline`), for matches HR approves on records that are not preliminary: D1, D2 and username
  matches. Merging all kinds into one is possible later.
- No change to how Auth stores preliminary persons, approves links or transfers roles.
- No split of fees, receipts, census, teams or members out of `service.ts` (milestone 6, separate PR).

## 3. Ownership

- **Auth** owns accounts, verified evidence, roles, preliminary persons and the approval of a preliminary link
  (Master Admin, enforced by Auth).
- **The backend register** owns People records and the `accountSub` link of records it created.
- **Matching** lives in the backend, next to the records it compares. Auth cannot match older records without the
  backend sending them their contacts, which would copy register data into Auth. Rejected for that reason.

## 4. Design

### 4.1 One account feed

`GET /api/internal/people-roles` returns every login account (preliminary subjects are reported as today), each with:

| Field                            | Meaning                                               |
| -------------------------------- | ----------------------------------------------------- |
| `sub`, `name`                    | Auth subject and display name                         |
| `email`                          | contact address for display (as today)                |
| `verifiedEmail`                  | the app email when verified (`appEmail`), else `null` |
| `azureId`                        | PoliNetwork Microsoft 365 object ID                   |
| `telegramId`, `telegramUsername` | from Telegram sign-in evidence                        |
| `roles`, `assigned`, `since`     | bound roles (as today)                                |

`proposals` and `people-registration-matching.ts` are removed from Auth. The backend stops calling `esign-users` for
People (e-signing keeps using it) and reads only this feed, through the existing cached `readDirectory()`.

### 4.2 One matching rule — `src/people/identity.ts` (pure, no I/O)

Evidence on the account side is verified by Auth. Evidence on the record side is declared (HR, census, preliminary
person) except `azureId` and `m365Email`, which come from Microsoft 365.

```ts
type Strength = "verified" | "username" | "name"
matchAccount(records: Person[], account: Account): Match
// Match = { kind: "none" } | { kind: "one", person, strength } | { kind: "conflict", persons }
```

Rules, in order; the first tier with a hit decides:

1. **verified**: `azureId` equal; or `verifiedEmail` equal to the record's `personalEmail` or `m365Email`; or account
   `telegramId` equal to the record's `telegramId`.
2. **username**: Telegram username equal (case-insensitive, without `@`).
3. **name**: full name equal.

Conflict: more than one record in the deciding tier; or the single record carries a different `telegramId` or
`azureId` than the account. Records already linked to another account, and records the account holder rejected, are
excluded.

### 4.3 One outcome policy

| Match                                                  | Record                      | Outcome                                                                                         |
| ------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------- |
| verified, one                                          | preliminary person          | `preliminary-link` review; the person sees "awaiting approval"; Master Admin approves in Auth   |
| verified, one                                          | no account, grants no roles | "Is this you?": the person confirms                                                             |
| verified, one                                          | no account, carries roles   | `identity-match` review: HR links and the roles are granted in one step (D1)                    |
| verified (Microsoft 365 ID or `@polinetwork.org`), one | account holds a bound role  | automatic link (as today)                                                                       |
| verified (Telegram ID only), one                       | account holds a bound role  | `identity-match` review, no automatic link (D2)                                                 |
| username, one                                          | any                         | `identity-match` (`preliminary-link` for a preliminary person); the person sees "being checked" |
| name, one                                              | any                         | `name-only` review; nothing shown to the person                                                 |
| conflict                                               | any                         | `two-records` / `telegram-conflict` review                                                      |

### 4.4 One linking module — `src/people/linking.ts`

Functions over `PeopleState` with explicit inputs, shared by every path:

- `accountsOf(directory)`: Auth's login accounts, the only account source (`esign-users` is for e-signing only).
- `decide(match, account)` / `decideFor(state, account)`: the policy table above.
- `openReview` / `reviewFor`: open a review or reuse the open one for the same account, kind and record, recording
  what the account holder may see (`shown`: record, notice or hidden).
- `attachAccount`: the only place a record gets an account in People; refuses an account or record already taken.
- `signInState(state, account)`: `match`, `awaiting` or `none` for My area.
- `reconcilePreliminary(state, accounts)`: matches accounts against preliminary persons whenever Auth's directory
  changes, since their holder may never open My area, and closes reviews that no longer apply.

In `service.ts`, `linkRecord` is the one entry point the procedures call: it asks Auth to link a preliminary person
(`peopleRoles.link`), otherwise uses `attachAccount` and sends the record's roles to Auth. Review resolution, invites,
search and unlinking stay procedures in `service.ts` and go through it. `syncDirectory` (`roles.ts`) refreshes
linked records and, for role holders without one, follows `decideFor`.

## 5. Behaviour changes

1. Email "Is this you?" and the `two-records` review start working against real Auth.
2. Preliminary matching moves from Auth to the backend: same outcomes, one rule.
3. A conflict or a username match tells the account holder they are being checked instead of "not on the lists".
4. A role holder whose only match is a username, a name or a preliminary person waits for the review instead of
   getting a new empty record next to it. Ambiguous username or name matches (several records) match nobody.
5. A record that carries roles is no longer self-confirmed: "Is this you?" is offered only for records that grant
   nothing; otherwise HR approves (D1).
6. A role holder is linked automatically only by a Microsoft 365 identity; a Telegram ID match becomes an HR review
   (D2).

## 6. Verification

- `identity.test.ts`: one case per row of §4.2 and per conflict, including preliminary persons, rejected and already
  linked records, `@`/case in usernames.
- Linking service tests: one per path (automatic, "Is this you?" yes/no, invite, HR link and unlink, each review
  resolution, preliminary approval and refusal, ask to be added while awaiting), and the D1/D2 outcomes.
- Regression: an Auth feed with a verified email produces "Is this you?" (fails today).
- Auth: `people-roles` integration test asserts `verifiedEmail`, `telegramUsername` and that every login account is
  listed; preliminary subjects keep their fields.
- All existing suites green: Auth (`vp check`, `vp test` with PostgreSQL), backend (`bun run test` with PostgreSQL,
  typecheck, biome), dashboard (`vp check`, typecheck, tests, build).

## 7. Roadmap

1. **Auth feed (auth#73).** Add `verifiedEmail`, list every login account, drop `proposals` and the matching module;
   update its tests and README. Done when the integration test passes and no backend contract field is removed
   without milestone 3.
2. **Matching module (backend#99).** `identity.ts` with the table-driven tests; no caller yet.
3. **Linking module (backend#99).** Move the paths into `linking.ts`; switch People to the single feed; delete
   `candidate()`, the proposal loop in `applySources` and the matching filter in `syncDirectory`. Done when every
   existing People test passes unchanged and `options.directory` is no longer used by People.
4. **Policy (backend#99).** Apply D1 and D2 with their tests.
5. **Dashboard and docs (admin#136).** Add the `identity-match` kind to the contract, the Linking page and agent mode; update `pre-registration.md` and
   this file to "implemented".
6. **Later, separate PR (with the People maintainers).** Split `service.ts` by domain: census and import, fees,
   receipts and e-signing, teams, members.

## 8. Decisions

- **D1 (decided 2026-10-28).** A record that carries roles, with a verified match and no account, goes to an HR review
  that links and grants in one step. Self-confirmation is only for records that grant nothing.
- **D2 (decided 2026-10-28).** Automatic linking of a role holder uses only Microsoft 365 identities (object ID or
  `@polinetwork.org` address). A Telegram ID match becomes an HR review.

No open decisions remain.
