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

### Roadmap Phase 2: Soci ([`soci.md`](soci.md), #144)

The design is agreed (9 November 2026). Each item is an issue under #144, in order; see `soci.md` for the details.

- [ ] Auth: the Microsoft 365 object ID in the access snapshot; production config (`soci:*` for `direttivo`,
      `people:self` for Socio)
- [ ] Backend: register and admission (`soci_members`, `soci.members.*`, Graph remove/re-add/delete, `me.get`)
- [ ] Admin: panel groups Volunteers / Soci; Soci › Register, socio page, Admit socio, Register existing socio;
      Microsoft 365 › Members read-only; agent-mode fake for `soci.*`
- [ ] Backend: fees, uploads, fee-year opening, reminders and fee emails
- [ ] Admin: Soci › Fees (review, confirm, reject, mark as paid); My area Socio card (upload, complete details)
- [ ] Backend: ending, automatic lapse (`SOCI_AUTO_LAPSE`), restore, account deletion; birthday emails
- [ ] Admin: End status, Restore, Soci › Deletion pending; remove the mockups and `mockup-data.ts`
- [ ] Production: register the existing soci, mark the 2026/27 payments, then switch on `SOCI_AUTO_LAPSE`

### Next implementation: socio lifecycle (#124 / #157)

Planning checkpoint, 19 November 2026. The live GitHub issues are the status source: backend #123 and #125 and admin
#156 are completed; backend #124 and admin #157 remain open. The older checklist above does not establish whether
production configuration or existing-member registration is complete. The existing rules in `soci.md` still apply.

