# People area: decisions

Settled decisions on top of [`brief.md`](brief.md). When the brief, the prototype and this file disagree, this file
wins; when this file and [`docs/design.md`](../design.md) disagree on visuals, `docs/design.md` wins.

## Decisions made with the owner

1. **Dashboard only.** `@polinetwork/backend` 1.4.0 has no People procedures (only `auth`, `azure`, `groups`, `me`,
   `test`). This repo implements the whole UI against the typed contract in [`contract.md`](contract.md). Agent mode
   serves in-memory sample data; outside agent mode the server functions call `people.*` on the backend, and the area
   stays hidden until `PEOPLE_ENABLED=true` and the IdP grants the new permissions. The backend work is a separate
   project that implements the same contract. Enable the switch only after that contract is deployed and verified.
2. **Restricted access.** People without `admin:access` can enter the dashboard when they hold `people:self`. They see
   only My area, plus Capo Admin or their team when their record gives them that role. Every other service stays
   behind `admin:access`.

## Prototype is a reference, not a pixel spec

The prototype (`prototype/`, and the canvas at <https://claude.ai/artifact/7rwGssnepqJ2nWuLvGLrjT>, private to the
owner) fixes **structure, content, copy and behaviour**: which pages exist, what each shows, column sets, actions,
dialogs, states and role rules. It was hand-built without the real components and **has visual errors**: wrong or
uneven spacing, paddings off the 4px rhythm, hand-tuned column widths, approximate chip overflow, ad-hoc CSS for things
the repo already has primitives for. Never port `prototype.css` or its markup. Build every screen from
`@/components/shell` and `@/components/primitives` (DataTable, PageBar, PageContent, RecordHeader, SectionCard,
KeyValueList, StatusBadge, Chip, ChipOverflow, SegmentedControl, FormDialog, ConfirmDialog, InlineAlert, EmptyState,
skeletons…) so spacing, radii and motion come out right by construction. Where the prototype and a primitive disagree,
the primitive is right.

Known prototype defects to not reproduce:

- Card headers use 12px/16px uneven padding; use `SectionCard`.
- Filter buttons render "Role:" and the value as separate flex items; use the repo's filter control pattern.
- Chip overflow is estimated from character counts; use `ChipOverflow`.
- Quick filters on Admins are ad-hoc pills; use the repo's toggle/segmented pattern or filter menu (decide in code,
  note it in `docs/design.md` §8).
- Campaign rows reuse a person avatar showing "26"; a campaign row has no avatar.
- Skeletons are hand-drawn; use the template skeletons (`TableSkeleton`, `RecordSkeleton`, `CardsSkeleton`,
  `SettingsListSkeleton`).
- Toolbar, table footer and dialog paddings are hand-set; take them from the primitives.
- Some actions only toast ("Appoint as Capo Admin", "Start campaign", "Open in Telegram/WhatsApp"); in code they get real
  dialogs or links (Telegram `https://t.me/{username}`, WhatsApp `https://wa.me/{digits}`).
- The "/" search shortcut is drawn but not wired; in code it is the shell's existing `/` behaviour.

## Navigation

- **People** is a rail service (`UsersRound`), placed first after Search. Sections: Overview, Member register, Admins,
  Teams, Census, Linking. Deep pages: person (`/dashboard/people/$personId`), team (`/dashboard/people/teams/$teamId`),
  campaign (`/dashboard/people/census/$campaignId`).
- **Capo Admin** is a Telegram section (`/dashboard/telegram/capo`, icon `Crown`), visible only to Capo Admins. A Capo
  Admin without other rights sees Telegram with that one section, so no panel (one-section rule).
