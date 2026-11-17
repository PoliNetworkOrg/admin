# Contributing to PoliNetwork Admin

This guide gets a development environment ready for the admin dashboard. The [README](README.md) explains what the
dashboard does and lists every setting; [`docs/design.md`](docs/design.md) holds the UI rules.

There are three ways to run it, with no sign-in in the first two:

- **[Agent mode](#agent-mode)**: a fake administrator with every permission, and no Redis or other services. Enough
  for UI work. It has no access token, so the backend refuses its calls (`Missing bearer token`) and pages that read it
  show their error state; People, Soci and Regolamenti serve sample data.
- **[Agent mode with backend data](#agent-mode-with-backend-data)**: agent mode plus a token from the backend's
  stand-in for Auth. You also run the [backend](https://github.com/PoliNetworkOrg/backend) locally, but not Auth. The
  pages show your local backend's data, with the permissions of the stand-in's account instead of every permission.
- **[Signed in through PoliNetwork Auth](#signed-in-through-auth)**: real users, real permissions and real backend
  data. You also run [Auth](https://github.com/PoliNetworkOrg/auth) and the backend locally.

## Prerequisites

- **Git**.
- **Node** 22 and **pnpm** 10.8.1, the version pinned in `package.json`. With Corepack, `corepack enable` provides it.
- **Docker** with Compose, for the dashboard's Redis (signed-in mode only).

## Set up the dashboard

```sh
git clone git@github.com:PoliNetworkOrg/admin.git
cd admin
pnpm install
cp .env.example .env
```

### Agent mode

Set `AGENT_MODE="true"` in `.env`, then:

```sh
pnpm dev
```

Open http://localhost:3001/dashboard. Agent mode only works with `pnpm dev`; production ignores it.
`AGENT_PERMISSIONS` (comma-separated) limits the fake user's permissions, and `AGENT_PERSON` picks its People record:
see the [README](README.md#development).

### Agent mode with backend data

To get the backend's data without running Auth:

1. Run the backend locally with its stand-in for Auth, following
   [Or use the stand-in for Auth](https://github.com/PoliNetworkOrg/backend/blob/main/CONTRIBUTING.md#or-use-the-stand-in-for-auth)
   in the backend's guide.
2. In the backend's folder, get a token for one of the stand-in's accounts: `bun run regulations:token dev-admin`.
3. Put it in the dashboard's `.env`, keep `AGENT_MODE="true"` and restart `pnpm dev`:

   ```sh
   AGENT_BACKEND_TOKEN="<the token>"
   ```

The dashboard then sends the token to the backend and shows that account, with the permissions the backend reports
for it, instead of the fake administrator. Only the pages those permissions allow are visible, and `dev-admin` holds
only `admin:access`, `people:read` and `tg:users:read`. The token lasts 2 hours; after that, get a new one.

### Signed in through Auth

1. Run Auth and the backend, and connect them, following
   [Connect the local stack](https://github.com/PoliNetworkOrg/auth/blob/main/CONTRIBUTING.md#connect-the-local-stack)
   in Auth's guide. Its step 4 registers this dashboard and gives you a client ID and a client secret.
2. Start the dashboard's Redis, which keeps sessions. `compose.yaml` runs it on `localhost:56380`, apart from the
   backend's: the dashboard must never share the backend's Redis.

   ```sh
   docker compose up -d --wait
   ```

3. Fill in [`.env`](#connect-it-to-auth) and run `pnpm dev`.

## Connect it to Auth

```sh
AGENT_MODE="false"
BACKEND_URL="http://localhost:3000"
APP_URL="http://localhost:3001"
IDP_URL="http://localhost:3003"
# The dashboard application registered in Auth.
OIDC_CLIENT_ID=""
OIDC_CLIENT_SECRET=""
# Encrypts the short-lived sign-in cookie. Generate with: openssl rand -base64 48
SESSION_SECRET=""
REDIS_URL="redis://localhost:56380"
```

Open http://localhost:3001 and sign in. With the dev personas in Auth, **Ada Admin** holds every permission. The
dashboard asks for the backend audience `https://backend.internal.polinetwork.org` by default (`BACKEND_RESOURCE`):
it must match `OAUTH_BACKEND_RESOURCE_URI` in Auth and in the backend, as it does in their guides.

## Everyday commands

| Command               | What it does                                                    |
| --------------------- | --------------------------------------------------------------- |
| `pnpm dev`            | Development server on http://localhost:3001                     |
| `pnpm check`          | Formatting and lint (Vite+); `pnpm check:fix` applies the fixes |
| `pnpm typecheck`      | TypeScript checks                                               |
| `pnpm test`           | Tests, including the security conventions below                 |
| `pnpm build`          | Production build                                                |
| `docker compose down` | Stops the dashboard's Redis                                     |

To preview with an agent, use a port of 10000 or more: `PORT=1xxxx AGENT_MODE=true pnpm dev`.

The backend's types come from the published `@polinetwork/backend` package. A procedure added to the backend reaches
the dashboard's types only after a backend release and an update of that dependency here.

## Pull requests

- Run `pnpm check`, `pnpm typecheck`, `pnpm test` and `pnpm build` before pushing.
- `pnpm test` enforces some conventions, and its failure messages name what to add. Each new POST server function and
  each file calling `useCan` must be listed in `tests/server-security.test.mjs`, and every `catch` logs
  `console.error(error)`. [`CLAUDE.md`](CLAUDE.md) describes the architecture and the rest of the conventions.
- Use [Conventional Commits](https://www.conventionalcommits.org): `<type>[scope][!]: <description>`, with an accurate
  type (`feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`), a body when the change needs context, and
  `!` or a `BREAKING CHANGE:` footer for breaking changes.
