# PoliNetwork Admin MCP

Downloadable MCP server for the same account and operations as the admin dashboard. It runs locally over stdio,
signs you in with PoliNetwork Auth using authorization code, PKCE and a verified ID token, and calls the backend
through a cookie-free gateway on admin. No client secret or administrator account is included in the download.

## Install and connect

Requires Node.js 22 or newer on Windows, macOS or Linux. After deployment, anyone can download the package from
`https://admin.polinetwork.org/downloads/polinetwork-admin-mcp.tgz` without signing in. API access still requires
their own account and dashboard permissions.

```sh
npm install -g https://admin.polinetwork.org/downloads/polinetwork-admin-mcp.tgz
polinetwork-admin-mcp login
```

Your browser opens PoliNetwork Auth. Sign in and approve the application's access. If the browser cannot be opened,
copy the link printed in the terminal. Keep the terminal open until it confirms connection. The loopback callback
uses `http://127.0.0.1:47322/callback`; port 47322 must be available.

Add this stdio configuration to an MCP client:

```json
{
  "mcpServers": {
    "polinetwork-admin": {
      "command": "polinetwork-admin-mcp",
      "args": ["serve"]
    }
  }
}
```

For example, Claude Code can add the installed executable with:

```sh
claude mcp add --scope user polinetwork-admin -- polinetwork-admin-mcp serve
```

On a different admin deployment, pass the same `--admin-url https://admin.example.org` to both `login` and `serve`.
Each origin has separate credentials. `logout` revokes the refresh token and removes local credentials.
This is a local stdio server; browser-hosted connectors require a remote HTTP server and cannot run this package.

## What it can do

`whoami` shows the signed-in subject and current permissions. The tool list contains only operations allowed to
that account, and both the gateway and backend check authorization on every call. Telegram groups, users, messages,
audit and grants; WhatsApp groups; group labels; website projects, associations, FAQs, Freshman cards and guides;
reports; Microsoft 365; People, teams, census, linking, fees and receipts; eSign requests and drive rules are included.

Microsoft 365 follows the dashboard's fixed new-member workflow, member-number changes and read-only groups.
Existing group memberships and arbitrary user properties cannot be changed. People responses use the dashboard's
contract schemas: a backend that has not implemented a procedure reports an error, without demo data or fallback.
The Capo Admin and Team Lead views remain scoped by the backend to the caller's own record.

Writes take `{ "input": { ... }, "confirmed": true }`; the agent sets this only after the user has authorized the
specific change. Deletions, departures, revocations and similar operations are marked destructive. Report actions
and signing-job cancellation accept a single row. Label renames or deletions may affect descendants: inspect and
confirm that entire scope first. Never perform destructive operations on multiple records without an explicit
instruction covering them. Changes are attributed by the backend to the token's user, never an author argument.
An uncertain network result must be checked before any retry; writes are never retried automatically.

Upload tools accept `fields` (string form values) and `files` entries containing `field`, `name`, `type` and `base64`.
They never read local paths. Download tools return base64 content or CSV. CIE tools can prepare requests and tickets;
the person must complete signing with the existing CIE application and hardware. Never give a PIN to the agent.
The server accepts MCP messages up to 72 MB, enough for a 50 MB signed-receipt batch encoded as base64. MCP clients
can impose their own smaller limits, including on large download responses.

## Activate on a deployment

The existing Auth MCP was inspected as the reference (`src/auth/mcp-server.ts`, `mcp-token.ts`, `mcp-clients.ts` in
the auth repository). Its anonymous dynamic registration deliberately grants only `idp:mcp` for its own audience.
Admin therefore uses a separate, publicly identifiable native client with backend access, rather than widening
Auth's working registration policy or embedding the dashboard's confidential credentials.

A Master Admin creates one application at `/applications` (granting backend API scopes requires that role):

| Setting              | Value                                                |
| -------------------- | ---------------------------------------------------- |
| Name                 | PoliNetwork Admin MCP                                |
| Usage                | Sign people in; no service/client-credentials access |
| Application type     | Native (localhost allowed)                           |
| Authentication       | Public / none (PKCE S256)                            |
| Redirect URI         | `http://127.0.0.1:47322/callback`                    |
| Identity scopes      | `openid profile email offline_access`                |
| Delegated API scopes | `backend:admin`                                      |
| Resource             | The same backend resource as the dashboard           |
| Consent              | Required                                             |

Set `ADMIN_MCP_CLIENT_ID` on admin to that public client ID. `IDP_URL` and `BACKEND_RESOURCE` retain their existing
dashboard meanings. The manifest at `/api/mcp/config` exposes only the public ID, issuer, resource, callback and
download URL. It returns 503 until configured. The RPC gateway is also disabled until this variable is set.
The backend remains internal, reached with `BACKEND_URL`; no new backend public ingress is necessary.

Download permission is public. Data permissions are always the person's own; installing the package grants no
roles. This implementation does not require `idp:mcp`, which governs the separate Auth MCP.

Tokens live on the installing user's computer in `~/.polinetwork/admin-mcp/`: directory mode 0700 and files 0600
on POSIX, atomic replacements, one refresh at a time across processes (waiting up to five seconds for another
process's refresh), and no stdout logging. Protect this directory
as other local application credentials. A refresh marker is saved before contacting the IdP: after a crash or an
ambiguous refresh response the user signs in again instead of replaying a rotating token. A crashed process can also
leave a `.lock` directory next to its credential file; remove that directory only after the process has stopped.
If logout cannot contact Auth, local credentials are still deleted and the user is told to revoke the application's
consent in Auth. Existing access tokens are subject to the backend's validation and token expiry policy.

## Build and distribute

```sh
pnpm mcp:build
node dist/admin-mcp/cli.mjs help
```

The bundle contains runtime dependencies and needs no separate npm dependency install. `pnpm build` produces the
package first and includes the public `.tgz` and SHA-256 file in the dashboard's static output. CI tests the MCP
before publishing the usual dashboard image. Deploying that image makes the download public at the URL above.
For local development use `--admin-url http://localhost:PORT` with a local Auth native client.

Public installation and a real user login require deployment and the client registration above; creating the
downloadable artifact alone does not register a production client or publish a deployment.
