# CIE e-signing — work tracker

Single source of truth for the CIE PDF signing feature across repos. Update it at every checkpoint.

## Goal

Sign PDFs with the Italian CIE (NFC reader + PIN) from the admin dashboard, with:

- a custom in-dashboard PDF viewer (pdf.js), 1–2 clicks to place the signature and type the PIN;
- multi-signer coordination (e.g. a verbale signed by the secretary, then the president);
- source PDFs picked from the association's OneDrive (or uploaded), signed versions saved back to OneDrive;
- optional email of the fully signed PDF;
- Windows, macOS and Linux.

## Architecture (deferred / remote signing, like EU DSS + NexU)

> Revised after research: the dashboard does **not** fetch the agent (Safari blocks HTTPS→loopback, Chrome/Firefox
> prompt). It opens the agent's own page in a popup; the agent talks to the backend with a single-use ticket and the
> PIN is typed on the local page. See [`contracts.md`](contracts.md). The diagram below is the original sketch.

```
 Browser (admin dashboard)                 Admin BFF (TanStack Start)        Backend (Bun, tRPC)
 ┌──────────────────────────┐  server fns  ┌───────────────────────┐  tRPC  ┌──────────────────────────────┐
 │ pdf.js viewer, placement ├─────────────►│ esign.functions.ts    ├───────►│ esign router                 │
 │ PIN field                │              └───────────────────────┘ bearer │  prepare: PAdES placeholder, │
 │        │ fetch (loopback)                                               │   signed attrs → digest      │
 │        ▼                                                                 │  finalize: CMS → embed       │
 │ ┌──────────────────────┐                                                 │  requests / signers / versions│
 │ │ esign (Go)           │ 127.0.0.1:47321                                 │  OneDrive (Graph) + email    │
 │ │ cert + sign(digest)  │                                                 └──────────────────────────────┘
 │ │ PKCS#11 (CIE MW) or  │
 │ │ direct PC/SC (CIE)   │
 │ └──────────────────────┘
 └──────────────────────────┘
```

1. The browser asks the agent for the CIE certificate (`GET /v1/certificate`).
2. The BFF calls `esign.prepare` with the request, the signature placement and the certificate: the backend adds an
   incremental update (signature field + visible appearance + `/Contents` placeholder), computes the ByteRange
   SHA-256, builds the CAdES signed attributes and returns `SHA-256(DER(signedAttrs))` with a short-lived session id.
   The document is locked to that signer for the session.
3. The browser sends the digest and the PIN **only to the local agent** (`POST /v1/sign`); the agent returns the RSA
   signature. The PIN never reaches the BFF or the backend.
4. The BFF calls `esign.finalize` with the signature: the backend builds the CMS SignedData, embeds it, validates the
   result, stores the new version and advances the request. On completion it uploads to OneDrive and emails.

## Repos and branches

| Layer    | Repo                                               | Branch / location                                                   |
| -------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| Native   | `PoliNetworkOrg/esign` (new, Go; was `sign-agent`) | `main` + PRs; local checkout `~/dev/polinetwork/sign-agent`         |
| Backend  | `PoliNetworkOrg/backend`                           | `feat/esign`, worktree `~/dev/polinetwork/.esign-worktrees/backend` |
| Frontend | `PoliNetworkOrg/admin`                             | `feat/esign` in `~/dev/polinetwork/admin`                           |

The main backend checkout (`~/dev/polinetwork/backend`) is on another branch with uncommitted work: never touch it.

## Research

- [`research/cie.md`](research/cie.md): CIE middleware, PKCS#11, card protocol, alternatives.
- [`research/web-and-pades.md`](research/web-and-pades.md): browser ↔ localhost agent, PAdES in TypeScript.

## Status

Legend: ☐ todo · ◐ in progress · ☑ done

### Phase 0 — research and design

- ☑ Survey repos (admin, backend), permissions model (IdP data, no auth-repo code change).
- ☑ Deep research (CIE, browser connectivity, PAdES) — Sol 6.1 subagents.
- ☑ Freeze the API contracts (agent HTTP API, backend tRPC) in [`contracts.md`](contracts.md).

### Phase 1 — sign agent (Go)

