# People area: implementation plan

Work happens on branch `claude/eager-mayer-bsom7v` in one pull request. Tick a box in the same commit that finishes it,
and add a line to the progress log at the bottom. Each phase ends green on `pnpm check`, `pnpm typecheck`, `pnpm test`
and `pnpm build`, and is committed and pushed before the next one starts (Conventional Commits, see `AGENTS.md`).

Read first: `AGENTS.md`, `docs/design.md`, [`decisions.md`](decisions.md), [`contract.md`](contract.md). Look at the
prototype for structure and copy only (see decisions: it has visual errors; build from the primitives).

## Architecture

```
src/features/people/
  people.contract.ts          zod schemas + types from contract.md, team fields, labels
  people.fixtures.server.ts   seeded in-memory data (port of buildData() in the prototype)
  people.api.server.ts        peopleApi(context): the agent-mode fake, else the backend's people.* procedures, parsed
  people.fake.server.ts       agent-mode implementation of every procedure, with the backend's access rules
  people.functions.ts         read server functions (GET) per page
  people-write.functions.ts   person, admin, linking and account mutations (POST)
  people-members.functions.ts member register mutations and export
  people-teams.functions.ts   team reads and mutations (people:read/write or Team Lead)
  people-census.functions.ts  campaigns, reminders and the census import
  people-appoint.functions.ts Capo Admin appointments (people:appoint)
  people-self.functions.ts    My area reads and self-service mutations (people:self)
  people-capo.functions.ts    Capo Admin area and join-request approve/decline
  census-import.server.ts     server-side checks on the uploaded Forms export
  people-format.ts            display helpers (labels, years, roles)
  people-ui.tsx, people-hooks.ts  shared People components and hooks
  overview-page.tsx, person-page.tsx, members-page.tsx, admins-page.tsx, teams-page.tsx, census-page.tsx,
  import-wizard.tsx, linking-page.tsx, capo-page.tsx, my-area-page.tsx
  *-dialog.tsx, *-dialogs.tsx  person, notes, account, link, census answers, member, admin, team and My area dialogs
src/routes/dashboard/people/  index (overview), $personId, members, admins, teams/index, teams/$teamId,
                              census/index, census/$campaignId, linking
src/routes/dashboard/telegram/capo.tsx
src/routes/dashboard/account/  me.tsx (My area), index.tsx (Sign-in & security)
```

- The backend client type has no `people` router, so `people.api.server.ts` calls the procedures through an untyped
  client (`createUntypedBackendClient`) and parses every response with the contract's schemas. Nothing else talks to
  the backend's `people.*` procedures.
- Agent mode: `loadAccess` keeps returning every permission. Add a development-only `AGENT_PERMISSIONS` env (comma
  list) and `AGENT_PERSON` (person ID for My area) so restricted views can be previewed; document both in README.
- Access: `loadAccess` returns `authorized` when the user has `admin:access` **or** `people:self`. The route context
  carries permissions as today; `useCan` and nav filtering hide everything else. `adminMiddleware` stays as is for
  existing services; People reads use a new `peopleReadMiddleware` (`people:read`), and self-service functions use
  `peopleSelfMiddleware` (`people:self`). Overview (`/dashboard`) and every existing route must still require
  `admin:access`: add a guard so a `people:self`-only user is redirected to `/dashboard/account/me`.
- Tests: list every new `*.functions.ts` and each POST function with its consumer file, and every `useCan` file with
  its permission, in `tests/server-security.test.mjs` (the failing test names what to add).

## Phases

### 0. Handoff and PR

- [x] `docs/people/` (brief, decisions, contract, plan, prototype), draft PR opened

### 1. Foundation

- [x] Permissions: add the six `people:*` permissions; middlewares `peopleReadMiddleware`, `peopleWriteMiddleware`,
      `peopleTeamWriteMiddleware`, `peopleMembersReadMiddleware`, `peopleMembersWriteMiddleware`,
      `peopleAppointMiddleware`, `peopleSelfMiddleware` (all built on `dashboardUserMiddleware`)
- [x] Access: `people:self` admits to the dashboard; `adminMiddleware` requires `admin:access` explicitly; the
      `/dashboard` route redirects pages the user can't open (`canOpenPage`); `AGENT_PERMISSIONS` / `AGENT_PERSON`
- [x] `people.contract.ts` (zod; source of truth for shapes), `people.fixtures.server.ts`, `people.fake.server.ts`
      (agent-mode API), `people.api.server.ts` (`PeopleApi`; backend adapter through an untyped tRPC client whose
      responses are parsed with the contract)
- [x] Nav: People service and sections, Telegram › Capo Admin, Account as a two-section service (My area, Sign-in &
      security); `PageMatch` kinds and `matchPath`; `sectionVisible` filters by permission, `admin:access` and record
      role (Capo Admin, Team Lead); the logo and avatar lead to My area for `people:self`-only users
