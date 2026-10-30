# People: permission matrix

Permissions are additive and never imply one another. Administrative pages/actions below also need `admin:access`.
Only My area, an active Capo Admin's scope and a Team Lead's own teams work with `people:self` alone. Record roles
count only after account linking is confirmed. “Team member” means a volunteer in a team. `people:members:read`,
`people:members:write`, `people:fees:write` and `people:receipts:sign` were removed in #138.

| Viewer / extra permissions                     | Pages                                                      | Actions                                                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Volunteer: `people:self`, P-0115               | My area, Sign-in & security                                | Read own record and roles                                                                                                              |
| Team Lead: `people:self`, P-0034               | Above + own team(s) under People                           | Add team members, edit team fields, end ordinary team memberships; never appoint or end a Lead without `people:appoint` + admin access |
| Capo Admin: `people:self`, P-0098              | My area + Telegram › Capo Admin                            | Contact the admins who have them as Capo Admin of reference                                                                            |
| `people:read`                                  | People overview, person records, Admins, Teams, Linking    | Read contacts and notes; no editing, linking or appointments                                                                           |
| `people:read` (mockups)                        | Member register, Receipts, Census; the fee card in My area | None: unconnected mockups with sample data (#138), to be rebuilt in Phase 2 (#144) and Phase 3 (#145)                                  |
| Master Admin: all explicit permissions, P-0007 | All permitted sections                                     | All People mutations                                                                                                                   |

`people:write` enables profile, admin-role, team and linking mutations on readable pages;
`people:appoint` enables Capo/Lead appointments and ending those roles. Without their read prerequisites, write
permissions alone do not open a page. Buttons and row links follow these same rules; one available action is direct.

## Verification

Browser evidence and remaining integration limits are recorded in `verification.md` at the end of the audit.
