# IdP migration phase 4c — dashboard BFF handoff

## Implemented

The dashboard is a confidential OIDC client. It requests the backend resource with code/refresh grants and
`openid profile email offline_access backend:admin`. State, nonce and PKCE verifier are authenticated/encrypted in a
10-minute callback-only cookie. ID-token signatures, issuer, audience, expiry and nonce are validated; refreshed ID
tokens cannot change subject. Private-key assertions use the public token or revocation endpoint audience, while
optional `IDP_INTERNAL_URL` changes discovery/token/JWKS/revocation network transport only.

Access, refresh and ID tokens live only in the dedicated Redis session hash, keyed by the SHA-256 of the opaque
browser cookie. Host-only production cookies are Secure/HttpOnly/SameSite=Lax. Sessions expire after seven days
absolutely or 24 hours idle. Refreshes are serialized through Redis SET NX PX; durable in-progress markers and
owner-fenced token writes prevent a crashed or late holder from overwriting credentials or resurrecting logout.
Redis connection attempts and commands are bounded. Redis failure and expired-token IdP failure return actual HTTP
503, including SSR requests; valid cached access tokens remain usable during an IdP outage.

Server functions forward only Bearer credentials to tRPC. `me.access` provides permissions, cached five seconds per
session; tokens never enter route data. Mutation middleware and controls use distinct grant, Telegram group,
WhatsApp group, label, web content, report and member-create permissions. Mixed group tables gate each action by its
actual permission, including publication and new WhatsApp group creation. Navigation hides inaccessible read areas.
Grant lists support the `source`/`key`/`grantedBySub` shape; audit rows display IdP subject/Telegram actor and client.

Removed the backend Better Auth proxy, email-OTP/passkey login, Telegram onboarding/link flow, account passkey/session
management, profile upload, Telegram role/group-admin dialogs, and arbitrary Azure directory/group/member edits.
Microsoft 365 exposes the read-only member directory (`azure:members:read`) and the independent dedicated new-member creation flow (`azure:members:create`). Linking and account management point to IdP.

## Verification

- `pnpm check`: passed; 18 existing floating-promise warnings remain in the unchanged test style (dashboard-format
  and server-security test registration). No lint/type errors.
- `pnpm typecheck`: passed.
- `pnpm test`: 31 passed, 3 optional integration tests skipped without their runtime URLs.
- `TEST_REDIS_URL=redis://127.0.0.1:36479 pnpm test`: 32 passed, HTTP deployment smoke tests skipped. A dedicated
  disposable Redis tested concurrent refresh, fenced writes, lock release ownership and logout without recreation.
- Signed local fake IdP integration passes code exchange, PKCE, nonce, issuer/signature rejection, resource-preserving
  refresh, public endpoint assertions, internal transport rewrite, revocation and public logout redirect.
- `pnpm build`: passed. Compiled server started with exclusively local fake/refused endpoints and test credentials.
- Compiled HTTP outage/CSRF smoke: passed login 200, dashboard-to-login 307, invalid callback 303, IdP login failure
  503, missing/foreign Origin 403, trusted logout 303, Redis outage 503, and cookie clearing on failed Redis logout.
- Compiled HTTP session smoke with real disposable Redis: IdP outage plus valid access token gives dashboard 200;
  expired access token gives 503. Production ignores `AGENT_MODE=true`.
- Development SSR against a fake backend displays the dedicated member-create page and controls. T3 browser
  navigation succeeds; snapshots timed out twice and evaluate timed out once. Visual layout/interactions were not
  verified and no screenshot is claimed.
- `git diff --check`: passed.

HTTP regression tests require a locally configured production build. `TEST_ADMIN_HTTP_URL`/`TEST_ADMIN_ORIGIN` run
against refused local Redis and IdP ports; `TEST_ADMIN_SESSION_HTTP_URL` with `TEST_REDIS_URL` runs against a local
fake backend and disposable Redis with an unavailable local IdP. Tests reject non-loopback dashboard URLs.

## Deployment prerequisites and remaining limits

