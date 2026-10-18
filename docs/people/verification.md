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

PR #100 adds fee/receipt-specific browser evidence here when its audit is complete.
