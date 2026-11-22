# Regolamenti

The dashboard side of the documents editor: every PoliNetwork document, written, approved, published and notified
here instead of hand-editing LaTeX on GitHub. The shared spec, decided with the owner for every repository involved, is
the source of truth: `regulations-editor-spec.md` (kept outside the repositories, next to the checkouts; the documents
are its "Addendum 2026-11-22"). The documents live in PoliNetworkOrg/documents (formerly `legal`, manifest
`documents.json`); its LaTeX grammar for regolamenti is `docs/grammar.md` there.

The UI is in Italian, the only part of the dashboard that is: the documents, the procedure and the people who use it
are. Code, comments and commits stay in English. Shared primitives that print their own words (`FormDialog`, `Count`,
`DateField`) take an Italian variant (`locale="it"`, `placeholder`); a few shared table words ("Actions", pagination)
stay English.

## Pages

| Path                                          | Page                    | Opens with                                            |
| --------------------------------------------- | ----------------------- | ----------------------------------------------------- |
| `/dashboard/regulations`                      | Documenti, by kind      | `regulations:read`                                    |
| `/dashboard/regulations/documents/$key`       | Versions and drafts     | `regulations:read`                                    |
| `/dashboard/regulations/drafts`               | Bozze                   | `regulations:read`, a draft assignment, or a delega   |
| `/dashboard/regulations/drafts/$id`           | Editor                  | as Bozze; the backend answers only for visible drafts |
| `/dashboard/regulations/drafts/$id/procedure` | Procedure, members      | as Bozze                                              |
| `/dashboard/regulations/drafts/$id/diff`      | Differences (read-only) | as Bozze                                              |
| `/dashboard/regulations/drafts/$id/merge`     | Merge another draft     | `regulations:write`                                   |
| `/dashboard/regulations/deleghe`              | Deleghe                 | `regulations:rectify` (Segretario)                    |

Every section but Bozze also needs `admin:access`, like the rest of the dashboard.

## Documents

`documents.list` gives each document a `kind`, and Documenti has a section per kind, in this order:

| Kind            | What                                                                       | Document page                                                                 |
| --------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `regolamento`   | the RRI (procedure `rri`) and documents from the `regolamento` template    | RRI: the full procedure; from the template: as a documento                    |
| `generale`      | repository documents with procedure `documento`                            | versions (release links), drafts, "Nuova bozza"                               |
| `privato`       | backend only, never on GitHub: from a template, or an uploaded PDF         | from a template: as a documento, no releases; upload: "Carica nuova versione" |
| `consultazione` | repository documents without a procedure (Statuto, Regolamento Elettorale) | "Apri il PDF" and "Scarica il PDF" only: no drafts anywhere                   |

- **Procedures.** `rri`: bozza → in approvazione → approvata → emanata, delibera, LLM differences, Soci notice,
  rettifiche and deleghe. `documento`: bozza → pubblicata, "Pubblica" (`regulations:manage`, through `emanation.start`):
  no delibera, differences or notices; a repository document goes through the App (pull request, CI, tag, release), a
  private one is saved at once. Button labels come from the procedure (`finalStepLabel`), never from the page.
- **New documents** (`regulations:manage`): "Nuovo documento" creates one from a template of `templates.list`
  (repository: a pull request, the document listed "In creazione" with its link until it merges, then active; the list
  reloads every 15 s meanwhile; a closed one is "Non creato", with "Crea di nuovo") or private (opened at once); "Carica
  un PDF" makes a private read-only document. The key is a slug of the title until edited, checked like the backend.
- **Import.** "Importa dal repository" runs `documents.sync` and lists what it skipped, with the backend's reason, above
  the sections until the page is left.