- [x] Route files for every page (placeholder component `PagePlaceholder` until each phase replaces it; add
      `pendingComponent` skeletons with the real pages)
- [x] Tests registry updated; all four checks green

### 2. Overview and person record

- [ ] Overview: DataTable with columns, filters (role, team, campus, account, census), search, count, pagination,
      Send invite + ⋮ row actions, empty states
- [x] Add person / Edit profile dialog (`FormDialog` lg)
- [ ] Person record: RecordHeader, discrepancy alerts, all cards, Activity; Send / resend invite, revoke, unlink
      confirmations; HR notes dialog; census answers dialog

### 3. Member register

- [x] Table, status segments, fee filter, sort by number/name/admitted
- [ ] Add member, Change status, Change member number, Export (confirm then download)

### 4. Admins

- [x] Table with priority columns, Active/Former, campus/year filters, the four quick filters
- [x] End admin role; set Capo Admin of reference; appoint Capo Admin (`people:appoint`)

### 5. Teams

- [x] Index cards + all-members table
- [x] Team page (Active/Former, team fields, contacts for Lead); Team Lead lands here from People › Teams
- [x] Add to team, Edit team fields, End membership

### 6. Census

- [x] Campaign list; campaign page with segments, reminders, close
- [x] Import wizard: upload, review tabs, duplicates, Telegram suggestions, confirm; re-import "Already imported"

### 7. Linking

- [x] Needs review queue with Dismiss / Resolve dialog per kind
- [x] Pending invites with Resend / Revoke and expired badge
- [x] Link account dialog with suggestions, required reason, inline conflict (built in phase 2)

### 8. Capo Admin

- [x] My groups, Requests to join (approve/decline), Admins of my groups with Telegram/WhatsApp links

### 9. My area

- [x] Linked: census card (confirm / leaving dialog), roles, contacts, profile + Request a correction, consents +
      revoke, team roster
- [x] First sign-in match ("Is this you?") and "This isn't me" state
- [x] No record: Ask to be added dialog and waiting state

### 10. Finish

- [ ] Loading and empty states checked on every page; mobile (390px) and dark checked on every page in agent mode
- [x] `docs/design.md` §8 page notes for People, Capo Admin, My area; README permissions table; `CLAUDE.md`
      architecture lines
- [x] PR description final, all checks green

### 11. Fees and receipts ([`fees.md`](fees.md))

- [x] Contract: `FeeDetail`, `Receipt`, `fees` on the record, `feeInstructions` in My area, the `people.fees.*`,
      `people.receipts.*` and two `people.me.*` procedures; permissions `people:fees:write`, `people:receipts:sign`
- [x] Agent mode: seeded fee years and receipts, review, Mark as paid, reminders, signing, email failure, void; the
      receipt PDF and the ZIP to sign (`receipt-files.server.ts`)
- [x] Member register: fee row actions, Send reminders, Export in ⋮; Review receipt and Mark as paid dialogs
- [x] People › Receipts with its panel count; Upload signed receipts; Void receipt; Retry sending
- [x] Person record Fees and receipts card; My area Membership fee card and Upload transfer receipt
- [ ] Backend: implement the procedures, the officers, automatic reminders, signature verification and email

## Progress log

Newest last. One line per commit or session: date, what was done, what is next.

- 2026-10-14: phase 0 done (handoff docs, prototype copy, draft PR). Next: phase 1.
- 2026-10-14: phase 1 done. Verified in agent mode: Direttivo reaches People; `AGENT_PERMISSIONS=people:self` with
  `AGENT_PERSON=P-0098` (Capo Admin) reaches only Telegram › Capo Admin and Account; with `P-0034` (IT Team Lead)
  only People › Teams and Account. Next: phase 2 (Overview and person record).
- 2026-10-14: phase 2 done: Overview, person record, Add/Edit person, account confirmations, Link account, HR notes,
  census answers. Mobile Overview cards show one line of role chips + account badge instead of unlabelled column
  values. The record's Member/Teams/Admin card actions arrive with their phases (3–5). Next: phase 3 (Member register).
- 2026-10-14: phase 3 done: Member register (status segments, fee filter, sort, search), Add member, Change status,
  Change member number, Export; the record's Member card menu and the "declared member" alert's Add member, which
  opens the register's dialog via `?add=P-…`. The register loads `people.persons.list`, so it assumes
  `people:members:read` comes with `people:read` (true for every role in decisions.md). Dialogs now reload before
  closing. Next: phase 4 (Admins).
