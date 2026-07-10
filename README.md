# PoliNetwork Admin

The PoliNetwork operations console, rebuilt with the latest TanStack Start, React 19, Vite, Nitro, Tailwind CSS v4, and shadcn/ui.

## Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3001`. The production server is generated with `pnpm build` and starts with `pnpm start`.

The UI uses shadcn's base components with a custom semantic theme in `src/styles.css`. The theme preserves the console's paper canvas, dark navy shell, cobalt `#1156ae` primary, DM Sans body copy, Libre Baskerville headings, and DM Mono metadata while keeping page layout in Tailwind utilities.

## Environment

Set `BACKEND_URL` to the PoliNetwork backend origin. TanStack Start proxies Better Auth at `/api/auth/*`, and server functions forward the request cookie to its tRPC API, so login and live Telegram, grant, and Azure data stay server-side. When the backend is unavailable, data screens present a clear empty state instead of failing the route.

## Checks

```bash
pnpm typecheck
pnpm check
pnpm build
```
