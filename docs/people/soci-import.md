# Local preview of the Libro Soci import

Status: preparation draft, 20 November 2026. The user selected local preparation and preview after publishing the
Soci lifecycle. The source format has not been confirmed; do not treat this draft as an implementation-ready parser
specification. This document follows the existing `soci.md` rules and does not authorize production access.

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

Recommended interchange, pending source confirmation: a UTF-8 CSV export if the source is a spreadsheet. Direct XLSX
support would require selecting and checking a maintained parser; a PDF source would require a separate extraction
step. Do not add a parser dependency or assume a source format before that decision.

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

1. **Confirm source shape and mapping.** Resolve format, relevant sheets, header names, date representation and payment
   semantics. A header-only or synthetic example is enough; real personal records are not needed for design. Select
   the smallest parser consistent with the source and the existing Bun toolchain. Completion: the adapter and mapping
   contract can be specified without guesses.
2. **Build the local-only normalization preview.** Implement a small CLI and pure parsing/normalization functions in
   the backend repository, reusing existing validators. Add synthetic fixtures and the acceptance tests above. No
   runtime import of the DB, Graph, mailer or configured Soci service. Completion: an operator can inspect and save a
   report from a synthetic source without credentials or network access.
3. **Reconcile local snapshots.** Classify existing, new, conflicting and unresolved records against explicitly
   provided local snapshots, respecting historical numbers and re-admissions. Completion: no identity is selected
   from names alone, unresolved links remain blocked and no live reads/writes occur.
4. **Separate future application design.** Only after reviewing the preview, decide how historical rows, account links
   and payment evidence can be applied transactionally and idempotently. Real production reads, writes, invitations,
   account creation and activation require separate explicit authorization. This milestone is outside the selected
   local preparation/preview scope.

## Open source facts

Awaiting the source format (spreadsheet, CSV or PDF). Then confirm the relevant sheet/header structure and whether
the file contains current members only or historical admissions as well. The existing code cannot establish those
facts; payment-column semantics and absent historical account IDs must not be guessed.
