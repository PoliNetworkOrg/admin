# People area: implementation plan

Work happens on branch `claude/eager-mayer-bsom7v` in one pull request. Tick a box in the same commit that finishes it,
and add a line to the progress log at the bottom. Each phase ends green on `pnpm check`, `pnpm typecheck`, `pnpm test`
and `pnpm build`, and is committed and pushed before the next one starts (Conventional Commits, see `CLAUDE.md`).

Read first: `CLAUDE.md`, `docs/design.md`, [`decisions.md`](decisions.md), [`contract.md`](contract.md). Look at the
prototype for structure and copy only (see decisions: it has visual errors; build from the primitives).

## Architecture

```
src/features/people/
  people.contract.ts          zod schemas + types from contract.md, TEAM_FIELDS, labels and tones
  people.fixtures.server.ts   seeded in-memory data (port of buildData() in the prototype), mutated by agent-mode calls
  people.source.server.ts     peopleSource(context): fixtures in agent mode, else context.backend.people (typed via contract)
  people.functions.ts         read server functions (GET) per page
  people-write.functions.ts   mutations (POST), each with its exact permission middleware
  me.functions.ts             My area reads and self-service mutations (people:self)
  capo.functions.ts           Capo Admin reads and approve/decline
  format.ts                   display helpers (census parts, role names, initials, team field text)
  overview-page.tsx, person-page.tsx, members-page.tsx, admins-page.tsx, teams-page.tsx, team-page.tsx,
  census-page.tsx, campaign-page.tsx, import-dialog.tsx, linking-page.tsx, link-account-dialog.tsx,
  resolve-dialog.tsx, capo-page.tsx, my-area-page.tsx, dialogs/*.tsx
src/routes/dashboard/people/  index (overview), $personId, members, admins, teams/index, teams/$teamId,
                              census/index, census/$campaignId, linking
src/routes/dashboard/telegram/capo.tsx
src/routes/dashboard/account/  me.tsx (My area), index.tsx (today's Account page moved here)
```

- The backend client type has no `people` router, so `people.source.server.ts` declares the contract's router shape and
  narrows `context.backend` to it in one place, with a safety comment (lint rule
  `anti-slop/require-safety-comment-for-type-assertion`). Nothing else touches the cast.
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
- [ ] Add person / Edit profile dialog (`FormDialog` lg)
- [ ] Person record: RecordHeader, discrepancy alerts, all cards, Activity; Send / resend invite, revoke, unlink
      confirmations; HR notes dialog; census answers dialog

### 3. Member register

- [ ] Table, status segments, fee filter, sort by number/name/admitted
- [ ] Add member, Change status, Change member number, Export (confirm then download)

### 4. Admins

- [ ] Table with priority columns, Active/Former, campus/year filters, the four quick filters
- [ ] End admin role; set Capo Admin of reference; appoint Capo Admin (`people:appoint`)

### 5. Teams

- [ ] Index cards + all-members table
- [ ] Team page (Active/Former, team fields, contacts for Lead); Team Lead lands here from People › Teams
- [ ] Add to team, Edit team fields, End membership

### 6. Census

- [ ] Campaign list; campaign page with segments, reminders, close
- [ ] Import wizard: upload, review tabs, duplicates, Telegram suggestions, confirm; re-import "Already imported"

### 7. Linking

- [ ] Needs review queue with Dismiss / Resolve dialog per kind
- [ ] Pending invites with Resend / Revoke and expired badge
- [ ] Link account dialog with suggestions, required reason, inline conflict

### 8. Capo Admin

- [ ] My groups, Requests to join (approve/decline), Admins of my groups with Telegram/WhatsApp links

### 9. My area

- [ ] Linked: census card (confirm / leaving dialog), roles, contacts, profile + Request a correction, consents +
      revoke, team roster
- [ ] First sign-in match ("Is this you?") and "This isn't me" state
- [ ] No record: Ask to be added dialog and waiting state

### 10. Finish

- [ ] Loading and empty states checked on every page; mobile (390px) and dark checked on every page in agent mode
- [ ] `docs/design.md` §8 page notes for People, Capo Admin, My area; README permissions table; `CLAUDE.md`
      architecture lines
- [ ] PR description final, all checks green

## Progress log

Newest last. One line per commit or session: date, what was done, what is next.

- 2026-10-14: phase 0 done (handoff docs, prototype copy, draft PR). Next: phase 1.
- 2026-10-14: phase 1 done. Verified in agent mode: Direttivo reaches People; `AGENT_PERMISSIONS=people:self` with
  `AGENT_PERSON=P-0098` (Capo Admin) reaches only Telegram › Capo Admin and Account; with `P-0034` (IT Team Lead)
  only People › Teams and Account. Next: phase 2 (Overview and person record).
