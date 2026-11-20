# Local preview of the Libro Soci import

Status: CSV confirmed by the user; first local-only preview slice implemented locally in the backend. This document follows the
existing `soci.md` rules and does not authorize production access. Source-specific headers and interpretations are
explicit operator configuration, not assumptions hardcoded into the reader.

## Outcome and boundaries

An operator selects a local book and an explicit column mapping. A local tool produces normalized candidates and an
issue report, without creating accounts, changing group membership, writing the register, recording payments,
sending mail or enabling automatic lapse. It must work without database credentials or Microsoft 365 access.

Real books, personal-data exports and detailed reports remain on the operator's machine, outside tracked project
files. Development and committed fixtures use synthetic data only. Console output contains counts, source row
numbers, field names and diagnostic codes; it must not echo names, mailboxes, tax codes, addresses, phones or raw
validation exceptions. A detailed report is an explicit local output with restrictive permissions.

## Verified repository facts

- `backend/src/soci/contract.ts` already validates names, the codice fiscale/check character, birth-date consistency,
  optional contact details and the single-line residence. Reuse those pure validators; do not import the production
  database or directory singletons into the preview tool.
- A register entry represents one admission. Numbers are never reused; the same codice fiscale may legitimately
  appear in an ended admission and a later one. At most one admission with that code may be active.
- Existing registration requires an account already in the Soci group and may set its Microsoft 365 number.
  It also writes the admission-year fee as **paid**. Neither `members.register` nor `members.admit` is a neutral
  historical import primitive: the preview must not call them.
- Stored entries require an account object ID and a mailbox snapshot. A historical row without a known account ID
  cannot be made ready for database application by inventing an ID or creating an account.
- Missing payment information is not evidence of payment or debt. Preserve it as unknown in the preview; do not
  silently map it to Paid or Due. Production population and activation remain separate operations.

## Proposed local flow

1. Choose the source file and confirm its format; display only structural metadata (sheet names/headers when useful).
2. Map source columns to register fields explicitly. Confirm the date representation and payment-column meaning.
3. Parse locally, preserve source row references, normalize using the existing validators, and identify conflicts.
4. Show totals and diagnostic categories. Keep each unresolved row visible; never silently discard it.
5. Optionally save the detailed local report. There is no apply flag or remote action in this first milestone.

The source is UTF-8 CSV. Support explicitly configured comma or semicolon separators, UTF-8 BOM, CRLF/LF/CR,
quoted fields, escaped quotes, embedded newlines and empty cells. Reject malformed quoting, duplicate headers and
invalid UTF-8. Bound file size, row count, column count and cell length. Do not infer separators or date formats.

The mapping JSON has `version: 1`, `delimiter`, `dateFormat` (`iso` or `italian`), `scope` (`active-only`, `history`,
or `unknown`) and `columns`. The required mapped fields are `number`, `firstName`, `lastName`, and `admittedOn`.
Optional fields follow the existing details/account/end fields. `history` requires mapped end date and reason columns;
blank end fields then mean an active admission. `unknown` keeps membership unresolved rather than assuming active.
Explicit end-reason value translations are optional. `feeEvidence` maps labeled source columns as unreviewed text;
blank evidence remains unknown. Other columns must be explicitly listed in `ignoredColumns`, so data is not silently
omitted because a mapping was incomplete. Each source column has one assignment. No actual book or personal records
are needed to implement this interface. The backend README includes the executable command, synthetic examples,
limits, exit codes and private-report handling.

Reports always state preview-only mode and that account/register reconciliation has not been performed. Every valid
candidate remains unresolved until later reconciliation/review. Duplicate rows and numbers are blocked, as are
multiple explicitly active admissions with one tax code. Historical/unknown identities are flagged for review.
The CLI prints only counts and coded row/field diagnostics. A detailed report is opt-in, created exclusively with
mode 0600 outside Git worktrees; it cannot overwrite a file or follow an existing report symlink. No apply option,
network client, DB singleton, configured Soci service or mailer is part of the executable dependency graph.

## Candidate data and diagnostics

The preview's internal candidate is a proposal, not an input to an existing mutation API:

- Source reference: file-local row and optional sheet. Do not copy the whole raw row into logs.
- Admission: number, first/last name, optional alias, codice fiscale, birth date/place, residence and phone, admission
  date, and any explicit end date/reason/note. Keep dates unambiguous; do not infer dates from a year alone.
- Account evidence, if supplied: mailbox and object ID. An absent or conflicting link remains unresolved.
- Fee evidence: fee year and the payment information explicitly present in the source. Unknown status/date/method
  remains unknown; a payment amount or year alone must not fabricate a payment date or mark an admission as paid.

Diagnostic categories: malformed/ambiguous value; invalid codice fiscale or birth-date mismatch; conflicting member
number; repeated identical row; multiple active admissions with the same code; historical re-admission; missing
account reconciliation; incomplete payment evidence. Invalid rows are blocked, historical re-admissions are preserved,
and unknown account/payment information is shown as unresolved rather than guessed.

Optional later reconciliation accepts an operator-provided **local** register/directory snapshot. It compares exact
object IDs, numbers, mailboxes and validated tax codes; name similarity cannot establish identity. The first preview
must still work without a snapshot and label reconciliation as not performed. It must not obtain a snapshot by
connecting to production automatically.

## Acceptance and verification

| Requirement            | Observable check                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Local-only execution   | Run without DB/Graph credentials; network and database dependencies are absent from the import path.                               |
| No side effects        | Preview does not create/update accounts, register entries, fees, group membership or outbox items.                                 |
| Existing validation    | Synthetic valid/invalid tax codes, birth dates, optional contacts and residence use the same rules as the contract.                |
| Stable identities      | Repeated numbers and conflicting active codes are blocked; legitimate ended/new admissions are preserved.                          |
| No financial inference | Empty payment fields remain unknown; no preview invokes admission/registration to create a paid fee.                               |
| Faithful parsing       | Once format is confirmed: test quoting/newlines, empty cells, encodings, date representations and malformed input for that format. |
| Private reports        | Invalid synthetic personal values do not appear in stdout/stderr; detailed output is local and private.                            |
| Repeatable preview     | Re-reading the same source/mapping produces the same candidates and diagnostics, with no writes.                                   |

## Ordered milestones

1. **Source adapter and mapping contract: complete locally.** CSV is confirmed. Source headers, dates and scope are
   explicit operator configuration; payment information is preserved as evidence without guessed meaning. Real
   personal records are not needed for design.
2. **Local normalization preview: implemented locally.** Backend `scripts/soci-import-preview.ts`, pure parsing and
   normalization, existing validators and synthetic fixtures. No runtime import of the DB, Graph, mailer or configured
   Soci service. Operators can inspect and save a private report without credentials or network access. No application
   is supported; every normalized candidate remains unresolved.
3. **Reconcile local snapshots.** Classify existing, new, conflicting and unresolved records against explicitly
   provided local snapshots, respecting historical numbers and re-admissions. Completion: no identity is selected
   from names alone, unresolved links remain blocked and no live reads/writes occur.
4. **Separate future application design.** Only after reviewing the preview, decide how historical rows, account links
   and payment evidence can be applied transactionally and idempotently. Real production reads, writes, invitations,
   account creation and activation require separate explicit authorization. This milestone is outside the selected
   local preparation/preview scope.

## Source-specific configuration still needed for a real preview

CSV is confirmed. The operator must provide the real header mapping, date representation and source scope when
running a real preview. Payment meanings, historical account links and any future database application remain
unresolved review tasks; this preview preserves evidence and does not guess them.
