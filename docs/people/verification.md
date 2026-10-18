# People merge audit — 18 October 2026

## Base PR #97

Used `PORT=10870/10871 AGENT_MODE=true pnpm dev`, with the permission lists and records in
[`permissions.md`](permissions.md). Browser checks used 320 × 800/900 and 1440 × 900 CSS pixels.

- Volunteer P-0115, only `people:self`: My area and account security; no People administrative navigation;
  a direct Receipts attempt returned to My area.
- Team Lead P-0034, only `people:self`: IT team, contacts and ordinary membership actions; no full-record links,
  appointment action or action to end the Lead's membership. Another team's direct URL returned to My area.
- Capo Admin P-0098, only `people:self`: the three scoped groups, their requests and admins; no full-record links
  or personal emails. Approve/decline were inspected, not executed in the browser.
- Administrative `people:read` without member permission: People lists and full records, contacts/census/notes;
  no mutation controls or member-number/fee/Microsoft 365 details. Read-only Linking has no Resolve/Dismiss actions.
- Administrative `people:members:read` without `people:read`: populated register, no record links or write controls.
- Adding `people:members:write`: admission, export and status/number actions become available. Avatar navigation opens
  Sign-in & security when `people:self` is absent, on mobile and desktop.

These inspected pages had no page-level horizontal overflow. Form state and authorization are also covered by
`tests/people-access.test.mjs`, `tests/people-input.test.mjs` and the repository server-security checks. General People
controls now live in #97; the receipt layer is rebased onto it.

## Limits

The People backend is not implemented. Fake authorization checks and the contract are not evidence of production
backend enforcement. Real Microsoft 365 workflows, mail delivery, CIE hardware, officer-certificate verification,
receipt/eSign concurrency and durable completion need backend integration tests. Empty fixtures, every validation
message and every loading skeleton have not been exercised visually. Full normal OIDC sign-in needs a configured
IdP; the existing local OIDC integration tests remain the automated coverage.

## Receipt layer PR #100

The same 320/1440 widths were used with these administrative permission sets (all also include `admin:access`):

- `people:members:read`, no `people:read`: register and Receipts are populated; no full-record links, fee mutations
  or signing controls. Unsigned receipt cards say “To be signed by”.
- Add `people:fees:write`: review/mark-paid/reminder controls in the register, retry/void on receipts, no signing.
  A loaded transfer receipt offers Review; Mark as paid is reserved for Due/Unpaid, matching the record card.
- `people:members:read,people:receipts:sign,esign:sign`, P-0007 and P-0098: CIE signing and manual options appear.
  President queue: five assigned receipts; Vice-president queue: one, the President's own receipt. The other officer
  is named as the expected signer. Neither profile gets fee mutation controls.
- The same permissions on P-0034: read-only receipts, no CIE/manual signing controls, because there is no office.
- Remove `esign:sign` on P-0098: Download to sign and Upload signed are direct actions; there is no CIE action or
  one-item signing menu. The Vice-president's ZIP download and the empty upload dialog were exercised.
- Master Admin (all explicit permissions), P-0007: Overview, Member register, Receipts, Admins, Teams, Census and
  Linking at both widths, with no page overflow. The person record's transfer PDF rendered in the shared eSign viewer
  on mobile and desktop. Reject/Back were inspected. Exactly one fee (P-0045) was approved in the fake: the dialog
  closed after reload, the fee became Paid and receipt 2026/025 appeared as To sign. No bulk destructive action ran.

Additional `people:self` checks at both widths: `match:P-0034` has only confirmation/rejection actions and no Lead
navigation; `none` offers Ask to be added; P-0021 shows the rejected transfer, bank details, upload replacement and
own signed-receipt download. A volunteer's forbidden receipt URL and a Lead's other-team URL return to My area.

The CIE click was exercised as an officer: the shared component reported the pending People backend and retained
unsigned receipts. A completed real CIE session was not possible. The receipt reference shown in Signatures is
covered by provenance parsing tests, but was not rendered against a real eSign backend; there is no fabricated eSign
request in agent mode. Full signature/job states, email and concurrency remain integration work.

With `AGENT_MODE=false` and temporary development OIDC values, opening `/dashboard/people` entered the normal
IdP redirect, which stopped at `invalid_client`. No configured development client or real signed-in session was available. Browser checks were primarily in the light theme, not a full dark-mode audit. Existing optional Redis/
compiled-HTTP integrations were not enabled. See test output for the exact pass/skip counts.

Admission validation also rejects an initial `receipt` state without a file and attempts to overwrite an existing membership; both have regression tests.
