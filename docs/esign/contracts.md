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

| Route              | Caller               | Notes                                                                                                                                           |
| ------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`            | anyone               | Status page: running, and ready to sign once reader, card and software check out                                                                |
| `GET /sign`        | popup navigation     | Query `ticket` repeated 1–10 times (43 chars base64url each), `origin` (allowlisted)                                                            |
| `POST /api/job`    | the agent's own page | `{tickets, origin}`. Same-origin only (`Origin`/`Sec-Fetch-Site` checks). The jobs, the remembered PIN, wrong attempts in a row                 |
| `POST /api/sign`   | the agent's own page | `{tickets, origin, pin, remember?}`: one card session signs every job, a result per ticket; an empty `pin` uses the PIN this browser remembered |
| `POST /api/cancel` | the agent's own page | `{tickets, origin}`: the signer cancelled; each job is reported to the backend as `cancelled`                                                   |
| `POST /api/forget` | the agent's own page | Forgets the remembered PIN                                                                                                                      |
| `GET /api/status`  | the agent's own page | Providers, readers, card presence, and `card`: `present`, `absent` or `unknown` (the PIN and Sign are held only while `absent`)                 |

Allowed origins: `https://admin.polinetwork.org` by default, `http://localhost:*` with `--dev`, or the config file.

The signing page tells its opener what happened with `postMessage({type: "pn-esign", status, detail?, …}, origin)`,
to the dashboard's origin only (agents up to v0.1.x post type `pn-sign-agent`):

