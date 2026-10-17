# CIE e-signing — contracts

Frozen interfaces between the dashboard, the backend and the sign agent. Change them here first.

## Why a popup to the agent, not a fetch to localhost

Research ([`research/web-and-pades.md`](research/web-and-pades.md)): Safari blocks active requests from an HTTPS page to
`http://127.0.0.1` (WebKit bug 171934, still open), and Chrome 142+/Firefox 151+ put such requests behind a
local-network permission prompt. A **top-level navigation** is outside both mechanisms. So the dashboard never calls
the agent: it opens a popup on the agent's own page, and the agent talks to the backend itself with a single-use ticket.
The PIN is typed on that local page and goes only to the card.

## Flow

```
Dashboard                      Admin BFF                Backend                         Agent (127.0.0.1:47321)
  │ click "Sign with CIE"
  │ open blank popup ───────────────────────────────────────────────────────────────────────┐
  │ esign.jobs.create ─────────► tRPC ─────────────────► job + ticket (10 min, single job)  │
  │ popup.location = http://127.0.0.1:47321/sign?ticket=T&origin=https://admin…  ───────────►│ page
  │                                                                                         │ GET  {origin}/api/esign/agent/jobs/T
  │                                                      ◄──────── proxy ◄──────────────────│ (title, signer, page…)
  │                                                                                         │ user types PIN
  │                                                                                         │ card: open session, read certificate
  │                                                      ◄── POST …/jobs/T/prepare {cert} ──│
  │                                                      ── {toBeSigned} ──────────────────►│ card: sign digest
  │                                                      ◄── POST …/jobs/T/complete {sig} ──│
  │ poll esign.jobs.status ────► … ────────────────────► completed                           │ "Signed", window closes
```

## Agent

Listens on `127.0.0.1:47321` only. Every request: `Host` must be `127.0.0.1:47321` or `localhost:47321`.

| Route             | Caller               | Notes                                                                                |
| ----------------- | -------------------- | ------------------------------------------------------------------------------------ |
| `GET /`           | anyone               | "Agent is running" page                                                              |
| `GET /sign`       | popup navigation     | Query `ticket` repeated 1–10 times (43 chars base64url each), `origin` (allowlisted) |
| `GET /api/job`    | the agent's own page | Same-origin only (`Origin`/`Sec-Fetch-Site` checks). Job + card status               |
| `POST /api/sign`  | the agent's own page | `{tickets, origin, pin}`: one card session signs every job; a result per ticket      |
| `GET /api/status` | the agent's own page | Providers, readers, card presence                                                    |

Allowed origins: `https://admin.polinetwork.org` by default, `http://localhost:*` with `--dev`, or the config file.

Providers (tried in order, first with a card present; never falls back once a PIN reached a module or card —
`token.Error.PINSent`):

| Name      | What                                                     | PIN given to the device                       |
| --------- | -------------------------------------------------------- | --------------------------------------------- |
| `cie-mw`  | Official CIE middleware PKCS#11 (needs pairing in app)   | last 4 digits (middleware caches the first 4) |
| `opencie` | OpenCIE PKCS#11 (direct card access, no pairing)         | 8 digits                                      |
| `cie`     | Built-in direct PC/SC implementation of the IAS protocol | 8 digits                                      |
| `soft`    | Development key (`--soft`), never valid                  | 8 digits (`12345678`)                         |

Agent → backend (through the dashboard origin, `{origin}/api/esign/agent/…`, proxied by the BFF to the backend's
`/esign/agent/…`). Authentication is the ticket in the path; no cookies, no bearer tokens.

| Request                                        | Body                                                 | Response                                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET  /api/esign/agent/jobs/{ticket}`          |                                                      | `{job: {id, status, expiresAt, document: {title, fileName, pages}, signer: {name, role}, placement: {page}, requestedBy, signatures, marks, pages}}` |
| `POST /api/esign/agent/jobs/{ticket}/prepare`  | `{certificate: b64 DER, chain?: b64[], protocol: 2}` | `{toBeSigned: b64 SHA-256, algorithm: "RSASSA-PKCS1-v1_5-SHA256", step, steps}`; without `protocol: 2`, 426 `agent_outdated`                         |
| `POST /api/esign/agent/jobs/{ticket}/complete` | `{signature: b64}`                                   | `{status: "next" \| "completed", request: {status, remaining}}`: on `next`, prepare the job's next place with the same session                       |
| `POST /api/esign/agent/jobs/{ticket}/fail`     | `{code, message?}`                                   | `{status}` — records cancellations / card errors for the dashboard                                                                                   |

Errors: `{error: {code, message}}` with codes `ticket_invalid` (404), `job_expired` (410), `job_done` (409),
`document_changed` (409), `certificate_invalid` (422), `signer_mismatch` (403), `signature_invalid` (422).

## Backend tRPC (`esign.*`)

Permissions: `esign:sign` (see own inbox, sign when it is your turn), `esign:requests:manage` (create, cancel, see all,
browse OneDrive). Requests are visible to their signers and creator.

- `esign.profile.sync({name, email})` → upserts the caller's signer profile (BFF passes ID-token claims).
- `esign.signers.list()` → signer profiles (manage).
- `esign.config()` → `{drives: [{id, label}], canManage, maxPdfBytes}`; `drives` is empty without OneDrive.
- `esign.drive.list({driveId, folderId?})` → `{folder, path, items: [{id, name, kind: folder|pdf, size, modifiedAt}]}`.
  Item IDs are only unique within their drive, so every drive call names one.
- `esign.documents.upload(FormData{file})` / `esign.documents.fromDrive({driveId, itemId})` → `{documentId, fileName, pages: [{width,height}], signatures, sha256}`.
- `esign.documents.content({documentId})` → `{base64}` (a staged or request document version).
- `esign.requests.create({title, documentId, signers: [{sub, role, places: [{...placement, kind}]}], ordered, output: {driveId, folderId, fileName}, email?: {to[], message?}})`.
  `kind` is `signature` (its own PDF signature) or `mark` (the first signature's mark, drawn in that signature's
  update); each signer has 1–20 places, at least one a signature, and appears once in the request.
- `esign.requests.list({scope: "inbox"|"mine"|"all", status?})`, `esign.requests.get({id})`.
- `esign.requests.cancel({id})`, `esign.requests.decline({id, reason})`, `esign.requests.retryDelivery({id})`.
- `esign.drive.access()` (`esign:drives:manage`) → `{drives: [{id, label, request: {roles, permissions}, sign: {roles,
permissions}, updatedBySub, updatedAt}], catalog: {roles: [{key, name}], permissions: [{key, name}]}}`;
  `esign.drive.setAccess({driveId, request, sign})`. A rule names roles and permissions, any of which grants it; an
  empty rule keeps the default (request: `esign:requests:manage`; sign: everyone who signs). `request` covers browsing
  the drive, using it in a request and seeing its requests; `sign` covers being chosen as signer and signing. Requests
  record `drives` (source and output); `esign.config().drives` and `esign.signers.list()[].drives` are filtered.
- `esign.jobs.create({items: [{requestId, places?}]})` (1–10, all or none) → `[{requestId, jobId, ticket, expiresAt}]`,
  opened together in one agent window; `places` moves the caller's boxes (one position per place) before signing.
  `esign.jobs.statuses({jobIds})`, `esign.jobs.cancel({jobIds})`.

Placement: `{page (0-based), x, y, width, height}` as fractions of the displayed page (crop box after rotation),
origin top-left.
