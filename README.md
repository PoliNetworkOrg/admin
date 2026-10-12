# PoliNetwork Admin

The dashboard manages Telegram and WhatsApp groups, labels, Telegram users and grants, website content and reports.
Microsoft 365 supports a read-only member directory, creating a new association member through the backend's fixed
workflow, and group membership management. Directory access requires `azure:members:read`; creation independently
requires `azure:members:create`. Groups require `azure:groups:read`; adding and removing members `azure:groups:write`.

Built with TanStack Start (React 19), Vite+, Nitro, Tailwind CSS v4 and shadcn/Base UI. The server is an OIDC BFF:
only it holds the IdP access/refresh/ID tokens. Browsers hold an opaque, HttpOnly session cookie; sessions live in a
**dedicated Redis**, separate from the shared backend Redis. Backend requests carry a user bearer token, and permissions
come from `me.access`. Identity, Telegram linking, passkeys and session management live in PoliNetwork Auth.

## Development

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env`, then choose one local mode:

- **Preview with a fake administrator:** set `AGENT_MODE=true`, run `pnpm dev`, and open `/dashboard` or `/login`.
  No OIDC client or Redis is needed. Pages still load data from `BACKEND_URL`, so use a local fake or test backend.
- **Sign in as a real user:** keep `AGENT_MODE=false` and set `OIDC_CLIENT_ID`, exactly one of
  `OIDC_CLIENT_PRIVATE_JWK` or `OIDC_CLIENT_SECRET`, and an independent `SESSION_SECRET` of at least 32 characters.
  Use a dedicated local Redis via `REDIS_URL`. The IdP must register this development client with callback
  `http://localhost:3001/auth/callback`, logout redirect `http://localhost:3001/login`, the scopes and backend
  resource listed below. Set `APP_URL` and the registered redirects to your actual local origin if you change `PORT`.
  Against a shared IdP, a contributor needs credentials for a registered development client from its administrators;
  a personal PoliNetwork account alone cannot act as an OIDC client. For a fully local IdP, follow the steps below.
  Keep credentials in the ignored `.env` file.

### Local OIDC across Auth, backend and admin

For the diagnosis, configuration actually used, login screenshot and remaining bootstrap work, see
[`docs/local-oidc-handoff.md`](docs/local-oidc-handoff.md).

