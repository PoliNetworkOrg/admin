# PoliNetwork Admin

The dashboard manages Telegram and WhatsApp groups, labels, Telegram users and grants, website content and reports.
Its Microsoft 365 capability is limited to creating a new association member through the backend's fixed workflow.

Built with TanStack Start (React 19), Vite+, Nitro, Tailwind CSS v4 and shadcn/Base UI. The server is an OIDC BFF:
only it holds the IdP access/refresh/ID tokens. Browsers hold an opaque, HttpOnly session cookie; sessions live in a
**dedicated Redis**, separate from the shared backend Redis. Backend requests carry a user bearer token, and permissions
come from `me.access`. Identity, Telegram linking, passkeys and session management live in PoliNetwork Auth.

## Development

```bash
pnpm install
pnpm dev
```

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
