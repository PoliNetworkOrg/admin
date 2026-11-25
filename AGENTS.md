# Agent instructions

What the app is and how to run it: [`README.md`](README.md). UI rules: [`docs/design.md`](docs/design.md).

## Architecture

- **Routes** (`src/routes/`): `/dashboard` loads `me.access` via the BFF and requires `admin:access`. The route context
  carries display user data and permissions, never tokens. Navigation and mutation controls use exact permissions.
- **Auth**: `/auth/login`, `/auth/callback` and POST `/auth/logout` implement OIDC with PKCE/state/nonce through
  `openid-client`. ID tokens are signature-checked. Tokens remain in the dedicated Redis server session store.
  `src/start.ts` validates the configured Origin on all state-changing requests. There is no Better Auth proxy.
- **Server functions** attach `adminMiddleware` for reads, and their exact permission middleware for mutations:
  grants, Telegram groups, WhatsApp groups, labels, website content, reports, People (write, appoint, link, team), and
  Soci (`soci:write`: admit, register, edit, change number), and Regolamenti (`regulations:write`, `:manage`,
  `:rectify`). Soci reads use `sociReadMiddleware` (`soci:read`).
  The backend independently checks every procedure. `context.backend` forwards a bearer token, never cookies.
- **Features** (`src/features/<area>/`): pages, dialogs, validation and `*.functions.ts` server functions.
- **Microsoft 365**: read the member directory with `azure:members:read`, and list groups and their members with
  `azure:groups:read`, both read-only. Group membership is never edited from the dashboard: admitting a socio (People ›
  Soci) adds only the new user to Soci, from which the IdP derives the Socio role, so adding or removing anyone in a group
  would grant or revoke IdP roles. Nothing else about users or groups can be edited from Microsoft 365's pages.
