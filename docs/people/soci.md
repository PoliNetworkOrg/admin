# Soci: the member register and the association fee (Phase 2)

The design for roadmap Phase 2 (#144, roadmap #146), agreed with the owner on 9 November 2026. It replaces the
Member register, Receipts and My area fee-card mockups, and supersedes [`fees.md`](fees.md), which stays only as a
reference for the old design.

## Goal

The dashboard becomes PoliNetwork's **Libro Soci**: who is or was a socio, with the data the association must keep,
the yearly fee and how the status ends. Microsoft 365 stays the source of truth for **who is a socio now**: a socio is
a PoliNetwork account in the Soci group, and Auth derives the Socio role from that group. The register holds what
Microsoft 365 doesn't: bookkeeping data, fees and history.

## Decisions

Owner decisions, 9 November 2026:

1. **Lapse is automatic.** A socio who hasn't paid the fee by the deadline loses the status: the backend removes their
   account from the Soci group, so Auth drops the Socio role. The account itself is kept and listed under **Deletion
   pending**, where a person deletes it by hand. Deleting the account releases its licences.
2. **Fee flow:** the socio pays by bank transfer and uploads the bank's transfer receipt in My area, then the Direttivo
   confirms it and the fee is paid. Without an upload, the Direttivo can **Mark as paid** by hand. Any channel other
   than a transfer is an edge case handled by hand through Mark as paid.
3. **No receipts issued by the association** in this phase: no numbered PDF, no CIE signing. The socio's uploaded
   transfer receipt is the record of payment.
4. **Soci get `people:self`.** My area is the one place for everything about one's own association life: People roles
   and the Socio card side by side, even though the data comes from different places.
5. **Fee rules are hard-coded** from the Regolamento Interno (below), not configurable.
6. **The Direttivo does everything**: one set of `soci:*` permissions, granted to `direttivo`.
7. **Soci stay under People**, the area for everyone inside the association, but separated visually: the panel groups
   People's sections into **Volunteers** and **Soci**.
8. **History is kept forever, member numbers are never reused, and the register starts empty**: no historical data is
   imported. Existing soci are registered from Microsoft 365 (see [Starting the register](#starting-the-register)).
9. **Emails are automatic and always go to the PoliNetwork mailbox.** Every socio has one, since being a socio means
   one's PoliNetwork account is in the Soci group.
10. **The register holds the bookkeeping data:** legal name, optional alias, codice fiscale, place and date of birth,
    residence address, admission date and end date with its reason.
11. **Admitting a socio moves from Microsoft 365 › Members to People › Soci.** It keeps today's account workflow
    (account, licences, Soci group, welcome email) and collects the bookkeeping data in the same dialog. Changing a
    member number moves too. Microsoft 365 › Members becomes a read-only directory.
12. **Birthday emails** to every active socio, sent by the backend.

Choices made while designing, to confirm or overturn while reviewing the issues:

- **Admission records the first fee as paid.** The Direttivo admits someone after they've paid, so admission records
  the current fee year as paid on the admission date. Someone admitted from 1 June to 31 August is exempt from the next
  fee year, as the Regolamento says.
- **The lapse end date is 31 December**, the renewal deadline, applied by the job on 1 January.
- **An upload waiting for review at the deadline protects the socio** until it's reviewed. A rejection after the
  deadline lapses them at the next daily run, and the reject dialog says so.
- **Re-admission is a new entry with a new number.** The register flags the earlier entry with the same codice
  fiscale.
- **Date of birth is stored**, because the birthday emails need it. It's checked against the codice fiscale.
- **Deletion is a dashboard action**, one account at a time, behind its own permission `soci:delete`.
- **Automatic lapse starts switched off** (`SOCI_AUTO_LAPSE`), and stays off until the register is complete. Otherwise
  the first run would remove every existing socio who has no record yet. The register previews who would lapse.
- **Restore** undoes an ended status while the account still exists. It's for mistakes, and needs a reason.

## Fee rules (hard-coded)

From the Regolamento Interno, § Quota associativa:

| Rule             | Value                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| Amount           | €5.00 per fee year                                                                                       |
| Fee year         | 1 September Y – 31 August Y+1, written `2026/27`                                                         |
| Renewal deadline | 31 December Y                                                                                            |
| Exemption        | Admitted from 1 June to 31 August: no fee for the next fee year                                          |
| Leaving          | Whoever resigns by 31 August owes nothing for the next year: their status has ended, so no fee is opened |

Payment reference: `Quota 2026/27 0344 Nome Cognome`. The bank details (IBAN, beneficiary) are configuration
(`SOCI_IBAN`, `SOCI_BENEFICIARY`), not rules.

## Lifecycle

```
admit ──► Active ──(fee year opens, 1 Sep)──► fee Due ──upload──► To review ──confirm──► Paid
                                                 ▲                    │
                                                 └──── reject ────────┘
Active ──(1 Jan, fee still Due)───────────► Ended: lapsed ─┐
Active ──(Direttivo: resigned / expelled / deceased / other)► Ended ───┤──► account: Pending deletion ──delete──► Deleted
                                                                      └── restore (mistakes only) ──► Active
```

- **Fee year opens** (1 September, daily job, idempotent): every active socio gets a fee for the new year, Due or
  Exempt. The socio receives the opening email.
- **Ending** removes the account from the Soci group at once (Auth drops the Socio role within about a minute, and
  issued tokens expire within 5 minutes) and puts the account in Deletion pending. Ending sets the end date, the reason
  and a note. Reasons: `lapsed` (only the job), `resigned`, `expelled`, `deceased`, `other`.
- **Delete account** deletes the Microsoft 365 user, one at a time with a confirmation. The record keeps the account's
  object ID, mailbox and deletion date.

## Data (backend, table prefix `soci_`)

- **`soci_members`**: one row per admission, never deleted.
  - `number` (unique, never reused) and `entra_object_id` (unique). The mailbox and display name are snapshots, kept
    after deletion.
  - Legal first and last name; `alias` (optional, the name the person goes by: shown with the legal name, used to greet
    them in emails).
  - `codice_fiscale` (format, check digit and omocodia validated; at most one active record per code), `birth_date`,
    `birth_place` (comune, or city and country).
  - Residence: street and number, postal code, city, province (Italy only), country.
  - `admitted_on`; `ended_on`, `end_reason`, `end_note`.
  - Account state: `active` | `pending_deletion` | `deleted`, with `account_deleted_on`.
  - Created and updated by and at.
- **`soci_fees`**: one row per socio and fee year (unique).
  - Status: `due` | `uploaded` | `paid` | `exempt`, plus the amount (500 cents).
  - The upload: file, transfer date, declared amount, uploaded at.
  - The review: by, at, rejection reason (a rejection returns the fee to `due` and keeps the last reason).
  - The payment: paid on, method (`transfer` | `admission` | `other`), note, recorded by.
- **`soci_files`**: uploaded transfer receipts in Postgres (`bytea`), as the removed `people_files` did: PDF, PNG or
  JPEG up to 10 MB, content sniffed. Kept as payment records, never expired.
- **`soci_activity`**: append-only history of every change, per socio.
- **`soci_mail`**: an outbox with an idempotency key per email (`reminder:2026:dec-1:<id>`), drained by the existing
  every-minute job, so a job that runs twice never sends twice.

Member numbers: a number is free only if no `soci_members` row has ever held it and no Microsoft 365 user has it as
`employeeId`. The old in-process `serializeMemberWrite` lock and pending-number cache stay for the Entra side.

## Backend procedures (`soci.*`)

| Procedure                                                                           | Policy                         |
| ----------------------------------------------------------------------------------- | ------------------------------ |
| `members.list`, `members.get` (record, fees, activity), `members.unregistered`      | `admin:access` + `soci:read`   |
| `members.admit` (Entra account + record + first fee), `members.register` (existing) | `admin:access` + `soci:write`  |
| `members.update`, `members.setNumber`, `members.end`, `members.restore`             | `admin:access` + `soci:write`  |
| `fees.list` (by year and status), `fees.file`                                       | `admin:access` + `soci:read`   |
| `fees.confirm`, `fees.reject`, `fees.markPaid`                                      | `admin:access` + `soci:write`  |
| `accounts.pendingDeletion`, `lapse.preview`                                         | `admin:access` + `soci:read`   |
| `accounts.delete`                                                                   | `admin:access` + `soci:delete` |
| `me.get`, `me.uploadReceipt`, `me.completeDetails`                                  | `people:self` + Entra identity |

`me.*` finds the socio by the signed-in account's Microsoft 365 object ID, which Auth adds to the access snapshot
(auth issue). Without it, `me.get` answers "not a socio". `me.completeDetails` only fills fields that are still empty;
anything already recorded is changed by the Direttivo.

`members.admit` runs the existing create workflow: user, `employeeId`, licences, Soci group, cleanup on failure, and the
welcome email to the address the Direttivo types (not stored). Only then does it write the record. If the record can't
be written, the account is deleted, like any other failed setup step. `azure.members.create` and
`azure.members.setAssocNumber` are removed once the dashboard has switched.

New directory operations (Graph, plus the mock directory): remove a user from the Soci group, add an existing user back
(Restore), delete a user, and read `createdDateTime` (the suggested admission date when registering an existing socio).

## Jobs and emails

Daily jobs (`src/cron.ts`, single instance; every step is idempotent):

| When              | What                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| 1 September       | Open the fee year: Due or Exempt for every active socio; opening email with amount, IBAN, reference |
| 1 and 21 December | Reminder to every socio whose fee is Due (not To review)                                            |
| From 1 January    | With `SOCI_AUTO_LAPSE=true`: lapse every socio whose fee is still Due; lapse email                  |
| Every day, 08:00  | Birthday email to active soci born on that day (29 February: 28 February in other years)            |

Event emails: fee confirmed, fee rejected (with the reason). They are Italian React Email templates, sent from the
usual sender to the PoliNetwork mailbox, and greet the alias when there is one.

## Dashboard

People's panel, in two groups (a new optional `group` on `Section`; the panel draws the group title, the mobile pills
only keep the order):

- **Volunteers:** Overview, Admins, Teams, Census, Linking.
- **Soci:** Register, Fees (the To review count, like Reports › Open), Deletion pending (its count).

Pages:

- **Soci › Register** (`/dashboard/people/soci`):
  - Scope: Active / Ended / All. Columns: number (DM Mono, sortable), name (alias as the secondary line), mailbox,
    admitted on, this year's fee, and for ended rows the end date and reason.
  - Page action: **Admit socio**.
  - Alerts above the table:
    - "n soci in Microsoft 365 have no record", with Register.
    - Mismatches: a record that is active while its account is not in Soci, or ended while it still is.
    - With automatic lapse on, from 1 December: "n soci will lapse on 1 January".
- **Socio page** (`/dashboard/people/soci/$number`): bookkeeping data, account, fee history with the uploaded files,
  activity. Actions: Edit, Change number, Mark as paid, End status (danger, reason and date), Restore.
- **Admit socio** (lg dialog), in four parts:
  - Account: today's Microsoft 365 create form (name, address format, member number, welcome email address).
  - Bookkeeping data: everything above, all required except the alias.
  - Admission date (default today), which records the first fee as paid.
  - A warning when the codice fiscale belongs to a former socio.
- **Register existing socio**: the same data for an account already in Soci, with its current member number. Personal
  fields are optional, so that the socio can complete them in My area. The admission date is suggested from the
  account's creation date.
- **Soci › Fees** (`/dashboard/people/fees`):
  - A fee-year menu, plus segments To review / Due / Paid / Exempt, with totals.
  - **Review** (lg dialog): the file, the declared transfer and earlier rejections, then **Confirm** or **Reject** with
    a required reason. After the deadline, Reject warns that the socio lapses at the next run.
  - **Mark as paid**: date, method, note.
- **Soci › Deletion pending** (`/dashboard/people/deletion`): ended soci whose account still exists (name, mailbox,
  ended on, reason), with **Delete account** per row (`soci:delete`, a confirmation naming the mailbox).
- **Account › My area**: a Socio card next to the People parts:
  - Number, admitted on, status.
  - This year's fee with the bank details, copy buttons and Upload transfer receipt, or its review state, or the last
    rejection reason.
  - Past fees.
  - My details, with "Complete your details" while fields are missing.

  A socio with no People record sees only this card, not the "ask HR" empty state.

- **Microsoft 365 › Members**: read-only. Its Create and Change member ID actions go away, and the page points to
  People › Soci.

Status tones: Active success, Ended neutral. Fee: Due warning, To review brand, Paid success, Exempt neutral. Account:
Pending deletion warning, Deleted neutral.

## Permissions

| Permission    | Gives                                                                               | Holders          |
| ------------- | ----------------------------------------------------------------------------------- | ---------------- |
| `soci:read`   | Register, socio pages with bookkeeping data, Fees, Deletion pending, uploaded files | `direttivo`      |
| `soci:write`  | Admit, register, edit, change number, confirm, reject, mark as paid, end, restore   | `direttivo`      |
| `soci:delete` | Delete a Microsoft 365 account from Deletion pending                                | `direttivo`      |
| `people:self` | My area, now with the Socio card                                                    | Socio role (new) |

These are created by hand in the production IdP, as the `people:*` ones were. Only a Master Admin can grant
`people:self` to the managed Socio role. `azure:members:create` and `azure:members:write` are deleted once
`soci.members.admit` and `setNumber` replace them.

The codice fiscale, the birth data and the residence address are visible only with `soci:read`, or to the socio
themselves.

## Starting the register

Phase 2 starts with an empty register, while the Soci group already holds the current soci:

1. Deploy with `SOCI_AUTO_LAPSE` off.
2. The Direttivo registers each existing socio from the "no record" alert. The socio completes the missing personal
   data in My area.
3. The Direttivo marks the 2026/27 fees already paid outside the dashboard as paid.
4. Once the register has no unregistered soci and the lapse preview shows only true non-payers, switch on
   `SOCI_AUTO_LAPSE`.

## Later, not planned

- Export the register (the Libro Soci) as a spreadsheet, per year.
- Receipts issued and signed by the association (see [`fees.md`](fees.md) for the old design).
- Members resigning from My area; Suspended during an expulsion.

## Issues

Roadmap #146 › Phase 2 #144:

| Repo    | Issue                                                     | Needs                  |
| ------- | --------------------------------------------------------- | ---------------------- |
| auth    | Expose the Microsoft 365 object ID in the access snapshot | —                      |
| auth    | Production config: `soci:*`, Socio gets `people:self`     | —                      |
| backend | Soci register and admission                               | auth config            |
| backend | Fees, uploads and fee emails                              | register               |
| backend | Ending, automatic lapse and account deletion              | register, fees         |
| backend | Birthday emails                                           | register               |
| admin   | People panel groups, Soci › Register and Admit socio      | backend register       |
| admin   | Soci › Fees and the My area Socio card                    | backend fees, auth OID |
| admin   | Ending, Restore and Deletion pending                      | backend lapse          |
