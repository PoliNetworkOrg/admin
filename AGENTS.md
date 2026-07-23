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
