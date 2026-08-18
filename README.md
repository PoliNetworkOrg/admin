# PoliNetwork Admin

The PoliNetwork operations console, rebuilt with TanStack Start, React 19, Vite, Nitro, Tailwind CSS v4, and shadcn/ui.

## Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3001`. The production server is generated with `pnpm build` and starts with `pnpm start`.

The UI uses shadcn's base components with a custom semantic theme in `src/styles.css`. The theme preserves the console's paper canvas, dark navy shell, cobalt `#1156ae` primary, DM Sans body copy, Libre Baskerville headings, and DM Mono metadata while keeping page layout in Tailwind utilities.

## Environment

Set `BACKEND_URL` to the PoliNetwork backend origin. TanStack Start proxies Better Auth at `/api/auth/*`, and each server-function request creates its own tRPC client with that request's session cookie. Private dashboard functions also verify the linked Telegram identity and an administrator role before contacting the backend.

`AGENT_MODE=true` provides a fake administrator only while the app runs in development. Production ignores the flag.

## Checks

```bash
pnpm typecheck
pnpm test
pnpm check
pnpm build
```
