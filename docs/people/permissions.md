# People: permission matrix

Permissions are additive and never imply one another. Administrative pages/actions below also need `admin:access`.
Only My area, an active Capo Admin's scope and a Team Lead's own teams work with `people:self` alone. Record roles
count only once PoliNetwork Auth holds them (the record is linked and the role applied). “Team member” means a volunteer in a team. `people:members:read`,
`people:members:write`, `people:fees:write` and `people:receipts:sign` were removed in #138.

| Viewer / extra permissions                     | Pages                                                      | Actions                                                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Volunteer: `people:self`, P-0021               | My area, Sign-in & security                                | Read own record and roles                                                                                                              |
| Team Lead: `people:self`, P-0030               | Above + own team(s) under People                           | Add team members, edit team fields, end ordinary team memberships; never appoint or end a Lead without `people:appoint` + admin access |
| Capo Admin: `people:self`, P-0003              | My area + Telegram › Capo Admin                            | Read-only list of the admins who have them as Capo Admin of reference                                                                  |
| `people:read`                                  | People overview, person records, Admins, Teams, Linking    | Read contacts and notes; no editing, linking or appointments                                                                           |
| `people:link`                                  | Link account and Unlink on records and Overview            | Search the IdP's accounts, link one by hand, unlink (Auth revokes the roles first)                                                     |
| `people:read` (mockups)                        | Member register, Receipts, Census; the fee card in My area | None: unconnected mockups with sample data (#138), to be rebuilt in Phase 2 (#144) and Phase 3 (#145)                                  |
| Master Admin: all explicit permissions, P-0007 | All permitted sections                                     | All People mutations                                                                                                                   |

`people:write` enables record, admin-role, team and invite mutations on readable pages;
`people:appoint` enables Capo/Lead appointments and ending those roles; `people:link` enables linking by hand and
unlinking. Nobody changes their own roles: P-0007 (agent mode's default `AGENT_PERSON`) can't edit their own. Without their read prerequisites, write
permissions alone do not open a page. Buttons and row links follow these same rules; one available action is direct.

## Verification

Browser evidence and remaining integration limits are recorded in `verification.md` at the end of the audit.
