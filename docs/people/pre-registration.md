# People before the first Auth login

## Product contract

A People writer can create a person with first and last name, optional email, phone, Telegram ID/username, and optional admin/team roles. Course, academic year, campus and census consent are not prerequisites. These minimal identity details and organizational roles live in Auth, including before login. People keeps its existing register/history, not an independent authoritative role assignment.

The preliminary subject has no credentials, provider accounts or sessions. At a later real login, verified email or verified Telegram ID can produce a link proposal for a Master Admin. Names and phone numbers never authorize a link; name matches are review hints, not proof. Mutable Telegram usernames are contact/display data. Conflicting verified identities or multiple candidates require manual review. Role-bearing identity links must never be made by name, unverified email or self-grant.

Master approval binds the preliminary person to the real account and transfers the current Auth roles atomically, preserving the register identity and history. Existing account roles are retained. Repeated creation/link commands are idempotent; conflicting replays fail. Nothing is automatically granted merely because someone signs in with a similar name.

## Technical decisions

Auth owns a preliminary-person record associated with a non-login subject and its normal role assignments. The preliminary-person ID remains stable after account linking. Declared contact data is separate from verified provider evidence and never enters access snapshots as verified identity.

Extend the existing backend-only People interface with bounded, idempotent creation and Master-approved linking operations, using the existing service-client authentication, RBAC mutation lock, delegation checks and audit trail. Directory responses identify preliminary subjects and their canonical linked account, and include verified-identity link proposals. Backend reconciliation follows the stable Auth person identity instead of creating a duplicate record on first login.

People's create input makes census fields optional and accepts initial team/admin assignments. The UI distinguishes preliminary identities from linked accounts. Existing local-only test fixtures remain development data; normal production creation fails explicitly when Auth is unavailable rather than silently creating a local authority.

## Acceptance and verification

1. Create with only first/last name and a team; no census fields required.
2. Create an admin before login; role is stored in Auth and no token/session is issued.
3. Retry creation with the same command: one person; changed payload with reused ID: conflict.
4. Verified email/Telegram ID produce a proposal. Same name alone, unverified email, username or phone do not automatically link.
5. Conflicting or multiply-matched identities stay unresolved.
6. Only Master Admin approves the identity link; roles transfer atomically and retain existing account assignments; invalid delegation applies nothing.
7. First login and approval keep the People record/history and do not create a second person or lose roles.
8. Admin/team changes after approval follow Auth as before.
9. Both API boundaries validate inputs and permissions, and no declared Telegram contact is treated as verified by the bot/access snapshot.

## Roadmap

1. Auth: additive schema/migration, creation/link service, derived matching proposals, integration tests.
2. Backend: Auth client contract, stable reconciliation, creation and review integration, regression tests.
3. Dashboard: minimal creation, optional contact/census details, initial admin/team choice, accurate preliminary/link-review states; agent-mode parity.
4. Verify migrations on disposable PostgreSQL, focused identity/security tests, full checks/builds, review all task changes, and update existing Auth/backend/admin PRs without merging or deploying.

## Implemented flow

The new `people_registration` table in Auth (migration `0024`) refers to an Auth subject without provider accounts or sessions. Bound roles use Auth's existing `user_role` table. The same backend-only endpoint accepts `create-person`, `update-person` and `link-person` commands, protected by `idp:people:roles` and acting-user checks. Ordinary role commands remain compatible.

A new `registrationId` identifies the person before and after linking. `provisional` is explicit; declared contacts are distinct from verified evidence. Auth derives review proposals using its existing verified app-email policy and live Telegram identity evidence; homonyms and conflicting identifiers are labeled for review, never linked automatically. Master approval transfers bound assignments atomically to an existing login account, preserves its existing roles and provider accounts, and clears assignments on the preliminary subject.

People creates and updates registered identities through Auth and reconciles by `registrationId`. It does not grant a preliminary identity My area access or silently create a local production identity if Auth is unavailable. Existing historical/local-only records and imports retain their prior handling; this change does not migrate them automatically. Census fields remain People-specific and are optional when editing a profile; census submission/import validation stays strict.

Verification includes matching unit tests, Auth PostgreSQL creation/link/idempotency tests, backend first-login and restart recovery tests, agent-mode minimal creation tests, and browser creation with only names plus IT at desktop/mobile widths. Production configuration and a real external-provider login are not part of these local checks.
