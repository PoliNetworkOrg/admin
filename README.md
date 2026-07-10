# PoliNetwork Admin

The PoliNetwork operations console, rebuilt with the latest TanStack Start, React 19, Vite, and Nitro.

## Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3001`. The production server is generated with `pnpm build` and starts with `pnpm start`.

## Environment

Set `BACKEND_URL` to the PoliNetwork backend origin. TanStack Start proxies Better Auth at `/api/auth/*`, and server functions forward the request cookie to its tRPC API, so login and live Telegram, grant, and Azure data stay server-side. When the backend is unavailable, data screens present a clear empty state instead of failing the route.

## Checks

```bash
pnpm typecheck
pnpm check
pnpm build
```