See README for all environment variables. Provision a dedicated Redis in the admin namespace (one replica,
volatile-ttl, TTL on every session/lock key); never use shared backend Redis. Inject independent `SESSION_SECRET`
and the dashboard private signing JWK from its own Key Vault. Register exact public callback `/auth/callback` and
post-logout `/login`, enable end-session, backend resource scopes and five-minute dashboard access tokens. Set public
`IDP_URL`, internal `IDP_INTERNAL_URL`/`BACKEND_URL`, public HTTPS `APP_URL`, actual `OIDC_CLIENT_ID` and Redis URL.
The backend must support `me.access`, new grant DTOs and dedicated member enforcement before cutover.

An ambiguous refresh transport failure or crash between token exchange and durable saving cannot safely replay the
old refresh token after the IdP's ten-second reuse interval. Existing access stays usable until expiration; then a
fresh login is required. This is intentionally conservative fail-closed recovery. The integration tests do not
replace a staging test against the real registered IdP client. Existing Better Auth sessions do not migrate. No
production deployment, real key provisioning or production data access occurred. Keep the previous image/config
and backend legacy compatibility path for rollback until all callers migrate.

## Review and publication suggestions

Existing branch: `feat/idp-phase4c-oidc`.

Conventional Commit:

`feat(auth)!: migrate admin dashboard to IdP OIDC BFF`

PR title:

`feat(admin): migrate dashboard authentication and authorization to IdP`

PR body:

> The dashboard signs in through PoliNetwork Auth and calls the backend using a server-held user access token.
> Add PKCE/state/nonce login, signature-checked ID tokens, dedicated Redis sessions, distributed refresh locking
> with fenced writes, exact Origin CSRF protection and logout/revocation. Authorize controls and mutations through
> `me.access` permissions, support IdP grant and audit actor fields, and retain only dedicated member creation in
> Microsoft 365. Remove the legacy Better Auth proxy, local account/onboarding flows and role/group management.
>
> Validated check, typecheck, unit tests, signed fake OIDC integration, real disposable Redis concurrency tests,
> build and compiled HTTP outage/CSRF/session smoke tests. Browser navigation succeeds; visual snapshots were
> unavailable due to automation timeouts. Requires dedicated Redis, dashboard key/client provisioning and staging
> verification before deployment. Existing dashboard sessions require a new login.

Working tree is left uncommitted for review. No commit, push, PR creation, merge, branch change or deployment.

## Member directory follow-up

Register `azure:members:read` in the IdP permission catalog and assign it to the roles that should see the list.
It does not imply `azure:members:create`, and creation does not imply reading. Both need `admin:access`
to enter the dashboard. Create-only users retain access to the creation form without loading the directory.
Deploy the backend's `azure.members.getAll` policy before deploying this dashboard change.
No new dashboard Azure credentials or SDK release are required; the backend remains the Graph caller.

### Follow-up verification

- Dashboard: `pnpm typecheck`, `pnpm test` (32 passed, 3 optional integration tests skipped),
  `pnpm check` (0 errors, 18 existing warnings) and `pnpm build` passed.
- Backend: Azure and IdP router tests (27 passed), typecheck, build and Biome checks on changed files passed.
- Local collaborative browser with 25 synthetic directory entries: search, Members only filter,
  numeric ordering, pagination, creation dialog and mobile layout checked. No existing-user edit controls.
- Production Azure access and deployment have not been exercised.

Suggested branch: `fix/admin-member-directory`.
Suggested commit: `fix(azure): restore read-only member directory`.
Suggested PR title: `Restore the Microsoft 365 member directory with IdP authorization`.

Ready-to-paste PR description:

```markdown
## Changes

- Restore the read-only Microsoft 365 directory with search, member filtering, sorting and pagination.
- Require azure:members:read in both the dashboard server function and backend procedure.
- Keep azure:members:create independent, including access for create-only users.
- Refresh the directory after creation; keep existing-user and group mutations unavailable.
- Update permission and rollout documentation.

## Verification

- Dashboard typecheck, tests, check and production build passed (18 existing lint warnings).
- Backend Azure/IdP router tests, typecheck, scoped Biome check and build passed.
- Browser interactions and mobile layout checked with synthetic data.

## Rollout

Register and assign azure:members:read in the IdP. Deploy the backend policy before the dashboard.
No production Azure verification or deployment was performed.
```
