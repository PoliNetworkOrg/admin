# Agent instructions

What the app is and how to run it: [`README.md`](README.md). UI rules: [`docs/design.md`](docs/design.md).

## Architecture

- **Routes** (`src/routes/`). `/dashboard` (`dashboard.tsx`) resolves access in `beforeLoad`: signed in, then Telegram
  account linked, then an admin role, otherwise it redirects to `/login`, `/onboarding/link` or
  `/onboarding/unauthorized`. It puts `{ session, roles }` in the route context and renders the shell. Each page route's
  `loader` calls server functions and passes the data to its page component. `/dashboard/web` adds a web-admin gate
  (`web.tsx`; today the same roles).
- **Features** (`src/features/<area>/`): the page, its dialogs, validation and the `*.functions.ts` server functions.
- **Server functions** (`createServerFn`) each attach one middleware from `src/server/auth.middleware.ts`, which also
  provides `context.backend`, a tRPC client for this request that forwards the user's cookies to the backend. Reads use
  `adminMiddleware` (`webAdminMiddleware` under `/dashboard/web`). Mutations (`method: "POST"`) use their area's write
  middleware: `writeAdminMiddleware` (Telegram users and grants, Microsoft 365), `groupWriteAdminMiddleware` (Telegram
  and WhatsApp groups, reports) or `webWriteAdminMiddleware` (web content and labels).
- **Roles** (`src/server/authorization.ts`): every admin role reads; write roles mutate; `web` also mutates web content
  and groups. The UI hides controls the server would reject with `useCanWrite()` or `useCanWrite("web")`.
- **Auth**: `/api/auth/*` proxies Better Auth to the backend (`src/server/auth-proxy*.ts`).
- **Shared UI**: `src/components/shell` (dashboard chrome and navigation), `src/components/primitives` (page building
  blocks), `src/components/ui` (shadcn/Base UI base, used through the primitives).

## Conventions

`pnpm test` enforces the items marked (test); its failure messages name what to add.

- **Mutations** are called from event handlers through `useServerFn(fn)`; each new POST server function is listed with
  its consumer file in `tests/server-security.test.mjs` (test). Afterwards `await router.invalidate({ sync: true })`, so
  every loader (including the shell's open-reports count) has reloaded before the dialog closes or the toast shows. A
  failed reload after a successful mutation is not a failed mutation: do not offer to repeat it. Optimistic updates
  revert on failure and toast the error.
- **Write scope**: each file calling `useCanWrite` is listed with its scope in the same test (test). The middleware
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

`AGENT_MODE` (development only) signs in a fake administrator with every role and disables the auth redirects between
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
