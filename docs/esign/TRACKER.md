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
- ☑ Smart placement (box under "Il Presidente"/role label), navigation badge for documents to sign.
- ☑ Review round 2 (Sol 6.1, Personal account; its safety filter cut the final report, partial notes in
  `/tmp/esign-review-r2b/`): round-1 fixes confirmed; new findings fixed — ByteRange gap must be exactly /Contents,
  change policy for uploaded signatures (`pdf/diff.ts`, checked against a pyHanko signature), retry lease, per-signer
  email size budget, bounded OCSP read, fresh popup per signature, delivery polling, scope switch.
- ☐ Docs: user guide (install agent, pair CIE), ops (Graph permissions, IdP permissions, env).

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
    `scripts/setup-macos-signing.sh secrets …`, tag a release.
  - Windows: apply to SignPath Foundation (free for open source), then set the SIGNPATH_* variables and token.
- ☑ Backend released as @polinetwork/backend 1.7.0 (backend#73 merged); admin uses it (vendored copy removed).

## Local end-to-end

```sh
docker start esign-pg esign-redis   # throwaway Postgres (127.0.0.1:55433) and Redis (56379)
cd ~/dev/polinetwork/.esign-worktrees/backend && bun ./src/server.ts      # .env.local: PORT=13000, DB on 55433
cd ~/dev/polinetwork/admin && PORT=10431 AGENT_MODE=true BACKEND_URL=http://localhost:13000 pnpm exec vp dev --port 10431
cd ~/dev/polinetwork/sign-agent && go run ./cmd/esign --dev --soft    # PIN 12345678 (on this Mac: SDKROOT=…/MacOSX26.sdk)
```

Open `http://localhost:10431/dashboard/esign/requests` (use `localhost`, not `127.0.0.1`: the dev CSRF origin).

## Log

- 2026-10-17: backend#73 merged (released @polinetwork/backend 1.7.0), admin#102 merged; agent v0.1.1; code-signing
  pipeline merged (esign #4).

- 2026-10-17: kickoff; branches created; research started.
- 2026-10-17: PAdES engine done and validated; agent refactored to popup + ticket flow; agent repo published;
  subagents A (direct CIE) and B (packaging) started.
- 2026-10-17: backend orchestration + admin UI done; first full E2E sign succeeded; draft PRs backend#73, admin#102;
  Sol 6.1 review round 1 started.