- **PDFs.** Every PDF opens in `PdfDialog` (versions, the latest of a sola consultazione document, uploads, the
  editor's preview "Apri a tutta altezza", the differences), with Download in its toolbar.
- Pages act on the document's `editable`, the draft's `can` and the IdP permissions, never on a kind alone.

## Access

- **IdP permissions** (`src/server/permissions.ts`): `regulations:read` sees everything as a viewer, `regulations:write`
  (Direttivo) creates drafts, assigns members, edits, merges and sends to approval, `regulations:manage` (Presidente,
  Segretario) records the approval, emanates and regenerates the diff, `regulations:rectify` (Segretario) rectifies and
  manages deleghe.
- **Per-draft access is backend data.** Anyone with an IdP account can be assigned to a draft as viewer, commenter or
  editor, and a delega lets anyone rectify. `loadAccess` admits a user without `admin:access` or `people:self` when
  `regulations.me.get` reports an assignment or a delega; `/dashboard` then shows them only Regolamenti › Bozze
  (`peopleRoles.regulations`, the `regulations` section role in `nav.ts`), and the logo leads there.
- **Middleware** (`src/server/auth.middleware.ts`): `regulationsReadMiddleware`, `regulationsWriteMiddleware`,
  `regulationsManageMiddleware` and `regulationsRectifyMiddleware` check the permission; draft-scoped calls (collab
  ticket, comments, snapshots, rename and delete, rettifiche) use `regulationsAssigneeMiddleware`, which admits any
  dashboard user because only the backend knows the assignments. Pages show actions from the draft's `can`, which the
  backend computes, never from rules of their own.

## Backend contract

`src/features/regulations/regulations.contract.ts` is a verbatim copy of the backend's `src/regulations/contract.ts`
(PoliNetworkOrg/backend#110); `regulations.api.server.ts` maps one method to each procedure and parses every response.
Procedures: `me.get`, `documents.list|get|sync|create|upload`, `templates.list`, `versions.list|pdf|upload`, `drafts.list|get|files|create|rename|delete|transition`,
`assignments.list|set|remove`, `users.search`, `collabTicket`, `compile.status|pdf`, `snapshots.list|get|create|restore`,
`comments.list|create|reply|resolve|reopen|delete`, `merge.preview|execute`, `diff.get|regenerate|pdf`,
`emanation.get|start|retry`, `deleghe.list|create|revoke`. Files (PDFs) come back as `{ fileName, contentType, base64 }`
because the browser never reaches the backend; uploads go the other way as `FormData` through a server function
(`uploadRegulationDocument`, `uploadRegulationVersion`), which the backend client sends on its own request. Refusals carry an Italian message shown as is; input validation and the
policy's English denials get the page's own message (`failureMessage`).

## Procedure

The draft's `can.transitions` lists the steps the caller may take now; a step that is not possible yet comes with
`blockedBy` and shows disabled with its reason (text that doesn't parse, another draft in approval, a base superseded by
a newer version). "Registra l'approvazione" asks for the delibera. "Riporta in bozza (annulla l'approvazione)" takes an
approved draft back (`regulations:manage`, through `withdrawApproval`): the delibera stops counting and a new approval is
needed. "Emana e notifica" (or "Emana rettifica") runs on the backend and the page follows its steps; when it can't
start, `can.emanateBlockedBy` says why.

## Collaboration

The text of a draft lives in the collab service (Hocuspocus): document name = draft id, `ydoc.getMap("files")` maps
each source path to its `Y.Text`. The browser connects with a single-use ticket from `issueCollabTicket` (a server
function, so no IdP token reaches the browser), asked again on every reconnect. Stateless messages: `compile` (a new PDF
for a source hash) and `state` (the draft froze or reopened: the editor drops its provider and Y.Doc and connects again
with a new ticket). The server inserts missing node ids about 1.5 s after typing stops.

## Agent mode

`regulations.fake.server.ts` answers every procedure with the backend's rules over an in-memory store (seeded by
`regulations.fixtures.server.ts`: the RRI with three drafts, two versions, the older one an untagged import labelled as
the backend labels it, `import d08cb57`, a delega, a comment; the Guida della Matricola, a documento generale with a
published draft and an open one; a private document from the generale template; an uploaded PDF with two versions;
Statuto and Regolamento Elettorale, sola consultazione; a repository document "In creazione" and one whose pull request
was closed). A repository document created in agent mode turns active 20 s later, as if its pull request merged; a
private documento publishes at once. Version PDFs are compiled from their sources (stand-ins for the `polinetwork-regolamento` and `polinetwork` classes),
uploads are the uploaded file and the sample uploads are compiled from LaTeX; the differences PDF,
which the backend typesets, is stood in for by the draft's own compiled text, so the PDF viewer always has a real file. It runs a real Hocuspocus server and
compiles with the machine's `xelatex` (`regulations.dev-collab.server.ts`), on `PORT + 1` (override with
`REGULATIONS_DEV_COLLAB_PORT`), only in development builds.

- `PORT=1xxxx AGENT_MODE=true pnpm dev`: everything, as a Direttivo member with every permission.
- `AGENT_PERMISSIONS=none`: no permissions; the agent is still an editor of one sample draft and a commenter of another,
  so the dashboard opens Bozze only, as for an invited Socio.
- `REGULATIONS_DEV_LEGAL_DIR=<checkout of PoliNetworkOrg/documents or legal>`: the fake serves the real RRI sources and
  compiles them with the real class and fonts (they stay on the machine; the scripted draft edits and comments then don't apply).
  The parser test also reads the grammar's own example from there.

The dev compiler has no sandbox; the real compile worker does.

## Against a local backend

`AGENT_BACKEND_TOKEN=<bearer>` makes agent mode send that token to `BACKEND_URL` (default `http://localhost:3000`)
instead of none: access comes from the backend's `me.access` and Regolamenti calls the backend, not the fake. The
backend's local stack mints such tokens with its dev IdP shim for seeded accounts (Segretario, Direttivo, an editor and
a commenter with no permissions). Run one dev server per account, on two ports, to see two people edit one draft.
Signing in for real (`AGENT_MODE=false`) needs a development OIDC client on auth.polinetwork.org allowed the backend
resource, and a backend able to read access snapshots: both are registrations and secrets only the owner can provide.

Against the backend's local stack (its `docs/regulations-dev.md`, `REGULATIONS_LEGAL_DIR` a checkout of the documents
repository), `AGENT_BACKEND_TOKEN=$(curl -s 'http://localhost:4300/dev/token?sub=dev-segretario')` exercises import,
creation (its fake GitHub merges a pull request after a few seconds), uploads, the viewer and "Pubblica" end to end.

## Known gaps

- The editor lists and switches the source files but doesn't add, rename or remove them; new regolamenti go in an
  existing file until it does.
- A few words of shared primitives stay English: the `DataTable` "Actions" header and the pagination.
