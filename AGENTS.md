# Agent instructions

What the app is and how to run it: [`README.md`](README.md). UI rules: [`docs/design.md`](docs/design.md).

## Architecture

- **Routes** (`src/routes/`): `/dashboard` loads `me.access` via the BFF and requires `admin:access`. The route context
  carries display user data and permissions, never tokens. Navigation and mutation controls use exact permissions.
- **Auth**: `/auth/login`, `/auth/callback` and POST `/auth/logout` implement OIDC with PKCE/state/nonce through
  `openid-client`. ID tokens are signature-checked. Tokens remain in the dedicated Redis server session store.
  `src/start.ts` validates the configured Origin on all state-changing requests. There is no Better Auth proxy.
- **Server functions** attach `adminMiddleware` for reads, and their exact permission middleware for mutations:
  grants, Telegram groups, WhatsApp groups, labels, website content, reports and dedicated member creation.
  The backend independently checks every procedure. `context.backend` forwards a bearer token, never cookies.
- **Features** (`src/features/<area>/`): pages, dialogs, validation and `*.functions.ts` server functions.
- **Microsoft 365**: only `azure.members.create` through the backend's fixed new-member workflow. Existing users,
  memberships and arbitrary Entra groups cannot be modified from the dashboard.
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
- **New dashboard page**: add its section to `src/components/shell/nav.ts` (`PageMatch` and `matchPath`); the
  `/dashboard` route derives `document.title` from it, so pages set no title.

## Previewing

Run with a high port (≥ 10000) that won't collide with other previews, and agent mode:

```sh
PORT=1xxxx AGENT_MODE=true pnpm dev
```

`AGENT_MODE` (development only) signs in a fake administrator with every permission and disables the auth redirects between
`/login` and `/dashboard`, so open `/dashboard/...` or `/login` directly. Data still comes from `BACKEND_URL` (default
`http://localhost:3000`). When changing auth or those redirects, also verify the normal flow with `AGENT_MODE=false`.

> [!IMPORTANT]
> Never run a destructive action on more than one row unless the prompt explicitly asks for it; otherwise ask the user
> first.

## Before handing back

Run `pnpm check`, `pnpm typecheck`, `pnpm test` and `pnpm build`.

Commit with [Conventional Commits](https://www.conventionalcommits.org): `<type>[scope][!]: <description>`, using an
accurate type (`feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`), a body when the change needs context,
and `!` or a `BREAKING CHANGE:` footer for breaking changes.