The first implementation slice is manual ending and restore in the backend, implemented on 19 November 2026 and
submitted for review in [backend #151](https://github.com/PoliNetworkOrg/backend/pull/151) on 20 November. The remaining
slices below are also implemented for review in backend #151 and admin #169 as of 20 November. Production
activation is a separate operation.

1. **Manual lifecycle API — backend #124.** Add `soci.members.end` and `restore` to the existing contract, service and
   router. Reuse `endedOn`, `endReason`, `endNote`, `accountState`, the activity history, the current member-write
   serialization, and the idempotent directory operations. Ending removes Soci membership and records
   `pending_deletion`; it does not delete the account. Restore requires a reason, an existing account and no other
   active record with the same codice fiscale, re-adds Soci membership and clears the end. The actions take effect
   when confirmed; scheduled resignations are outside this scope. Keep `soci:write` and the existing admin policy.
   Verify permission denials, repeated requests, conflicting active records, history, directory errors and persistence
   failures. If a directory write fails, do not record success. If persistence fails after a reversible group change,
   compensate the directory change and surface/log a failed compensation as a mismatch, using the existing failure
   handling pattern.
   **Implemented in backend #151, pending review:** the manual reasons exclude `lapsed`, restore needs a nonblank reason and an existing
   account, and duplicate or conflicting requests fail without adding another history entry. The existing PostgreSQL
   transaction stores the status and history together. Compensation preserves the membership observed before the
   operation, including existing mismatches. No schema or dependency change was needed. The copied admin contract
   and dashboard actions remain part of slice 4.
2. **Preview and automatic lapse — backend #124, after the manual transitions.** Add `soci.lapse.preview` under
   `soci:read` and a daily lapse job guarded by `SOCI_AUTO_LAPSE`, default false. From 1 January, evaluate the fee year
   whose renewal deadline has passed: only active records with a Due fee lapse, with the previous 31 December as
   their end date. Uploaded receipts awaiting review, Paid and Exempt fees are protected. Reuse the ending operation
   and enqueue one Italian lapse email in the existing outbox, using the approved email design. Verify the disabled
   switch, deadline boundaries, pending review, rejection after the deadline, repeated runs, mail deduplication and
   Graph failure followed by retry. Do not infer non-payment from a missing register entry or missing fee row.
   **Implemented locally:** the job evaluates the most recent renewal deadline; preview evaluates 1 January during
   December. Receipts, payments and lifecycle writes share the existing lock. Status, history and the Italian lapse
   email commit in one transaction. The configuration remains false by default; no production activation.
3. **Deletion API — backend #124, after ending.** Add `soci.accounts.pendingDeletion` under `soci:read` and
   `accounts.delete` under `soci:delete`. Accept one pending account per call; refuse active accounts. Keep the register,
   historical numbers, mailbox snapshot and deletion date. Directory deletion is idempotent: retrying after Graph
   succeeded but persistence failed must be able to finish the bookkeeping. No bulk deletion. Verify permissions,
   wrong-state refusals, an already missing directory user and persistence retries.
   **Implemented locally:** the list reads the register, deletion accepts one pending object ID, and retrying after
   directory success can finish a failed database update. The account snapshot, fees and number history remain.
4. **Dashboard — admin #157, against the completed backend contract.** Update the copied contract, API/server
   functions, permission checks and agent-mode fixtures. Add End status / Restore to the socio page, Deletion pending
   with a count and per-account deletion confirmation naming the mailbox, and the lapse preview in Register when
   automatic lapse is enabled. Use the existing form/confirmation primitives and preserve the current layout.
   Test unauthorized roles, loading/error/empty states, mutation success followed by a failed reload, and sample
   pending/deleted accounts. Run the repository checks and inspect mobile/desktop, light/dark.
   **Implemented locally:** End status and Restore on the socio record; Deletion pending with a sidebar count,
   search and a per-account confirmation naming its mailbox; December lapse preview; scoped server functions and
   agent fixtures. Confirmed changes remain non-repeatable if reload fails. Browser checks cover desktop/light
   mutations, required reasons, keyboard focus after deletion, failed reloads and mobile/dark read-only access.

Backend verification uses the existing Vitest service, router, in-memory directory and PostgreSQL fixture patterns;
run typecheck, Biome, tests and build with the Bun lockfile. Admin verification uses its existing pnpm commands.
No new dependency or infrastructure is planned. No schema migration is expected for the existing lifecycle fields;
verify transactional state/history/outbox writes while implementing the store changes.

Production activation is a separate operation: populate and review the register, reconcile existing payments, review
`lapse.preview`, and only then explicitly enable automatic lapse. Real account deletion is never part of development
verification.

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

- 2026-10-29: cleanup (#138), deployed before PoliNetworkOrg/backend#100. Member register, Receipts and Census (and
  My area's fee card) are unconnected mockups: static sample data from `mockup-data.ts`, no loaders or server
  functions, disabled actions and a shared `MockupBanner` linking Phase 2 (#144) or Phase 3 (#145), gated by
  `people:read`. Removed: the members, fees, receipts and census server functions, contract entries and agent-mode
  data; the eSign receipt bridge (`peopleReceipt`); Telegram group columns and Capo Admin join requests; the Linking
  review queue and My area's first-sign-in match, Ask to be added, census, correction and photo-consent revocation; the permissions
  `people:members:read`, `people:members:write`, `people:fees:write` and `people:receipts:sign`. The schemas strip the
  fields the current backend still sends until its own cleanup deploys.
  The backend counterpart is PoliNetworkOrg/backend#104, which deploys after this.

- 2026-10-31: Phase 1 pages (#139), on the API from PoliNetworkOrg/backend#105 and #106. The contract is a copy of
  the backend's: records with a name and contacts, and assignments (Admin, Capo Admin, team member or Lead) whose
  status says where each stands with PoliNetwork Auth (pending until linked, waiting for Auth, applied, refused with
  Auth's reason). Overview filters by role, team, account and status; the person page lists each role with its status,
  the past roles and the history, with actors named from linked records. Add person needs only a name, and can start
  with roles. Admins shows admins with their Capo Admin of reference and the Capo Admins with their scope; the Capo
  Admin area is read-only. Teams honour which roles Auth binds. New permission `people:link` for linking by hand and
  unlinking (with a reason; Auth revokes the roles first). Course, year and campus are gone from records, so #132's
  "—" handling has nothing left to apply to; the Design team is Design & Marketing. Agent-mode fixtures cover linked,
  invited and unlinked records and every assignment status; fake Auth confirms changes after a few seconds and refuses
  every change for P-0012.

- 2026-10-31: Linking and the invite landing page (#140), on PoliNetworkOrg/backend#106 and #109. Linking has three
  views: records without an account (send an invite, link by hand), open invites (resend, revoke, expiry) and links of
  the last 30 days (account, method, date, who; Unlink with a reason, explaining that Auth revokes the roles first).
  The link dialog confirms the account and how many roles go to Auth. `/people/invite` stands outside the dashboard
  shell: sign in, "Link this account to <name>?", confirm, then the roles as they arrive (applied, waiting, refused with
  Auth's reason), or "being applied" while the account can't read My area yet. The old My area invite link redirects
  there, and My area no longer accepts invites.

- 2026-11-19: inspected the remaining lifecycle issues and existing directory/schema support; recorded the next
  backend and dashboard implementation slices above. No production code or production configuration changed.
- 2026-11-19: implemented manual ending and restore locally in the backend (#124), with permission, input, concurrent
  request, Microsoft 365 failure, compensation and PostgreSQL transaction coverage. Typecheck, Biome and build pass
  with a frozen Bun installation. The full suite has 393 passing tests, 2 skipped and one pre-existing Secret Santa
  failure (`tests/secret-santa-email.test.ts:61`, HTTP 401 instead of 413), reproduced on the unchanged HEAD in an
  isolated copy. Microsoft 365 was mocked; PostgreSQL used a disposable local container and synthetic data. No Git
  publication, deployment, real account changes or email delivery. Next: lapse preview and the disabled automatic
  lapse job (slice 2); dashboard wiring follows the completed backend contract.
- 2026-11-20: prepared the manual lifecycle change for review in backend #151 on the current `main`. The full backend
  suite with disposable PostgreSQL 18 passes: 446 tests passed, 3 skipped; typecheck, Biome and build also pass. The
  Secret Santa failure recorded above does not reproduce on the current `main`, which already includes its fix.
  No production accounts, data or configuration were changed. The next implementation slice remains lapse preview
  and the automatic lapse job, disabled by default.

- 2026-11-20: implemented the remaining lifecycle slices locally in the isolated backend/admin worktrees. Backend:
  guarded lapse preview/job, atomic Italian lapse mail, serialized receipt/payment/lifecycle writes, and single-account
  pending deletion. Dashboard: lifecycle dialogs, pending-deletion page and count, permission gates, lapse preview and
  matching agent fixtures. Backend full suite: 461 passed, 3 skipped, including disposable PostgreSQL 18. Browser
  checks passed for end/restore/delete, correction validation, focus recovery, confirmed mutations with failed reloads,
  and mobile/dark read-only permissions and layout. No real mail, account changes or production activation;
  `SOCI_AUTO_LAPSE` remains false by default.

- 2026-11-20: prepared the complete lifecycle implementation for publication in backend #151 and admin #169. Backend
  verification: 461 passed, 3 skipped, typecheck, Biome and build. Dashboard verification: 209 passed, 4 skipped, check,
  typecheck, build and browser flows. The next rollout step requires review of both PRs and a production-readiness
  check of the register/payments before any activation. Merge, deployment, production reads and account mutations
  remain separate operations.

### Next: local Libro Soci import preview

The user selected local preparation and preview on 20 November 2026. See [`soci-import.md`](soci-import.md) for the
preparation draft, acceptance checks and ordered milestones. The source format remains to be confirmed. The preview
must not reuse admission/registration mutations, which create a paid fee and may write to Microsoft 365. No
production access, application or automatic-lapse activation is included.
