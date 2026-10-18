# People: permission matrix

Permissions are additive and never imply one another. Administrative pages/actions below also need `admin:access`.
Only My area, an active Capo Admin's scope and a Team Lead's own teams work with `people:self` alone. Record roles
count only after account linking is confirmed. An officer title alone gives no extra permission. “Member” means socio;
“team member” means a volunteer in a team. Fees/receipts apply in PR #100.

| Viewer / extra permissions                            | Pages                                                           | Actions                                                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Volunteer: `people:self`, P-0115                      | My area, Sign-in & security                                     | Own census, correction request, photo-consent revocation; own fee upload and signed receipts                                           |
| Team Lead: `people:self`, P-0034                      | Above + own team(s) under People                                | Add team members, edit team fields, end ordinary team memberships; never appoint or end a Lead without `people:appoint` + admin access |
| Capo Admin: `people:self`, P-0098                     | My area + Telegram › Capo Admin                                 | Approve/decline requests only for own groups; contact scoped admins                                                                    |
| `people:read`                                         | People overview, person records, Admins, Teams, Census, Linking | Read contacts/notes/census; no editing, linking, imports or appointments; member details hidden                                        |
| `people:members:read`                                 | Member register, Receipts (#100)                                | Read register, download receipts; full records require `people:read`                                                                   |
| `people:members:read,people:members:write`            | Same                                                            | Admit members, change status/number, export; no fee review or signing                                                                  |
| `people:members:read,people:fees:write`               | Register, Receipts (#100)                                       | Review transfer receipts, mark paid, remind, retry delivery, void one receipt                                                          |
| `people:members:read,people:receipts:sign,esign:sign` | Receipts + Signatures (#100)                                    | Only the officer on the confirmed record signs assigned receipts, with the shared CIE popup or manual files                            |
| President / Vice-president: P-0007 / P-0098           | As granted by permissions                                       | President signs ordinary receipts; Vice-president signs the President's receipt. No officer role: no signing action                    |
| Master Admin: all explicit permissions, P-0007        | All permitted sections                                          | All People mutations; receipt signing still limited to own office                                                                      |

`people:write` enables profile, admin-role, team, census and linking mutations on readable pages;
`people:appoint` enables Capo/Lead appointments and ending those roles. Without their read prerequisites, write
permissions alone do not open a page. Buttons and row links follow these same rules; one available action is direct.

## Verification

Browser evidence and remaining integration limits are recorded in `verification.md` at the end of the audit.
