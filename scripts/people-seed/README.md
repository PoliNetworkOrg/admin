# People seed

A one-off script that fills People with records and roles from the 2026 admin census spreadsheets. An agent turns
the spreadsheets into a seed file, a person reviews it, and the script writes it through the backend's `people.*` API
as the signed-in person. It replaces the bulk import planned for Phase 1 (PoliNetworkOrg/admin#141,
PoliNetworkOrg/backend#103), which we dropped. From Phase 3 on, the census runs in the dashboard
(PoliNetworkOrg/admin#145).

- [`AGENT_PROMPT.md`](AGENT_PROMPT.md): the prompt to give the agent once the spreadsheets are ready.
- [`seed-plan.ts`](seed-plan.ts): the seed file's format and the planning: who matches an existing record, which calls
  to make, and what stops the run. Tested in `tests/people-seed.test.mjs`.
- [`seed.ts`](seed.ts): signs in, plans, applies, sends invites.
- [`example.json`](example.json): a seed file with a Capo Admin, an admin under them and a row matched by hand.

Keep the spreadsheets and the seed file in `data/`: it's the only folder Git ignores here, and they hold personal
data. A spreadsheet or seed file anywhere else, beside the script included, can be committed by mistake. The script
writes its own files next to the seed file, so they land in `data/` too.

## What the script does, and doesn't

- It **creates** records and **starts** roles: Admin, Capo Admin (who must also be an Admin), Capo Admin of reference,
  team member or Lead. It never edits a record's fields and never ends a role. Anything that needs either goes through
  the dashboard.
- It looks for each row's existing record, in this order: the record created for that row by an earlier run
  (`<file>.state.json`), the row's `existingId`, then the contact email. A row with the same name as an existing
  record stops the run until the row says `existingId` (same person) or `newRecord: true` (someone else). Names are
  never used to merge anything.
- It checks everything before writing anything: same key, email or name twice in the file, a Capo Admin who isn't an
  Admin, a reference to someone who isn't a Capo Admin, a second Lead for a team, a different team role than the one
  held. Any of these stops `--apply`.
- It can run again safely: what is already done is skipped, so a failed or interrupted run is fixed by running again.
- Unlinked records keep their roles `pending` in the backend: nothing reaches PoliNetwork Auth until the person
  accepts an invite. Roles on already-linked records go to Auth, which can refuse them. The record shows the reason.
- The backend checks every call against your permissions, exactly as it does in the dashboard: `people:read` and
  `people:write`, plus `people:appoint` for Capo Admins and Leads.

## Running it

### 1. A temporary sign-in application

The script signs you in like the dashboard does, through a loopback redirect. Register a temporary application in
PoliNetwork Auth. Only a Master Admin can do this, because it uses an API scope. Use the Auth website, or ask an agent
with the Auth MCP to call `create_application` with:

| Field             | Value                             |
| ----------------- | --------------------------------- |
| `name`            | `People seed (temporary)`         |
| `applicationType` | `native`                          |
| `credential`      | `public`                          |
| `redirectUris`    | `http://127.0.0.1:53682/callback` |
| `scopes`          | `openid`, `offline_access`        |
| `apiScopes`       | `backend:admin`                   |
| `resources`       | `backend`                         |

If Auth refuses API scopes for a public client, use `credential: secret` and set `SEED_CLIENT_SECRET`. Delete the
application when the import is done.

### 2. Environment

```sh
export SEED_CLIENT_ID=…                  # from step 1
export BACKEND_URL=https://…             # the backend the production dashboard uses; no default
# Optional: IDP_URL (https://auth.polinetwork.org), BACKEND_RESOURCE, SEED_CLIENT_SECRET, SEED_REDIRECT_PORT (53682)
```

### 3. Plan, apply, invite

Each run opens the browser for you to sign in. Access tokens last five minutes, and the script refreshes them as it
goes.

```sh
node scripts/people-seed/seed.ts scripts/people-seed/data/census-seed.json            # plan: <file>.plan.json
node scripts/people-seed/seed.ts scripts/people-seed/data/census-seed.json --apply    # write: <file>.report.json
node scripts/people-seed/seed.ts scripts/people-seed/data/census-seed.json --invite   # email the invites
```

- **Plan** reads People and lists each row's match, every call and any problems. It writes nothing.
- **Apply** refuses to start while there are problems. It records each new record in `<file>.state.json` as soon as
  it's created, and refuses a state file written for another `BACKEND_URL`, whose IDs would match the wrong people.
  Keep that file until the import is finished. If a create gets no answer, or an error other than a refusal
  (permissions, invalid input), the next plan asks you to check whether that record exists, and to set `existingId`
  if it does.
- **Invite** sends an invite to every row with `invite` (default `true`) whose record has a contact email, isn't
  linked and has no open invite. An invite that expired, or expires today, is sent again, which revokes the old
  link. It refuses to run while the plan has problems. These are emails to real people: run it only once the records
  look right in the dashboard.

Afterwards, check People › Overview and Admins in the dashboard, then delete the application from step 1 and the
files in `data/`.
