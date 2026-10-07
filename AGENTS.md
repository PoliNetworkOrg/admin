# Agent instructions

## Previewing the authenticated dashboard

When checking UI changes through a preview or browser, start the app with agent mode enabled:

```sh
PORT=xxxxx AGENT_MODE=true pnpm dev
```

Setting the `PORT=xxxxx` to an high enough port that is unlikely to hit
another service or conflict with another workflow in preview (min 10000).

Then open `/dashboard` directly (if not working on a page outside dashboard).
`AGENT_MODE` bypasses session and role authorization and disables the auth-based
redirects between `/login` and `/dashboard`, so no real account or login flow is needed.
You can indipendently check /dashboard and /login for modifying those pages

Use this flag only for local agent-driven development and previews.
Never enable it in a deployed environment.

When modifing auth-related code or redirects between authed and non-authed contexts,
always verify that normal behavior still works with `AGENT_MODE=false`.

> [!IMPORTANT]
> Do not run destructive actions across multiple rows, unless specific prompt indication or
> ask for user confirmation ALWAYS.

## Design system

UI work follows [`docs/design.md`](docs/design.md): tokens, shell, page templates, component rules and copy.
Build pages from the shell (`@/components/shell`: `PageBar`, `Toolbar`, `PageContent`, `appToast`,
`useCanWrite`) and the primitives (`@/components/primitives`); use the `--pn-*` tokens, never raw colors.

Data and error conventions (details in `docs/design.md` §9.1):

- Call mutation server functions from event handlers through `useServerFn(fn)`, and add each new POST
  server function with its consumer file to the map in `tests/server-security.test.mjs`.
- After a mutation, `await router.invalidate({ sync: true })` so loaders have reloaded before the UI settles.
- Every `catch` block and `.catch(handler)` logs the caught error with `console.error(error)` (enforced by `pnpm test`).
- Toasts go through `appToast`; route errors and not-found states come from the router defaults
  (`RouteError`, `RouteNotFound`), so routes do not declare `errorComponent`.

Before handing work back run `pnpm check`, `pnpm typecheck`, `pnpm test` and `pnpm build`.

## Git commits

Use Conventional Commits for every commit message:

```text
<type>[optional scope][!]: <description>
```

Choose an accurate type such as `feat`, `fix`, `docs`, `refactor`, `test`,
`build`, `ci`, or `chore`. Add a body when the change needs context. Mark
breaking changes with `!` or a `BREAKING CHANGE:` footer.