- **People** (`src/features/people/`): every page reads and writes through `peopleApi(context)`, which parses the
  backend's `people.*` responses with `people.contract.ts` (a copy of the backend's) and, in agent mode, uses the
  in-memory fake (`AGENT_PERMISSIONS`, `AGENT_PERSON` pick the viewer). A person's roles are assignments (Admin, Capo
  Admin, team member or Lead, nothing else): `pending` until the record is linked to an account, then held by
  PoliNetwork Auth, which may refuse a change; pages show each assignment's status and Auth's refusal word for word.
  A record's profile is its course (from the backend's Politecnico course list, `people.courses.list`), campus, other
  associations and student representative seats; associations and seats need `people:read`.
  `people:write` edits records, admins and invites, `people:appoint` Capo Admins and Leads, `people:link` links and
  unlinks by hand. Invite links open `/people/invite`, outside the dashboard shell and its gate, so an account with no
  permissions yet can accept one (`peopleInviteMiddleware`: signed in, the token is the proof); the old
  `/dashboard/account/me?peopleInvite=` links redirect there. `/dashboard` admits `people:self` without
  `admin:access`; Capo Admin and Team Lead come from the person's own record (`peopleRoles` in the route context) and
  only open their sections. Census is an unconnected mockup (#138): static sample data from `mockup-data.ts`, no server
  functions, disabled actions and a `MockupBanner`, gated by `people:read`, to be rebuilt in Phase 3 (#145). Handoff
  notes, decisions and the plan: `docs/people/`.
- **Soci** (`src/features/soci/`, People's Soci group): the Libro Soci, through `sociApi(context)`, which parses the
  backend's `soci.*` responses with `soci.contract.ts` (a copy of the backend's) and serves `soci.fake.server.ts` in agent
  mode. `soci:read` opens Register and the socio pages, `soci:write` admits (a new Microsoft 365 account in Soci, then the
  record), registers an account already in Soci, edits and changes member numbers, which moved here from Microsoft 365 ›
  Members. Soci › Fees reviews uploaded transfer receipts (Confirm, Reject) and marks fees as paid, also from the socio
  page. My area's Socio card (`soci.me.*`, `people:self`, `soci-self.functions.ts`) shows the signed-in socio's fee, bank
  details, Upload transfer receipt and Complete your details; a socio without a People record sees only that card.
  `AGENT_SOCIO` picks the socio My area shows in agent mode. Design: `docs/people/soci.md`.
- **Regolamenti** (`src/features/regulations/`): every PoliNetwork document, through `regulationsApi(context)`, which
  parses the backend's `regulations.*` responses with `regulations.contract.ts` (a copy of the backend's) and, in agent
  mode, serves `regulations.fake.server.ts` with a local Hocuspocus and `xelatex` (`AGENT_BACKEND_TOKEN` calls a local
  backend instead). Documenti groups documents by `kind`: regolamenti (the RRI's procedure `rri`), documenti generali
  and private ones from a template (procedure `documento`: bozza → pubblicata, "Pubblica"), uploaded PDFs (private,
  read-only, a new version is a new upload) and sola consultazione (Statuto, Elettorale: only the PDF, no drafts).
  `regulations:read` opens Documenti and every draft as a viewer, `regulations:write` creates drafts, assigns members,
  merges and sends to approval, `regulations:manage` records the approval, emanates or publishes, regenerates the
  differences, creates documents (repository: a pull request, "In creazione" until it merges; or private) and uploads
  PDFs, `regulations:rectify` rettifiche and Deleghe. Per-draft access (viewer, commenter, editor) and deleghe are
  backend data: `regulations.me.get` admits an account without `admin:access` to Regolamenti › Bozze only, draft-scoped
  server functions use `regulationsAssigneeMiddleware`, and pages act on the document's `editable` and the draft's `can`
  from the backend. A secret draft (`secret`) is seen only by its creator and the members they add, permissions
  notwithstanding, and its procedure stays closed until the creator makes it visible (`drafts.reveal`, for good). Every PDF opens in `PdfDialog`. The editor connects to the collab service with a single-use ticket
  from a server function, never a token. UI copy is Italian. Details: `docs/regulations/README.md`.
- **MCP** (`src/mcp/`, `docs/mcp.md`): `POST /api/mcp` serves the dashboard's server functions to AI agents as the
  caller (bearer access token plus the MCP client's ID token), each operation in `src/mcp/operations/<area>.ts` behind
  its own middleware. `src/mcp/client/` is the downloadable stdio bridge (`pnpm mcp:build`): Node only, nothing from
  the admin's server code; Account › Sign-in & security links it.
- **Shared UI**: `src/components/shell`, `src/components/primitives`, `src/components/ui`.

## Conventions

`pnpm test` enforces the items marked (test); its failure messages name what to add.

- **Mutations** are called from event handlers through `useServerFn(fn)`; each new POST server function is listed with
  its consumer file in `tests/server-security.test.mjs` (test). Afterwards `await router.invalidate({ sync: true })`, so
  every loader (including the shell's open-reports count) has reloaded before the dialog closes or the toast shows. A
  failed reload after a successful mutation is not a failed mutation: do not offer to repeat it. Optimistic updates
  revert on failure and toast the error.
- **Write scope**: each file calling `useCan` is listed with its permission in the same test (test). The middleware
  checks cover only the `*.functions.ts` files listed in that test: add a new one there.
- **Errors**: every `catch` block and `.catch(handler)` logs `console.error(error)` (test). Route errors and not-found
  states come from the router defaults (`RouteError`, `RouteNotFound`), so routes declare no `errorComponent`, and
  `notFoundComponent` only for a specific state (Telegram user detail).
- **MCP operations**: every new server function in a `*.functions.ts` file gets an operation in
  `src/mcp/operations/<area>.ts` naming its middleware, or an `MCP_EXCLUDED` entry with the reason (test).
- **New dashboard page**: add its section to `src/components/shell/nav.ts` (`PageMatch` and `matchPath`); the
  `/dashboard` route derives `document.title` from it, so pages set no title.

## Previewing

Run with a high port (≥ 10000) that won't collide with other previews, and agent mode:

```sh
PORT=1xxxx AGENT_MODE=true pnpm dev
```

`AGENT_MODE` (development only) signs in a fake administrator with every permission and disables the auth redirects between
`/login` and `/dashboard`, so open `/dashboard/...` or `/login` directly. It has no access token, so the backend
(`BACKEND_URL`, default `http://localhost:3000`) refuses its calls: pages that read the backend show their error state,
and People, Soci and Regolamenti serve their sample data. To see real backend data, sign in through the IdP with `AGENT_MODE=false`. When
changing auth or those redirects, also verify the normal flow with `AGENT_MODE=false`.

> [!IMPORTANT]
> Never run a destructive action on more than one row unless the prompt explicitly asks for it; otherwise ask the user
> first.

## Before handing back

Run `pnpm check`, `pnpm typecheck`, `pnpm test` and `pnpm build`.

Commit with [Conventional Commits](https://www.conventionalcommits.org): `<type>[scope][!]: <description>`, using an
accurate type (`feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`), a body when the change needs context,
and `!` or a `BREAKING CHANGE:` footer for breaking changes.
