# Regolamenti

The dashboard side of the regulations editor: edit, approve, publish and notify PoliNetwork's governance documents
(v1: the Raccolta dei Regolamenti Interni) instead of hand-editing LaTeX on GitHub. The shared spec, decided with the
owner for every repository involved, is the source of truth:
`regulations-editor-spec.md` (kept outside the repositories, next to the checkouts). The LaTeX grammar is
PoliNetworkOrg/legal `docs/grammar.md`.

The UI is in Italian, the only part of the dashboard that is: the documents, the procedure and the people who use it
are. Code, comments and commits stay in English. Shared primitives that print their own words (`FormDialog`, `Count`,
`DateField`) take an Italian variant (`locale="it"`, `placeholder`); a few shared table words ("Actions", pagination)
stay English.

## Pages

| Path                                          | Page                    | Opens with                                            |
| --------------------------------------------- | ----------------------- | ----------------------------------------------------- |
| `/dashboard/regulations`                      | Documenti               | `regulations:read`                                    |
| `/dashboard/regulations/documents/$key`       | Versions and drafts     | `regulations:read`                                    |
| `/dashboard/regulations/drafts`               | Bozze                   | `regulations:read`, a draft assignment, or a delega   |
| `/dashboard/regulations/drafts/$id`           | Editor                  | as Bozze; the backend answers only for visible drafts |
| `/dashboard/regulations/drafts/$id/procedure` | Procedure, members      | as Bozze                                              |
| `/dashboard/regulations/drafts/$id/diff`      | Differences (read-only) | as Bozze                                              |
| `/dashboard/regulations/drafts/$id/merge`     | Merge another draft     | `regulations:write`                                   |
| `/dashboard/regulations/deleghe`              | Deleghe                 | `regulations:rectify` (Segretario)                    |

Every section but Bozze also needs `admin:access`, like the rest of the dashboard.

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
Procedures: `me.get`, `documents.list|get|sync`, `versions.list|pdf`, `drafts.list|get|files|create|rename|delete|transition`,
`assignments.list|set|remove`, `users.search`, `collabTicket`, `compile.status|pdf`, `snapshots.list|get|create|restore`,
`comments.list|create|reply|resolve|reopen|delete`, `merge.preview|execute`, `diff.get|regenerate|pdf`,
`emanation.get|start|retry`, `deleghe.list|create|revoke`. Files (PDFs) come back as `{ fileName, contentType, base64 }`
because the browser never reaches the backend. Refusals carry an Italian message shown as is; input validation and the
policy's English denials get the page's own message (`failureMessage`).

## Collaboration

The text of a draft lives in the collab service (Hocuspocus): document name = draft id, `ydoc.getMap("files")` maps
each source path to its `Y.Text`. The browser connects with a single-use ticket from `issueCollabTicket` (a server
function, so no IdP token reaches the browser), asked again on every reconnect. Stateless messages: `compile` (a new PDF
for a source hash) and `state` (the draft froze or reopened: the editor drops its provider and Y.Doc and connects again
with a new ticket). The server inserts missing node ids about 1.5 s after typing stops.

## Agent mode

`regulations.fake.server.ts` answers every procedure with the backend's rules over an in-memory store (seeded by
`regulations.fixtures.server.ts`: three drafts, two versions, a delega, a comment). It runs a real Hocuspocus server and
compiles with the machine's `xelatex` (`regulations.dev-collab.server.ts`), on `PORT + 1` (override with
`REGULATIONS_DEV_COLLAB_PORT`), only in development builds.

- `PORT=1xxxx AGENT_MODE=true pnpm dev`: everything, as a Direttivo member with every permission.
- `AGENT_PERMISSIONS=none`: no permissions; the agent is still an editor of one sample draft and a commenter of another,
  so the dashboard opens Bozze only, as for an invited Socio.
- `REGULATIONS_DEV_LEGAL_DIR=<checkout of PoliNetworkOrg/legal>`: the fake serves the real RRI sources and compiles them
  with the real class and fonts (they stay on the machine; the scripted draft edits and comments then don't apply).
  The parser test also reads the grammar's own example from there.

The dev compiler has no sandbox; the real compile worker does.

## Against a local backend

`AGENT_BACKEND_TOKEN=<bearer>` makes agent mode send that token to `BACKEND_URL` (default `http://localhost:3000`)
instead of none: access comes from the backend's `me.access` and Regolamenti calls the backend, not the fake. The
backend's local stack mints such tokens with its dev IdP shim for seeded accounts (Segretario, Direttivo, an editor and
a commenter with no permissions). Run one dev server per account, on two ports, to see two people edit one draft.
Signing in for real (`AGENT_MODE=false`) needs a development OIDC client on auth.polinetwork.org allowed the backend
resource, and a backend able to read access snapshots: both are registrations and secrets only the owner can provide.
