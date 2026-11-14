# PoliNetwork Admin

The dashboard manages Telegram and WhatsApp groups, labels, Telegram users and grants, website content and reports.
Microsoft 365 has a read-only member directory (`azure:members:read`) and a read-only list of groups
(`azure:groups:read`). Group membership is never edited from Microsoft 365's pages: admitting a socio in People › Soci
adds only that new user to Soci, which gives them the Socio role.

**People** keeps one record per volunteer (Overview, Admins, Teams, Linking), plus Telegram › Capo Admin and Account ›
My area for volunteers themselves, and the Libro Soci (Soci › Register and Fees, and the Socio card in My area). The dashboard talks to typed `people.*` and
`soci.*` contracts (`src/features/people/people.contract.ts`, documented in `docs/people/contract.md`, and
`src/features/soci/soci.contract.ts`); agent mode serves sample data from `people.fake.server.ts` and
`soci.fake.server.ts`. Census is an unconnected UI mockup with static sample data, to be rebuilt in Phase 3 (#145).
Permissions: `people:read` (which also opens the mockup), `people:write`, `people:appoint`, `people:self`, which alone
admits non-admins (soci included) to My area and, by the role on their record, Capo Admin or their team, and
`soci:read` and `soci:write` for the register and fees. See `docs/people/README.md` and `docs/people/soci.md`.

Built with TanStack Start (React 19), Vite+, Nitro, Tailwind CSS v4 and shadcn/Base UI. The server is an OIDC BFF:
only it holds the IdP access/refresh/ID tokens. Browsers hold an opaque, HttpOnly session cookie; sessions live in a
**dedicated Redis**, separate from the shared backend Redis. Backend requests carry a user bearer token, and permissions
come from `me.access`. Identity, Telegram linking, passkeys and session management live in PoliNetwork Auth.

## Development

```bash
pnpm install
pnpm dev
```

Copy `.env.example` to `.env`. With `AGENT_MODE=true`, `pnpm dev` signs in a fake administrator without OIDC or Redis.
Signing in as a real user needs a development client registered in the IdP.

Set the following runtime variables (the build does not need secrets):

| Variable                  | Meaning                                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                 | Dashboard's public origin. Required outside development; HTTPS in production. Development defaults to `http://localhost:$PORT` (3001). Used for exact Origin CSRF validation and callback/logout URLs.                                                                                                                    |
| `BACKEND_URL`             | tRPC backend origin; use the in-cluster service address in production. Defaults to `http://localhost:3000` in development.                                                                                                                                                                                                |
| `IDP_URL`                 | Public IdP origin; defaults to `https://auth.polinetwork.org`. Issuer is `$IDP_URL/api/auth`. Browser redirects retain this public origin.                                                                                                                                                                                |
| `IDP_INTERNAL_URL`        | Optional internal IdP origin, e.g. `http://auth-service.auth.svc.cluster.local:3000`. Rewrites discovery, token, JWKS and revocation transport only; issuer, JWT assertion audiences (public token/revoke endpoints) and browser URLs remain public.                                                                      |
| `OIDC_CLIENT_ID`          | Registered confidential dashboard client, with authorization code and refresh grants, scopes `openid profile email offline_access backend:admin`, and backend resource link.                                                                                                                                              |
| `OIDC_CLIENT_PRIVATE_JWK` | Private signing JWK JSON with `kid` and `alg` (`EdDSA`/Ed25519 or `ES256`/P-256); inject from this service's Key Vault. Register only its public JWKS in the IdP.                                                                                                                                                         |
| `OIDC_CLIENT_SECRET`      | Alternative `client_secret_basic` credential; set exactly one client credential mode.                                                                                                                                                                                                                                     |
| `BACKEND_RESOURCE`        | Backend OAuth resource/audience; defaults to `https://backend.internal.polinetwork.org`. Sent on every authorize, code exchange and refresh request.                                                                                                                                                                      |
| `REDIS_URL`               | Dedicated dashboard Redis connection. Required outside development; development defaults to `redis://localhost:6379`. Never point to shared backend Redis.                                                                                                                                                                |
| `SESSION_SECRET`          | Independent random secret of at least 32 characters, encrypting the 10-minute state/nonce/PKCE cookie. Rotation invalidates pending login attempts.                                                                                                                                                                       |
| `AGENT_PERMISSIONS`       | Development only. Comma-separated permissions for the agent-mode user (default: all). `people:self` alone previews the restricted People view.                                                                                                                                                                            |
| `AGENT_PERSON`            | Development only. The agent-mode user's People record (default `P-0007`, Direttivo). `P-0098` is a Capo Admin, `P-0034` the IT Team Lead, `P-0115` an IT member; `none` previews a sign-in without a record. Sending an invite prints its link in the dev server's console.                                               |
| `AGENT_SOCIO`             | Development only. The member number of the socio My area shows (default `7`: Due after a rejected receipt); `4` has a receipt to review, `1` has paid, `23` is Due with details to complete, `34` is exempt, `41`'s fee isn't open yet; `none` is not a socio. With `AGENT_PERSON=none`, a socio without a People record. |
| `AGENT_MODE`              | Fake all-permission user in development only. It has no access token, so the backend refuses its calls; People serves sample data. Production ignores this mode.                                                                                                                                                          |
| `PORT`                    | Local listening port (3001 by default); use a port ≥10000 for agent previews.                                                                                                                                                                                                                                             |
| `TEST_REDIS_URL`          | Opt-in disposable Redis for integration tests. Tests create/delete only UUID session keys.                                                                                                                                                                                                                                |

Before review run `pnpm check`, `pnpm typecheck`, `pnpm test` and `pnpm build`. Run real Redis tests with
`TEST_REDIS_URL=redis://127.0.0.1:<test-port> pnpm test`. The OIDC integration test uses a local fake provider with
signed ID tokens, checks private-key assertions, PKCE, nonce, signature failure, issuer failure, internal transport,
refresh and revocation. It requires no production credentials. The optional compiled HTTP tests are documented in
[`docs/idp-phase4c-handoff.md`](docs/idp-phase4c-handoff.md).

## Freshman content

Web › Freshman contains Resources, Telegram Hub, FAQs and Guide tabs. Resources and Telegram Hub read the
fixed website slots through `web.freshman.getContent`; FAQs select five questions from the existing FAQ catalog.
Edits and adjacent moves use authenticated server functions with `web:content:write`, forwarding the signed-in
user's token through the existing BFF. After mutations the dashboard reloads its loaders before closing dialogs.
A reload failure after a successful write reports that the change was saved, without offering to repeat it.
There is no browser storage, demo catalog or local restore action.

The Guide tab keeps the existing PDF edition management and loads editions only when selected. The former
`/dashboard/web/guides` URL redirects to `/dashboard/web/freshman?tab=guide`. The selected tab stays in the URL;
the full FAQ catalog loads only on the FAQs tab. Page titles, introductory text and slot counts remain fixed.

### Pending backend package release

The source integration targets the backend Freshman contract on `bia/freshmans` (migration
`0026_freshman_content`). The currently pinned `@polinetwork/backend@1.4.0` does not yet export `web.freshman`.
Once a version containing these procedures is published, update this dependency and `pnpm-lock.yaml`, then
rerun `pnpm check`, `pnpm typecheck`, `pnpm test` and `pnpm build`. Until that update, the normal typecheck is
expected to report the missing Freshman contract. No declaration patches or type-error suppression directives are used.
The running backend must also include the Freshman router and its migration before using this page.

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
