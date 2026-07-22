# Agent instructions

## Previewing the authenticated dashboard

When checking UI changes through a preview or browser, start the app with agent mode enabled:

```sh
PORT=18203 AGENT_MODE=true pnpm dev
```

Use port 18203 or override the `PORT=` in the start command, but be sure to not use ports in the 3000-range
because those are probably used by local dev servers on the user's machine, and it may fail for EADDRINUSE.

Then open `/dashboard` directly. `AGENT_MODE` bypasses session and role authorization and disables the auth-based redirects between `/login` and `/dashboard`, so no real account or login flow is needed.

Use this flag only for local agent-driven development and previews. Never enable it in a deployed environment, and always verify that normal behavior still works with `AGENT_MODE=false`.

You can indipendently check /dashboard and /login for modifying those pages

> [!IMPORTANT]
> Do not run destructive actions across multiple rows, unless specific prompt indication or
> ask for user confirmation ALWAYS.