- 2026-10-14: phase 4 done: Admins (Active/Former, campus/year, four quick filters that scroll sideways on phones,
  truncating chips), End admin role (reason required, danger submit via `FormDialog` `tone="danger"`), Capo Admin
  of reference (`people.admins.setCapoOfReference`, added to the contract and fake), appoint / change / end Capo
  Admin (`people-appoint.functions.ts`, `people:appoint`). Same actions on the record's Admin card. Next: phase 5
  (Teams).
- 2026-10-14: phase 5 done: Teams index (NavCards with lead and missing census answers, all-members table), team page
  (RecordHeader, Active/Former, team-field columns and filter, contacts for readers and the Lead), Add to team (Lead
  role only with `people:appoint`), Edit team fields, End membership; the record's Teams card and header "Add role".
  New `people.teams.candidates` query (names only, for Leads without `people:read`) and `peopleTeamReadMiddleware`.
  Verified as IT Lead (`AGENT_PERMISSIONS=people:self AGENT_PERSON=P-0034`). Next: phase 6 (Census).
- 2026-10-14: phase 6 done: Census list (stacked progress meter), campaign page (progress card, answer segments that
  become a filter menu on phones, role filter, per-row reminder, View answers), Send reminders (the toast reports sent
  and skipped: `CensusEntry` has no last-reminded date, so the count can't be known before sending), Close campaign
  (now implemented in the fake), Import wizard (`previewCensusImport` takes `FormData`, .xlsx/.csv up to 10 MB; steps
  without work are skipped). "Start campaign" is left out: the contract has no procedure for it. Next: phase 7
  (Linking).
- 2026-10-14: phase 7 done: Linking (Needs review / Pending invites scope, Dismiss, Resolve dialog with the account
  and record side by side and one set of resolutions per review kind, Resend / Revoke with expired badge). The
  Needs review count streams from the `/dashboard` loader as `needsReview` and shows next to People › Linking, like
  Reports › Open (`QueueCount` in `panel.tsx`). "Link to an existing record" for ask-to-be-added points HR to the
  record's Link account instead: the contract links from the record side. Next: phase 8 (Capo Admin).
- 2026-10-14: phase 8 done: Telegram › Capo Admin (My groups with a No admins badge, Requests to join with Decline /
  Approve, Admins of my groups with phone, Telegram and Open in Telegram / WhatsApp links; no personal email).
  `people-capo.functions.ts` uses `peopleSelfMiddleware`; the backend scopes it to the Capo Admin role. Verified as
  P-0098 with `AGENT_PERMISSIONS=people:self`. Next: phase 9 (My area).
- 2026-10-14: phase 9 done: Account › My area in its three states. Linked: census card pre-filled with the year
  advanced (a changed answer starts from the year already given), I'm leaving dialog, My roles, People to contact,
  My profile with Request a correction, My consents with Revoke, team roster. First sign-in: "Is this you?" with
  This isn't me (the fake now records it as a request, so the page shows Request sent). No record: Ask to be added and
  Request sent. Sign-in & security drops its "Account" title for its section title. Row components moved to
  `people-ui.tsx`. Next: phase 10 (finish).
- 2026-10-14: phase 10: docs (design.md §8 People notes, README, CLAUDE.md architecture), placeholder removed, every
  page swept at 1440 and 390 in agent mode with no console errors or page-level horizontal scroll. Without agent mode
  every People route redirects to sign-in. Still open: empty states are written for every list but were never seen
  with empty data (the fake has no empty mode), loading skeletons were not looked at, and the signed-in flow without
  agent mode needs a development IdP client.
- 2026-10-16: phase 11 (fees and receipts) on its own branch over this PR: contract, agent-mode data and files, Member
  register actions, People › Receipts, Upload signed receipts, record and My area cards, `docs/people/fees.md`.
  Verified in agent mode at 1440 and 390, light and dark, as the President (`P-0007`) and a rejected member
  (`P-0021`): approve, reject, Mark as paid, reminders, download to sign, upload and send, retry, void, member upload.
  Next: the backend side.

- 2026-10-17: reconciled #97 and #100 with main's eSign routes and shared pending counts. People › Receipts now
  reuses `SignWithCie` for batches of up to ten and keeps manual download/upload in its options. Added the durable
  `people.receipts.prepareSignatures` contract and adapter, both signing permissions, and regression tests for
  officer restrictions, loader refresh and merged navigation. The People backend bridge remains pending, so agent
  mode reports that requirement instead of simulating CIE success.

- 2026-10-25: the register now fills from PoliNetwork Auth's bound roles and the Microsoft 365 Soci group (backend
  `feat/people-role-sync`, IdP `feat/people-role-api`). `profile.campus` is nullable and course/year may be empty;
  pages show "—", the profile form starts empty and My area asks for them. The Design team is Design & Marketing.