| `status`    | Other fields                                        | When                                                                                                                                                                                                                    |
| ----------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ready`     | `detail`: the agent's version                       | First thing the page's script does, before any request. From the release after v0.3.0.                                                                                                                                  |
| `error`     | `detail`: code, `message`: its words, `fatal: true` | The page can't go on (job load failed, backend unreachable, link expired, `agent_outdated`, `agent_unreachable` when its own job call can't reach the agent) and shows the error instead of the PIN form. Same release. |
| `error`     | `detail`: code                                      | A signature failed and the page went back to the PIN form; `agent_unreachable` when the page can no longer reach the agent behind it.                                                                                   |
| `completed` |                                                     | Every document of the window is signed.                                                                                                                                                                                 |
| `cancelled` |                                                     | The signer cancelled in the agent window.                                                                                                                                                                               |

The dashboard polls `esign.jobs.statuses` every 1.2 s and at once on every message. A job's terminal status from the
poll wins over a message. Messages the dashboard acts on by themselves:

- **`ready`.** The agent is running: the dialog asks for the PIN and never closes the window by itself from then on,
  except to hand off after success, when someone else cancels or declines the request, or on the signer's cancel.
  The browser remembers it in `localStorage["pn-esign-agent"] = {"version": "<detail>", "at": ISO}`.
- **Older agents** never say `ready`: the job's `seen` (the agent fetched it) stands in for it, and the flag is stored
  with `"version": null`.
- **No answer.** Without `ready` or `seen` 2.5 s after the window is sent to the agent, the dashboard polls once more,
  then closes the window and says PoliNetwork eSign isn't running: "Start PoliNetwork eSign"
  (`polinetwork-esign://open`, then the window opens again) when the flag exists, otherwise "Install PoliNetwork
  eSign" (the setup page) with "It's already installed: start it". The wait is 6 s when the flag's version is null, and
  4 s when there is no flag: that browser may hold an old agent, which shows only once the backend has served its job
  (`seen` is set after the agent's job request went agent → dashboard → backend). The trade-off: a running old agent
  whose job takes longer than that to load is still closed, as "isn't running"; Start or "It's already installed"
  then stores the flag, and the next attempts wait 6 s. A window closed before any answer means the same, at once.
  A dashboard origin the agent doesn't sign for gets no message at all, not even `ready`, and its job is never
  fetched, so it reads as "isn't running" too: the agent logs `refused dashboard origin`, and the fix is the agent's
  `allowedOrigins` setting (`esign doctor` shows it).
- **Fatal errors.** `agent_outdated` shows the update (a direct download of the newest version, the release page on
  Linux), `backend_unreachable` "can't connect" and `job_expired` the timed-out state at once; any other code waits
  for the poll the message starts, in case the job ended with words of its own, then shows the message. The window
  stays open: it shows the same error with its own buttons. A job that failed with `agent_outdated` closes the window
  only when the agent neither said `ready` nor posted a fatal message (an agent too old to post either), whose page
  shows only plain text: the backend fails the job before the agent's page learns why, so a poll can see the failure
  first.
- **`agent_unreachable`**, fatal or not, after the agent answered: it stopped, and only the page can tell; the dialog
  offers "Start PoliNetwork eSign". Older agents (v0.3.0 and before) don't post it.

The dashboard notices a closed agent window by reading `popup.closed` on every poll, and acts once two polls in a row
read it closed: it keeps waiting while a job is `prepared` (the card is signing), shows which documents were signed when
some were, and otherwise cancels the open jobs and closes the dialog without a message. That works only while the two
windows keep their opener relationship, so neither the dashboard nor the agent page may send a
`Cross-Origin-Opener-Policy` header: `same-origin` on either side cuts the link, the dashboard then reads the window as
closed at once, and the page's `window.opener` is gone, so its messages stop too.

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

The agent sends `User-Agent: PoliNetwork-eSign/<version>` (`PoliNetwork-Sign-Agent/<version>` before the rename, up to
v0.1.x). The BFF proxy forwards a User-Agent only when it matches
`^PoliNetwork-(?:eSign|Sign-Agent)/[0-9A-Za-z.+-]{1,32}$` (`agentUserAgent` in `src/features/esign/agent.ts`) and
drops any other. The backend refuses versions below `MIN_AGENT_VERSION` (0.2.0, the first with protocol 2; backend
`src/esign/agent-version.ts`): loading the job (and preparing it) answers 426 `agent_outdated`, and the job ends
`failed` with that code and `seen`, so the dashboard shows the update instead of waiting. A missing or foreign
User-Agent, `dev` and source builds (`v0.3.0-12-gabc`) and anything unparsable pass, so the dashboard, the backend and
the agent can be deployed in any order. Raising the minimum makes every older agent update before its PIN.

| Request                                        | Body                                                 | Response                                                                                                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET  /api/esign/agent/jobs/{ticket}`          |                                                      | `{job: {id, status, expiresAt, document: {title, fileName, pages}, signer: {name, role}, placement: {page}, requestedBy, signatures, marks, pages}}`; 426 `agent_outdated` below the minimum version (the job fails) |
| `POST /api/esign/agent/jobs/{ticket}/prepare`  | `{certificate: b64 DER, chain?: b64[], protocol: 2}` | `{toBeSigned: b64 SHA-256, algorithm: "RSASSA-PKCS1-v1_5-SHA256", step, steps}`; 426 `agent_outdated` below the minimum version or without `protocol: 2`                                                             |
| `POST /api/esign/agent/jobs/{ticket}/complete` | `{signature: b64}`                                   | `{status: "next" \| "completed", request: {status, remaining}}`: on `next`, prepare the job's next place with the same session                                                                                       |
| `POST /api/esign/agent/jobs/{ticket}/fail`     | `{code, message?}`                                   | `{status}` — records cancellations / card errors for the dashboard                                                                                                                                                   |

Errors: `{error: {code, message}}` with codes `ticket_invalid` (404), `job_expired` (410), `job_done` (409),
`job_cancelled` (409: the message names who cancelled or declined the request, else "This signature was cancelled."),
`job_failed` (409: the message of the error that ended the job), `document_changed` (409), `certificate_invalid` (422),
`signer_mismatch` (403), `signature_invalid` (422), `agent_outdated` (426: the message says to update).

The agent, the backend and the dashboard agree on which errors are terminal. A terminal error ends the job: the backend
moves it to `failed` with the code, whether the agent reported it through `/fail` or the backend raised it itself, and
the agent shows it without a PIN form. Any other code, an unknown one included, leaves the job open in the backend. A
retryable error returns to the PIN form in the same agent window. Any other per-document error ends the agent window
while the backend keeps the job open; once the signer closes that window, the dashboard cancels the open jobs and
closes its dialog, so signing again is one click away.

- Terminal, reported by the agent: `pin_locked`, `card_untrusted`, `middleware_missing`, `not_paired`,
  `certificate_not_found`.
- Terminal, raised by the backend: `signer_mismatch`, `certificate_invalid`, `signature_invalid`, `document_changed`,
  `pdf_invalid`, `job_done`, `agent_outdated`.
- Retryable, back to the PIN form: `pin_incorrect`, `pin_invalid`, `pin_required`, `no_card`, `no_reader`,
  `card_removed`, `card_unsupported`, `device_error`, `busy`, `backend_unreachable`.

`/fail` on a job that already failed changes nothing and answers `{status: "failed"}`.

## Backend tRPC (`esign.*`)

Permissions: `esign:sign` (see own inbox, sign when it is your turn), `esign:requests:manage` (create, cancel, see all,
browse OneDrive). Requests are visible to their signers and creator. People receipt requests are visible to
`admin:access` + `people:members:read`, or to the officer currently assigned to the receipt.

- `esign.profile.sync({name, email})` → upserts the caller's signer profile (BFF passes ID-token claims).
- `esign.signers.list()` → registered IdP users with `esign:sign`, including those who have not opened Signatures; each includes eligible drives (manage).
- `esign.config()` → `{drives: [{id, label}], canManage, maxPdfBytes}`; `drives` is empty without OneDrive.
- `esign.drive.list({driveId, folderId?})` → `{folder, path, items: [{id, name, kind: folder|pdf, size, modifiedAt}]}`.
  Item IDs are only unique within their drive, so every drive call names one.
- `esign.documents.upload(FormData{file})` / `esign.documents.fromDrive({driveId, itemId})` → `{documentId, fileName, pages: [{width,height}], signatures, sha256}`.
- `esign.documents.content({documentId})` → `{base64}` (a staged or request document version).
- `esign.requests.create({title, documentId, signers: [{sub, role, places: [{...placement, kind}]}], ordered, output: {driveId, folderId, fileName}, email?: {to[], message?}})`.
  `kind` is `signature` (its own PDF signature) or `mark` (the first signature's mark, drawn in that signature's
  update); each signer has 1–20 places, at least one a signature, and appears once in the request.
- `esign.requests.list({scope: "inbox"|"mine"|"all", status?})` → request views. Each of a view's `signers[]` has
  `lostAccess`: for a pending signer who may no longer sign the documents of one of the request's drives (its "sign"
  rule changed, or the IdP took a role away), that drive's label; else null. `myTurn` is true when it is the caller's
  turn and the caller's `lostAccess` is null (`turn` still lists every signer whose turn it is). `inbox` holds the
  requests where `myTurn` is true, so a request the caller can no longer sign stays reachable under `mine`.
- `esign.requests.get({id})` → `{request, events, versions, currentDocumentId, signingNow}`. `signingNow` is
  `{sub, name, until}` while a signer has a signature open, `until` being when it expires at the latest; else null.
- `esign.requests.cancel({id})`, `esign.requests.decline({id, reason})`, `esign.requests.retryDelivery({id})`.
- `esign.drive.access()` (`esign:drives:manage`) → `{drives: [{id, label, request: {roles, permissions}, sign: {roles,
permissions}, updatedBySub, updatedAt}], catalog: {roles: [{key, name}], permissions: [{key, name}]}}`;
  `esign.drive.setAccess({driveId, request, sign})`. A rule names roles and permissions, any of which grants it; an
  empty rule keeps the default (request: `esign:requests:manage`; sign: everyone who signs). `request` covers browsing
  the drive, using it in a request and seeing its requests; `sign` covers being chosen as signer and signing. Requests
  record `drives` (source and output); `esign.config().drives` and `esign.signers.list()[].drives` are filtered.
  `esign.drive.accessImpact({driveId, sign})` (`esign:drives:manage`) → `[{id, title, signers: [name]}]`: the requests
  in progress on that drive with pending signers who may sign under the current rule but not under the proposed `sign`
  rule (the same empty-rule default); empty when the change strands nobody.
- `esign.jobs.create({items: [{requestId, places?}]})` (1–10, all or none) → `[{requestId, jobId, ticket, expiresAt}]`,
  opened together in one agent window; `places` moves the caller's boxes (one position per place) before signing.
- `esign.jobs.statuses({jobIds})` → one entry per job:
  `{jobId, requestId, status, errorCode, errorMessage, expiresAt, seen, signaturesLeft}`. `status` is `pending`,
  `prepared`, `completed`, `failed` (a terminal error, its code in `errorCode`), `cancelled` or `expired`. A job
  cancelled because its request was cancelled or declined has `errorCode` `request_cancelled` or `request_declined`,
  and an `errorMessage` naming who did it (with the reason of a decline).
- `esign.jobs.cancel({jobIds})`.

Placement: `{page (0-based), x, y, width, height}` as fractions of the displayed page (crop box after rotation),
origin top-left.

## People fee receipts

People › Receipts reuses this signing flow through `people.receipts.prepareSignatures({receiptIds})` (1–10 distinct
IDs), then passes the returned `requestId`s to `esign.jobs.create`. The bridge requires the People receipt-signing
permission, the actual President/Vice-president and `esign:sign`; it does not require general request management.
The backend fixes the issued PDF, officer and placement, persists receipt/request ownership and completes/delivers
receipts after eSign completion without a browser callback. Retrying preparation reuses the request. Manual
ZIP/download/upload remains supported; both paths share completion and concurrency guards. The backend implements it
in the `people.*` router (PoliNetworkOrg/backend#83): see [`../people/contract.md`](../people/contract.md#fees-and-receipts).

Receipt request provenance: `esign.requests.list` rows and `esign.requests.get().request` include
`peopleReceipt: { receiptId: string, number: string, year: "YYYY/YY" }` for the bridge's requests. Other requests omit
it or return null; absence remains supported for deployed eSign versions. The backend fixes the title to
`Receipt {number} · {member name}` and owns this metadata; generic create inputs cannot set it. The dashboard links
the reference to `/dashboard/people/receipts?year={year}&q={number}` when the viewer can read the register.

For these system-owned requests, jobs/create, signed-file uploads and completion additionally enforce
`people:receipts:sign`, the confirmed officer and receipt assignment/version; `myTurn` reflects that eligibility.
Reject custom placement changes, generic cancellation, deletion and delivery retry: People emails the receipt, so
eSign records no output or email for it. Voiding the receipt cancels its request and logs a `people_invalidated`
event. The signed-file upload also accepts a CAdES `.p7m` around the issued PDF; eSign keeps the PDF inside it, so
the signed copy is the one in People › Receipts. People voiding owns request/job invalidation;
manual upload or CIE completion uses the same transaction and exactly-once delivery guard. Decline/failure leaves
the receipt `toSign`, allowing preparation to reuse an active request or create its replacement. No browser callback
completes a receipt. The agent protocol is unchanged.