- ☑ Repo `PoliNetworkOrg/esign` (public, MIT; renamed from `sign-agent`), Go module.
- ☑ Popup page + same-origin API (Host check, no cross-site), ticket-based backend client.
- ☑ Session-based providers: `cie-mw` (official PKCS#11, last-4 PIN), `opencie`, `soft`; ordered fallback before PIN.
- ☑ SoftHSM2 PKCS#11 tests in Linux Docker (`scripts/test-softhsm.sh`).
- ☑ Direct PC/SC `cie` provider + card simulator + interop harness (`scripts/interop/run.sh`): the official middleware,
  built unmodified, pairs and signs against the simulator; `cie`, `cie-mw` (also in the worker) and `opencie` sign too.
  Auto-pairing (`AbilitaCIE`/`AbbinaCIE`/`cie_enable`); `PINSent` stops provider fallback. esign PR #2 (merged).
- ☑ Worker subprocess (Rosetta for the x86_64 macOS module, HOME for its pairing cache), install + `polinetwork-esign://`
  scheme, macOS universal .app/.dmg, Windows GUI exe, Linux tar/.deb, CI on 3 OSes, `doctor`. esign PR #1 (merged).
- ☑ Release v0.1.0 (Windows zip, macOS universal .app/.dmg, Linux tar.gz/.deb amd64+arm64). Verified on this Mac:
  loads the installed Software CIE module through the x86_64 worker and sees the BIT4ID reader.
- ☑ Review round 2 agent findings (esign PR #3, merged): EF.SOD validated against pinned Italian CSCA00–05
  before the PIN (`card_untrusted`, no fallback); VERIFY never repeated on 6Cxx. Released v0.1.1.
- ☐ Confirm on a physical CIE that its SOD/EF.DH verify (the direct `cie` provider is tried last, after the official
  middleware and OpenCIE).

### Phase 2 — backend

- ☑ PAdES engine: incremental update (classic xref + xref stream), visible appearance, CMS (PAdES B-B).
- ☑ Validation: poppler `pdfsig` in tests; pyHanko (Docker) judges both signatures VALID with permitted changes.
- ☑ Data model: profiles, requests, signers, documents (versions), jobs, events — migration `0022_esign`.
- ☑ OneDrive drive abstraction (Graph + in-memory mock), browse/download/upload, root containment.
- ☑ Email with attachment (Graph sendMail / dev mailer), signer "your turn" notifications.
- ☑ tRPC router `esign` + ticket-authenticated `/esign/agent/*`; CIE CA trust bundle; cron sweep.
- ☑ Draft PR: PoliNetworkOrg/backend#73. Types package built locally; admin uses it via `file:` until released.

### Phase 3 — admin

- ☑ Permissions `esign:sign`, `esign:requests:manage`; nav service "Signatures"; middlewares; security tests.
- ☑ Agent popup flow (`SignWithCie`): ticket → popup → status polling + postMessage, agent-not-running help.
- ☑ PDF viewer (pdf.js) with zoom, lazy pages, draggable/resizable/keyboard signature boxes.
- ☑ Pages: To sign, Requests, request detail (signers, delivery, activity), New request composer, Setup guide.
- ☑ Agent proxy `/api/esign/agent/*` (CSRF-exempt, ticket paths only).
- ☑ Draft PR: PoliNetworkOrg/admin#102.

### Phase 4 — integration and hardening

- ☑ End-to-end test: dashboard (agent mode) → backend (dev, throwaway Postgres `esign-pg`) → agent (soft token) →
  PDF validated by pdfsig + pyHanko. How to run it: see "Local end-to-end" below.
- ☑ Review round 1 (Sol 6.1): 15 findings (4 high), all fixed with regression tests; Postgres smoke script
  (`backend/scripts/esign-store-smoke.ts`) caught a jsonb double-encoding issue in the new queries.
- ☑ Fallback: upload a PDF signed with the official app (verified as current version + one CIE signature).
  Removed from the dashboard on 2026-10-21: CIE ID rewrites a PDF that has no signature yet, so it never worked for
  the first signer. The backend's `esign.requests.uploadSigned` is no longer called and can be removed.
- ☑ Smart placement (box under "Il Presidente"/role label), navigation badge for documents to sign.
- ☑ Review round 2 (Sol 6.1, Personal account; its safety filter cut the final report, partial notes in
  `/tmp/esign-review-r2b/`): round-1 fixes confirmed; new findings fixed — ByteRange gap must be exactly /Contents,
  change policy for uploaded signatures (`pdf/diff.ts`, checked against a pyHanko signature), retry lease, per-signer
  email size budget, bounded OCSP read, fresh popup per signature, delivery polling, scope switch.
- ☑ Several OneDrive/SharePoint drives (`ESIGN_DRIVES`, backend#74, admin#104).
- ☑ Several places per signer: each place a full signature (one PDF signature each) or a mark (the first signature's
  mark, covered by it); the person appears once in the dashboard (backend#75, admin PR, sign-agent#6).
- ☑ Sign several documents with one PIN: "Sign N together" in To sign opens a document strip to check each, then one
  agent window signs them all (agent protocol 2; older agents are asked to update).
- ☑ Drive access by role or permission (Signatures › Drives): who may request with each drive and who may be asked to
  sign its documents; default unchanged (auth#62 roles + catalog in the snapshot, auth-kit#2, backend, admin).
- ☑ Signer picker lists every registered IdP user with `esign:sign` (filtered by the drives' sign rules), not only
  people who opened Signatures; their profile is created with the request (auth#63, backend#79, admin#113).
- ☑ Sign it yourself: when the creator signs first (or is the only signer), the composer's "Create and sign" / "Sign
  with CIE" creates the request and opens the agent in the same click; To sign has "Sign a document", which starts
  with the creator as first signer (admin only).
- ☐ Create the IdP permission `esign:drives:manage` and grant it to whoever sets drive access (master admins get it).
- ☐ Real-card check that one PIN can make several signatures in a session (`cie-mw`, `opencie`, built-in `cie`).
- ☐ Docs: user guide (install agent, pair CIE), ops (Graph permissions, IdP permissions, env).
- ☐ Setup step 4 (`src/features/esign/setup-page.tsx`) says the status page "should show that PoliNetwork eSign is
  running and ready to sign", which fits both v0.3.0 ("The agent is running") and the readiness status page of the next
  agent release ("Ready to sign" once reader, card and software check out). Once that release is out, the step can
  quote "Ready to sign".
- ☐ Setup page: its inline links (the ArchWiki guide, opencie) still differ from the text by color only; give them
  `inlineLink`, like the request and batch pages (`feat/esign-dec-setup` rewrites that page, so at integration).

## Manual steps for the maintainer (cannot be automated here)

- ☑ Create IdP permissions `esign:sign` and `esign:requests:manage` and grant them. They only reach the backend once
  auth#61 adds `esign:` to the backend projection.
- ☐ Azure app registration: Graph application permission `Files.ReadWrite.All` (or `Sites.Selected`) + admin consent;
  `Mail.Send` already used.
- ☐ Set `ESIGN_DRIVES` on the backend: one `{id, label, driveId, rootId?}` per OneDrive/SharePoint library the
  dashboard may use (backend README). Several drives are supported (backend#74).
- ☐ Test with a real CIE + reader on macOS/Windows/Linux. This Mac already has Software CIE and a BIT4ID miniLector AIR
  NFC v3 reader: run the local end-to-end below without `--soft`, place the CIE on the reader and sign (expect a macOS
  "access data from other apps" prompt the first time, and Rosetta for the official module).
- ☐ Code signing (pipeline ready, esign PR #4; steps in esign `docs/code-signing.md`):
  - macOS: upload `~/dev/polinetwork/.signing/esign/developer-id.csr` as a Developer ID Application certificate on
    the PoliNetwork APS Apple account (team 842636PS9J), create an App Store Connect API key, run
    `scripts/setup-macos-signing.sh secrets …`, tag a release, then drop the Open Anyway sentence from
    AGENT_STEPS.macos in src/features/esign/setup-page.tsx.
  - Windows: apply to SignPath Foundation (free for open source), then set the SIGNPATH_* variables and token, then
    drop the Run anyway sentence from AGENT_STEPS.windows.
- ☑ Backend released as @polinetwork/backend 1.7.0 (backend#73 merged); admin uses it (vendored copy removed).
- ☐ Before deploying Setup's "Download for macOS" / "Download for Windows" and the signing dialog's "Update
  PoliNetwork eSign" state (agents too old to sign): publish an agent release that ships
  `PoliNetwork-eSign-macos.dmg` and `PoliNetwork-eSign-windows-amd64.zip` (esign "publish the macOS and Windows
  downloads under fixed names"), tagged `vX.Y.Z` with no suffix, so it is not a pre-release and becomes
  `releases/latest`. Then check that both names answer 200:
  `curl -sL -o /dev/null -w '%{http_code}\n' https://github.com/PoliNetworkOrg/esign/releases/latest/download/<name>`.
  Until then they answer 404, and these links, which open in the same tab (a real download leaves the page in place),
  replace the dashboard, and the signing dialog with it, with GitHub's 404 page.

## Local end-to-end

```sh
docker start esign-pg esign-redis   # throwaway Postgres (127.0.0.1:55433) and Redis (56379)
cd ~/dev/polinetwork/.esign-worktrees/backend && bun ./src/server.ts      # .env.local: PORT=13000, DB on 55433
cd ~/dev/polinetwork/admin && PORT=10431 AGENT_MODE=true BACKEND_URL=http://localhost:13000 pnpm exec vp dev --port 10431
cd ~/dev/polinetwork/sign-agent && go run ./cmd/esign --dev --soft    # PIN 12345678 (on this Mac: SDKROOT=…/MacOSX26.sdk)
```

Open `http://localhost:10431/dashboard/esign/requests` (use `localhost`, not `127.0.0.1`: the dev CSRF origin).

## Log

- 2026-10-21: decisions round, request and batch pages (admin `feat/esign-dec-signing`; not pushed): one action card
  holds the title, the status, one sentence and the request's actions, and on desktop the right column stays put while
  the cards under it scroll; "Move box" moved into the viewer's toolbar; phones and tablets only review; declined and
  cancelled requests offer "Send again" (`/dashboard/esign/new?from=`, which the composer branch fills in); the upload
  fallback is gone; the agent proxy forwards PoliNetwork eSign's User-Agent, so the backend can refuse versions too old
  to sign. The signing dialog listens for the agent's `ready` and fatal errors (older agents through the job's `seen`),
  says within 2.5 s when PoliNetwork eSign isn't running (Start for a browser that has run it, Install otherwise), asks
  for an update with a direct download when the agent is too old, and hands off after signing: the page updates
  behind it, then the agent window and the dialog close and the box dissolves into the stamp. The `ready` and fatal
  messages need the next agent release; until then the dashboard follows `seen`. Copy kept on purpose: a missing
  CIE ID module reads "CIE ID isn't set up on this computer" / "Follow the setup guide, then sign again.", as the
  agent window says it, not "isn't installed" (CIE ID can be installed with its module out of reach, e.g. without
  Rosetta); the lock line is one line ("Mario Rossi is signing right now."), so the card keeps its height; the To sign
  and requests lists keep "Requested by {name}", the only place a row says who asks (removed from the request and
  batch pages only).

- 2026-10-21: UX pass (admin `feat/esign-ux-pass`, backend `fix/esign-ux`, agent `fix/sign-page-ux`; not pushed): the
  signing dialog says how an attempt ended and notices a closed or silent eSign window, jobs and agent windows end on
  errors a retry can't fix, plus composer, request, batch, setup and Overview polish. Admin follow-ups after the backend
  release: the lock alert's "by HH:MM" from `signingNow.until`; `lostAccess` on the signer card and the drive-access
  impact confirmation before saving a sign rule. Open product decisions: `~/dev/polinetwork/esign-ux-decisions-2026-10-21.html` (outside the repo).

- 2026-10-17: merged backend#75 (released @polinetwork/backend 1.9.0), sign-agent#6 (released PoliNetwork eSign
  v0.2.0) and admin#105; the upload fallback warns signers with several places. Flux rolls out the new images.

- 2026-10-17: several places per signer and batch signing with one PIN (backend#75, sign-agent#6, admin PR); merge
  order: backend → bump admin → agent release v0.2.0 together with the backend deploy (protocol 2).

- 2026-10-17: backend#73 merged (released @polinetwork/backend 1.7.0), admin#102 merged; agent v0.1.1; code-signing
  pipeline merged (esign #4).

- 2026-10-17: kickoff; branches created; research started.
- 2026-10-17: PAdES engine done and validated; agent refactored to popup + ticket flow; agent repo published;
  subagents A (direct CIE) and B (packaging) started.
- 2026-10-17: backend orchestration + admin UI done; first full E2E sign succeeded; draft PRs backend#73, admin#102;
  Sol 6.1 review round 1 started.
