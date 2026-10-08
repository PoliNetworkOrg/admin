# PoliNetwork Admin

The dashboard PoliNetwork administrators use to manage Telegram and WhatsApp groups, group labels, Telegram users and
grants, Microsoft 365 groups and members, the website's content (projects, associations, freshman guide, FAQs) and
student reports.

Built with TanStack Start (React 19), Vite+, Nitro, Tailwind CSS v4 and shadcn/Base UI. The app has no database: it
reads and writes everything through the [PoliNetwork backend](https://github.com/PoliNetworkOrg/backend) over tRPC,
and signs users in through the backend's Better Auth.

## Development

```bash
pnpm install
pnpm dev        # http://localhost:3001 (PORT overrides)
```

| Variable      | Meaning                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| `BACKEND_URL` | Backend origin. Defaults to `http://localhost:3000` in development; required in production.              |
| `AGENT_MODE`  | `true` signs in a fake administrator so the dashboard opens without a login. Ignored outside `pnpm dev`. |

Before opening a pull request run `pnpm check`, `pnpm typecheck`, `pnpm test` and `pnpm build`.

## Production

`pnpm build` writes the server to `.output/`; `pnpm start` runs it. Every push to `main` publishes the Docker image
`ghcr.io/polinetworkorg/admin:latest`.

## Documentation

- [`AGENTS.md`](AGENTS.md): architecture and code conventions (for humans and coding agents alike).
- [`docs/design.md`](docs/design.md): the UI design system.
