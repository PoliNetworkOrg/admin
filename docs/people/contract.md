# People area: backend contract

The dashboard calls these procedures under `people.*` on the tRPC backend (`@polinetwork/backend`), served by the
backend's `src/people/router.ts` (Phase 1: PoliNetworkOrg/backend#105 and #106). **`src/features/people/people.contract.ts`
is the source of truth** for every shape and input; it is a copy of the backend's `src/people/contract.ts`, so change
both together. In agent mode the dashboard serves the same shapes from `people.fake.server.ts` over
`people.fixtures.server.ts`.

Every procedure checks permissions server-side, and every role change is checked again by PoliNetwork Auth. Dates are
ISO `YYYY-MM-DD` strings; timestamps ISO 8601. Actors (`assignedBy`, `sentBy`, `linkedBy`, activity `actor`) are
account IDs, or `auth` / `system`; the dashboard shows the name of the record linked to the account when it has it.

Soci, fees and receipts, the census, record matching and Telegram group tracking are not part of People (#138). Their
pages are unconnected mockups with their own sample data (`mockup-data.ts`).

## Model

- **Person:** a record with a name, an optional contact email (only for invites, never to match accounts), phone and
  Telegram username (informational only), HR notes and history.
- **Account:** `none`, `invite` (an open invite: address, sent on, expiry, sender) or `linked` (account ID, `method`
  `invite` / `manual` / `auth`, when and by whom). `auth` is a record People created for someone given a bound role by
  hand in PoliNetwork Auth.
- **Assignment:** `admin`, `capo` (with its `capoScope`) or `team` (with `team`, `teamRole` `member` / `lead` and the
  team's fields). An admin assignment has a `capoOfReference`. Each has `since`, `endedOn` / `endReason` once ended,
  `assignedBy`, and where it stands with Auth:

  | `status`  | Meaning                                                                   | Dashboard label           |
  | --------- | ------------------------------------------------------------------------- | ------------------------- |
  | `pending` | The record isn't linked, so Auth knows nothing of it                      | Pending until linked      |
  | `sent`    | Sent to Auth, not confirmed yet (`change` says whether it starts or ends) | Waiting for Auth / Ending |
  | `applied` | Auth holds it (or, for an end, no longer does)                            | Applied                   |
  | `refused` | Auth refused; `refusal` is its reason, shown word for word                | Refused by Auth           |

  A refused start ends the assignment (it never took effect); a refused end leaves it current. While any change of a
  linked record is `sent`, the backend refuses another role change for it.

- **Teams:** `it`, `hr`, `design` (Design & Marketing), `intl`, `events`. `teams.list` reports per team whether Auth
  binds a member and a Lead role (`assignable`); a role that isn't bound can't be assigned, and the dashboard doesn't
  offer it. Only these kinds exist: Admin, Capo Admin, team member, team Lead.

## Procedures

| Procedure                             | Kind             | Input                                                                  | Needs                                                          |
| ------------------------------------- | ---------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| `persons.list` / `persons.get`        | query            | — / `{ id }`                                                           | `admin:access` + `people:read`                                 |
| `persons.create`                      | mutation         | name, `contactEmail`, `phone`, `telegramUsername` (empty when unknown) | `people:write`                                                 |
| `persons.update` / `setNote`          | mutation         | `{ id, … }` / `{ id, note }`                                           | `people:write`                                                 |
| `admins.list`                         | query            | —                                                                      | `people:read`                                                  |
| `admins.assign`                       | mutation         | `{ personId, since, capoId }`                                          | `people:write`                                                 |
| `admins.end`                          | mutation         | `{ personId, reason }` (Capo Admin role ended first)                   | `people:write`                                                 |
| `admins.setCapoOfReference`           | mutation         | `{ personId, capoId }`                                                 | `people:write`                                                 |
| `capos.list`                          | query            | —                                                                      | `people:read`                                                  |
| `capos.appoint`                       | mutation         | `{ personId, since, scope }` (a current admin)                         | `people:appoint`                                               |
| `capos.setScope` / `capos.end`        | mutation         | `{ personId, scope }` / `{ personId, reason }`                         | `people:appoint`                                               |
| `teams.list` / `teams.candidates`     | query            | — / `{ teamId }`                                                       | `people:read`, or a Lead for their own team                    |
| `teams.addMember`                     | mutation         | `{ teamId, personId, role, since, fields }`                            | `people:write` or the team's Lead; `people:appoint` for a Lead |
| `teams.updateFields`                  | mutation         | `{ teamId, personId, fields }`                                         | `people:write` or the team's Lead                              |
| `teams.endMembership`                 | mutation         | `{ teamId, personId, reason }`                                         | as `addMember`, by the membership's role                       |
| `linking.invites` / `recent`          | query            | —                                                                      | `people:read`                                                  |
| `linking.sendInvite` / `revokeInvite` | mutation         | `{ personId }`                                                         | `people:write`, or Lead of one of the person's teams           |
| `linking.searchAccounts`              | query            | `{ query }`                                                            | `people:link`                                                  |
| `linking.link`                        | mutation         | `{ personId, accountId, reason }`                                      | `people:link`                                                  |
| `linking.unlink`                      | mutation         | `{ personId, reason }`                                                 | `people:link`                                                  |
| `capo.get`                            | query            | —                                                                      | `people:self`, as a current Capo Admin                         |
| `me.roles` / `me.get`                 | query            | —                                                                      | `people:self`                                                  |
| `me.invite` / `me.acceptInvite`       | query / mutation | `{ token }`                                                            | any signed-in account                                          |

Nobody changes their own roles, and nobody hands out a role granting permissions they don't hold; the backend applies
the same rules as Auth (`src/people/rules.ts`) to pending assignments, and Auth checks linked ones again.

**Invites** link to `/people/invite?token=<token>` (PoliNetworkOrg/backend#109), a dashboard page outside the gated
shell: it calls `me.invite` to ask "Link this account to <name>?", then `me.acceptInvite`. Older emails link to
`/dashboard/account/me?peopleInvite=<token>`, which redirects there before the dashboard's gate.

**Linking** sends every pending assignment to Auth: by hand, acting as whoever links; by invite, acting as each
assignment's `assignedBy`. **Unlinking** asks Auth to take the record's roles back first; once it confirms, the account
is detached and the assignments wait as `pending` again.

## Dashboard composition

Add person creates the record, then calls `admins.assign`, `capos.appoint` and `teams.addMember` for the roles it starts
with (`createPerson` in `people-write.functions.ts`). A refused role doesn't undo the record: the page reports which
roles weren't given, in the backend's words.