- **My area** lives under the avatar: Account becomes a two-section service, My area (`/dashboard/account/me`, default)
  and Sign-in & security (today's `/dashboard/account`, unchanged content).
- A **Team Lead** without people rights gets People with only Teams. One led team opens directly; several led teams
  get the scoped index and individual team links. Direct URLs accept only the teams the person leads.
- People with only `people:self`: the logo links to My area instead of Overview.
- Linking shows its needs-review count in the panel, like Reports › Open, because it is a queue.

## Data and display

- Account status always shows a badge, Not linked included (Not linked neutral, Invite sent brand, Linked success,
  Needs review warning). Expired invites show a danger "Expired {date}" badge in Linking and on the record.
- Member numbers are 4-digit DM Mono (`0412`); person IDs are `P-0142` in DM Mono.
- Member status tones: Active success, Suspended danger, Expired warning, Former neutral. Fee: Paid success, Receipt
  uploaded brand, Due warning, Unpaid danger.
- Census answers: Continues success, Leaving warning, No answer neutral. Source text: "Imported from Forms" /
  "Dashboard".
- People with no active role stay in Overview as muted rows; the Role filter has "No roles". Their record shows a
  neutral alert: the record stays for history and future census campaigns.

## Per page

- **Overview**: personal email is the secondary line. Admin is a state badge (Active / Former); Capo Admin a scope chip.
  Last census reads "year · answer" and falls back to the last answered year. Row actions: Send invite (only while not
  linked; linked rows keep an empty slot so icons align) and ⋮ (Open record, Link account, Add to team). Columns hide
  by priority: Capo Admin, then Last census, then Teams.
- **Person record**: two columns from 1100px (1.55 : 1): left Profile, Admin, Teams, Census history; right Account,
  Member, Consents, HR notes. Activity full width below. Discrepancies are warning `InlineAlert`s above the cards, each
  with the action that fixes it. Account actions follow the state: Not linked → Send invite + Link account; Invite sent
  → Resend invite + Link account; Linked → Unlink. Header outline action "Add role". Capo Admins and Team Leads do not
  open full records.
- **Member register**: status is the scope control (All / Active / Suspended / Expired / Former), fee a filter. Number
  is the first, sortable column; on mobile the name leads the card. Change member number is a confirmation with the
  field and the consequence (the Microsoft 365 account's member ID changes too). Export confirms first. HR sees no
  Actions column and no header actions.
- **Admins**: course is the name's secondary line. Groups, Capo Admin of reference, Member and Census always show;
  Year, Campus, Active since, then Requested, Representative, Other associations and Available as Capo Admin appear as
  the table widens. Active / Former is the scope control. Row icon: Open in Telegram; the rest in ⋮.
- **Teams**: index = one `NavCard` per team (lead, member count, missing census answers) then all team members in one
  table with a Team column. Team page columns follow the team's fields (IT: GitHub, Areas; Design & Social: Tools,
  Portfolio; HR and Events: Focus; International: Languages). Team Leads see phone and Telegram for their team. Lead
  option in Add to team only for `people:appoint`. End membership needs a reason and keeps history.
- **Census**: campaign list is a table with a stacked progress meter and counts. Campaign page: Import responses
  (primary), Send reminders (outline), Close campaign in ⋮. Segments: Expected (all), Answered, Continuing, Leaving, No
  answer. Reminders skip people reminded in the last 3 days, and the confirmation says how many. No "New campaign"
  while one is open.
- **Import wizard**: lg dialog (bottom sheet on mobile), five steps Upload → Review → Duplicates → Telegram → Confirm;
  steps without work are skipped. Review: counts then tabs (New people, Updates, Possible duplicates, Invalid rows,
  Discrepancies, plus Already imported on a re-import). Invalid rows are skipped with a reason. Duplicates one pair at a
  time, side by side, differences highlighted. Confirm states that nothing is deleted and that "No" answers end the role
  with its reason. The file is parsed by the backend; the dashboard uploads it and renders the preview it returns.
- **Linking**: segmented scope Needs review (queue, Dismiss ghost / Resolve outline) and Pending invites (table, Resend /
  Revoke). Link account dialog: search, suggested matches with reason badge, required reason, inline conflict error that
  keeps the dialog open.
- **Capo Admin**: context line names the scope ("Ingegneria Informatica · 3 groups"). Cards My groups (warning badge on
  groups without admins) and Requests to join (Decline ghost / Approve outline) above the Admins of my groups table
  (phone, Telegram, Open in Telegram / Open in WhatsApp; no personal email).
- **My area**: open census first while unanswered, pre-filled from last year (year advanced by one). My roles, People to
  contact (Capo Admin, Team Lead, HR), My profile with Request a correction (no direct edits: HR owns records), My
  consents with Revoke on photo/video. Team roster: name, role, Telegram, PoliNetwork email only. First sign-in: "Is
  this you?" card with the matched record and the match reason. No record: empty state with Ask to be added, then a
  "Waiting for HR" state.

## Roles to permissions

| Viewer      | Permissions (IdP)                                                                                                             | Sees                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Direttivo   | `admin:access`, `people:read`, `people:write`, `people:members:read`, `people:members:write`, `people:appoint`, `people:self` | Everything                                        |
| HR          | `admin:access`, `people:read`, `people:write`, `people:members:read`, `people:self`                                           | All People sections; member register read-only    |
| Capo Admin  | `people:self` (+ Capo Admin scope on their record)                                                                            | Telegram › Capo Admin, My area                    |
| Team Lead   | `people:self` (+ Lead role on their record)                                                                                   | People › Teams (their team, full fields), My area |
| Team member | `people:self`                                                                                                                 | My area with their team roster                    |
| Admin only  | `people:self`                                                                                                                 | My area                                           |

Contacts (phone, personal email) need `people:read`, or Capo Admin scope / Team Lead role over that person. HR notes and
full census answers need `people:read`. The backend enforces all of this again; the dashboard only hides.