You can run the full sign-in flow locally with [PoliNetwork Auth](https://github.com/PoliNetworkOrg/auth)'s development
personas. Use separate ports: backend `3000`, admin `3001`, Auth `3002`. This exercises the OIDC code flow and backend
permission checks without using the admin's `AGENT_MODE`.

1. Clone Auth alongside this repository. In Auth, copy `.env.local.example` to `.env.local`, set
   `BETTER_AUTH_URL=http://localhost:3002` and `PORT=3002`, and add
   `OAUTH_BACKEND_RESOURCE_URI=https://backend.internal.polinetwork.org` and
   `OAUTH_INTERNAL_RESOURCE_URI=https://auth.polinetwork.org/api/internal`. These two HTTPS URLs are audience
   identifiers; they do not need to resolve locally. Run `pnpm install`, `pnpm run dev:setup`, then `pnpm run dev`.
2. Start two separate local Redis instances, one for backend on port `6379` and one for admin on port `6380`.
   For example, run `docker run -d --rm --name pn-backend-redis -p 127.0.0.1:6379:6379 redis:7-alpine` and
   `docker run -d --rm --name pn-admin-redis -p 127.0.0.1:6380:6379 redis:7-alpine`.
3. Open `http://localhost:3002/api/dev/login?as=admin&redirect=/applications` and register two applications in
   Auth. **Admin Dashboard local** signs people in, uses a client secret, allows localhost redirects (`native`
   application type), requests `openid profile email offline_access` and delegated `backend:admin`, and enables
   end-session. Set its callback to `http://localhost:3001/auth/callback` and logout redirect to
   `http://localhost:3001/login`. **Backend snapshot local** acts as itself, uses `private_key_jwt`, and requests
   `idp:access:read` for the internal resource. Generate a separate Ed25519 key pair for it: enter only the public
   JWKS in Auth and retain the private JWK for backend. Copy both generated client IDs and the dashboard secret.
4. In backend's ignored `.env`, set `IDP_PUBLIC_URL=http://localhost:3002`,
   `OAUTH_BACKEND_RESOURCE_URI=https://backend.internal.polinetwork.org`,
   `OAUTH_INTERNAL_RESOURCE_URI=https://auth.polinetwork.org/api/internal`, `OAUTH_BACKEND_CLIENT_ID` to the backend
   application ID, and `OAUTH_BACKEND_PRIVATE_JWK` to its private JWK JSON (single-quote the JSON for Bun's `.env`
   parser). Set Auth's `OAUTH_BACKEND_CLIENT_ID` to that same ID and restart both services. Backend should log an
   IdP snapshot with `fresh: true`.
5. In admin's ignored `.env`, set `AGENT_MODE=false`, `APP_URL=http://localhost:3001`, `IDP_URL=http://localhost:3002`,
   `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` to the dashboard application's credentials,
   `BACKEND_RESOURCE=https://backend.internal.polinetwork.org`, `REDIS_URL=redis://localhost:6380`, and a fresh
   `SESSION_SECRET` of at least 32 characters. Run `pnpm dev`, open `http://localhost:3001/login`, and choose
   **Ada Admin** on Auth's development sign-in page. Other personas may correctly lack `admin:access`.

Keep Auth, backend and both Redis instances running while using the admin. `pnpm dev` starts only the admin. If Auth
on port `3002` is stopped, login reports “The sign-in service is temporarily unavailable” because OIDC discovery
cannot reach it. If admin Redis on port `6380` is stopped, existing sessions cannot be read; backend Redis on port
`6379` also needs to run for backend features. After stopping the local
stack, restart Auth's database with `docker compose up -d --wait` in the Auth repository, start Auth with
`pnpm run dev`, restart the two Redis containers from step 2, and start backend and admin with their usual dev commands.

Set the following runtime variables (the build does not need secrets):

| Variable                  | Meaning                                                                                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                 | Dashboard's public origin. Required outside development; HTTPS in production. Development defaults to `http://localhost:$PORT` (3001). Used for exact Origin CSRF validation and callback/logout URLs.                                               |
| `BACKEND_URL`             | tRPC backend origin; use the in-cluster service address in production. Defaults to `http://localhost:3000` in development.                                                                                                                           |
| `IDP_URL`                 | Public IdP origin; defaults to `https://auth.polinetwork.org`. Issuer is `$IDP_URL/api/auth`. Browser redirects retain this public origin.                                                                                                           |
| `IDP_INTERNAL_URL`        | Optional internal IdP origin, e.g. `http://auth-service.auth.svc.cluster.local:3000`. Rewrites discovery, token, JWKS and revocation transport only; issuer, JWT assertion audiences (public token/revoke endpoints) and browser URLs remain public. |
| `OIDC_CLIENT_ID`          | Registered confidential dashboard client, with authorization code and refresh grants, scopes `openid profile email offline_access backend:admin`, and backend resource link.                                                                         |
| `OIDC_CLIENT_PRIVATE_JWK` | Private signing JWK JSON with `kid` and `alg` (`EdDSA`/Ed25519 or `ES256`/P-256); inject from this service's Key Vault. Register only its public JWKS in the IdP.                                                                                    |
| `OIDC_CLIENT_SECRET`      | Alternative `client_secret_basic` credential; set exactly one client credential mode.                                                                                                                                                                |
| `BACKEND_RESOURCE`        | Backend OAuth resource/audience; defaults to `https://backend.internal.polinetwork.org`. Sent on every authorize, code exchange and refresh request.                                                                                                 |
| `REDIS_URL`               | Dedicated dashboard Redis connection. Required outside development; development defaults to `redis://localhost:6379`. Never point to shared backend Redis.                                                                                           |
| `SESSION_SECRET`          | Independent random secret of at least 32 characters, encrypting the 10-minute state/nonce/PKCE cookie. Rotation invalidates pending login attempts.                                                                                                  |
| `AGENT_MODE`              | Fake all-permission user in development only. Backend must be a local fake or local legacy test instance. Production ignores this mode.                                                                                                              |
| `PORT`                    | Local listening port (3001 by default); use a port ≥10000 for agent previews.                                                                                                                                                                        |
| `TEST_REDIS_URL`          | Opt-in disposable Redis for integration tests. Tests create/delete only UUID session keys.                                                                                                                                                           |

Before review run `pnpm check`, `pnpm typecheck`, `pnpm test` and `pnpm build`. Run real Redis tests with
`TEST_REDIS_URL=redis://127.0.0.1:<test-port> pnpm test`. The OIDC integration test uses a local fake provider with
signed ID tokens, checks private-key assertions, PKCE, nonce, signature failure, issuer failure, internal transport,
refresh and revocation. It requires no production credentials. The optional compiled HTTP tests are documented in
[`docs/idp-phase4c-handoff.md`](docs/idp-phase4c-handoff.md).

## Production and cutover

`pnpm build` writes `.output/`; `pnpm start` runs it. Main-branch CI publishes `ghcr.io/polinetworkorg/admin:latest`.

Provision Redis in the `admin` namespace, one replica, `maxmemory-policy volatile-ttl`, access restricted to the
dashboard. Every session and refresh-lock key has a TTL. Configure memory limits, readiness and authentication or TLS
appropriate to the cluster. Redis failure returns 503; there is no memory/session or legacy-auth fallback.

Register the **exact** callback `$APP_URL/auth/callback` and logout redirect `$APP_URL/login` on the IdP client.
Enable end-session support, backend resource scopes, and five-minute user access tokens. Verify the backend supports
`me.access`, the IdP grant shape and dedicated `azure.members.create` enforcement before dashboard cutover. Existing
Better Auth sessions do not migrate; users sign in again. Rollback requires the previous dashboard image/config and
legacy backend path; do not remove that path until all callers have migrated.

Sessions expire after seven days absolutely or 24 hours idle. A per-session Redis lock serializes refresh across
replicas, and writes are fenced by lock ownership. A durable refresh marker prevents reuse after a process crashes
between sending a refresh request and storing its rotated token. Such an ambiguous attempt serves an existing valid
access token until it expires, then requires a fresh login: recovery cannot safely replay the old token outside the
IdP's ten-second reuse interval. An expired access token with an unavailable IdP returns 503. This conservative crash
behavior intentionally favors avoiding refresh-token family invalidation over transparent recovery.

Logout deletes the server session, attempts refresh revocation, and redirects to IdP end-session. All state-changing
requests require an `Origin` exactly equal to `APP_URL`'s configured origin. Sessions and identity responses are not
cacheable. Production cookies are host-only, `Secure`, `HttpOnly`, `SameSite=Lax`; tokens and client keys never appear
in browser storage or route loader output.
