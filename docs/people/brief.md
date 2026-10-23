# People area: original brief

This is the brief the prototype was built from, kept verbatim so later work answers to the same requirements. Where it
conflicts with [`decisions.md`](decisions.md), the decisions win: they record what was settled afterwards.

---

Prototype a new "People" area for the PoliNetwork Admin dashboard: a clickable, high-fidelity prototype that fits the
existing dashboard exactly. Desktop 1440px and mobile 390px, light and dark theme.

## Context

PoliNetwork is a student association at Politecnico di Milano. It runs hundreds of Telegram/WhatsApp course groups
through ~150 volunteer group admins, plus internal teams (IT, HR, Design & Social, International, Events &
Partnerships) and a smaller set of paying members (soci).

Today volunteer data lives in a Microsoft Forms spreadsheet ("Modulo Volontari", yearly), and members live only as
Microsoft 365 accounts. This area brings everything into the dashboard: one record per person, and on that record three
independent roles:

- Member (socio): has a member number and a yearly membership status.
- Admin: manages Telegram groups for courses.
- Team member: belongs to one or more internal teams, possibly as Team Lead.

A person can have any combination of roles, or none (e.g. a former volunteer). The data collected differs by role:
don't merge admin fields and team fields into one table.

Key concept: a person record exists even if the person never signs in. Many volunteers will never create a PoliNetwork
account. When someone does sign in later, their account gets linked to their existing record (never a duplicate). Every
record therefore shows an account status: Not linked · Invite sent · Linked · Needs review.

## Existing design system (follow strictly)

- Shell: 64px left rail with service icons (Overview logo, Search, then Telegram, WhatsApp, Microsoft 365, Web, Reports;
  theme toggle and avatar at the bottom), a 240px section panel for services with 2+ sections, then a scrolling content
  column with max width 1280px. Below 760px: 56px top bar, horizontally scrolling section pills, 64px bottom nav; tables
  become stacked cards; dialogs become bottom sheets.
- Add "People" as a new rail service (monochrome lucide icon such as UsersRound) with its own section panel.
- Page header: one h1 (24px/600) with one muted context line (usually the total, e.g. "148 people"), and at most one
  primary action plus one outline action. Then a toolbar row: scope controls → search ("/" shortcut) → filters → count
  shown only while filtered ("12 of 148 people").
- Tables: 12px radius surface, 1px borders, sentence-case 12px headers (no uppercase), 52px rows, 14px cells, first
  column with a 32px initials avatar and an optional 12px secondary line. Columns of variable length get fixed widths,
  and on narrower widths low-priority columns hide first. A visible "Actions" column holds monochrome 36px icon buttons
  with the overflow "⋮" menu far right. Pagination: "Showing 1–20 of 148", 20/50/100 per page. Clickable rows hover
  with the soft accent fill.
- Record pages (deep pages): back button + breadcrumb ("People / Giulia Rossi"), then a record header with a 64px
  avatar, a 28px name, status badge and meta line, then section cards.
- Tokens: canvas #f6f7f9, surfaces #fff, panel #fbfcfd, one accent cobalt #1156ae (active location, primary action,
  links, focus only), neutral grays otherwise. Borders separate, shadows only on floating layers (menus, dialogs,
  toasts). Radii: 8 buttons, 12 cards and tables, 14 dialogs, full for badges. Spacing on a 4px grid, 16px card padding.
- Type: DM Sans; DM Mono for identifiers (member numbers, Telegram IDs, emails of Microsoft 365 accounts, academic years
  like 2026/27). Weights 400/500/600. No uppercase, no italic, tabular numbers.
- Badges: status badges (dot + label) only for states, tones neutral/brand/success/warning/danger. Chips for categorical
  values (team names, roles, campus). Show nothing when a state is absent, and "—" for unset values.
- Dialogs: 18px title + one-sentence description; footer right-aligned with "Cancel" (outline) then the primary action.
  Confirmations are titled "{Verb} {object}?" and state the consequence. Forms have the label above the field,
  "(optional)" on optional fields, errors on submit.
- Copy: English, sentence case, verb + object buttons ("Import responses", "Send invite"), no "please", "successfully"
  or exclamation marks. Toasts: "Invite sent.", "Couldn't link account." Dates: "6 Oct 2026". Write "Microsoft 365",
  never "Azure".
- Motion: only for changes the user caused, short and ease-out. No animation on navigation, sorting or filtering.

## Navigation of the new area

People (service)

- Overview: all people
- Member register
- Admins
- Teams (→ one page per team)
- Census
- Linking

Plus, outside the People service:

- "Capo Admin": a section visible only to Capo Admins
- "My area": the personal page of any signed-in person with a linked record (it can live with the existing Account
  page; propose the best placement)

## Pages to prototype

1. People › Overview: one row per person. Columns: name (secondary line: personal email), Member (member number chip or
   —), Admin (Active / Former), Teams (chips with "+n" overflow), Capo Admin (scope chip), Account (status badge), Last
   census (e.g. "2026/27 · Continues"). Filters: role (Member / Admin / Team member / none), team, campus, account
   status, census status. Primary action: "Add person".

2. Person record (deep page): header with name, account status badge and meta ("P-0142 · Ingegneria Informatica · 2nd
   year · Leonardo"). Section cards:
   - Profile: personal email, phone, Telegram username, course, year, campus, other associations, student
     representative (where).
   - Member: number, status, admitted on, current year fee status. Link to the Microsoft 365 account.
   - Admin: active since, groups they administer (detected by the bot, with Telegram glyphs), groups they asked to join,
     available as Capo Admin, Capo Admin of reference.
   - Teams: one row per team with role (Member/Lead), since, and the team-specific fields.
   - Census history: one row per academic year with answer and source ("Imported from Forms" / "Dashboard").
   - Consents: volunteer privacy policy (version, date), photo/video (granted/denied, revocable).
   - Account: linked or not, and how. Actions: "Send invite", "Link account", "Unlink".
   - Activity: who changed what and when. Show discrepancies as warning inline alerts, e.g. "Declared a member in the
     2026/27 census, but not in the member register."

3. Member register: member number (mono, sortable), name, status (Active / Suspended / Expired / Former), admitted on,
   fee for the current year (Due / Receipt uploaded / Paid / Unpaid), Microsoft 365 address, account. Actions: "Add
   member", "Change status", "Change member number" (confirm dialog explaining the Microsoft 365 account is updated
   too), "Export" (confirm, since it exports personal data).

4. Admins: name, course, year, campus, active since, groups administered (count + chips), groups requested, student
   representative, other associations, available as Capo Admin, Capo Admin of reference, member yes/no, census status.
   Quick filters: "No groups", "Available as Capo Admin", "Declared member but not registered", "No census answer".

5. Teams:
   - Index: one card per team (lead avatar, member count, missing census answers), then one table of all team members
     with a Team column.
   - Team page (e.g. "IT"): active and former members (segmented control), role, since, team-specific fields (IT: GitHub
     username, areas such as Frontend/Backend/Bot/Infrastructure; Design & Social: tools, portfolio link), census
     status, photo/video consent. The Team Lead can "Add to team", edit team fields and "End membership" (with a
     reason).

6. Census:
   - Campaign list (2026/27 open, 2025/26 closed) with progress: expected / answered / continuing / leaving / no answer.
   - Campaign page: those four segments as a segmented filter over the list of people. Actions: "Import responses",
     "Send reminders" (confirm with count), "Close campaign".
   - Import wizard (lg dialog with steps): 1) upload the Forms export (.xlsx/.csv); 2) preview with counts and tabs for
     New people, Updates, Possible duplicates, Invalid rows and Discrepancies; 3) resolve duplicates side by side,
     choosing "Same person" or "Different people"; 4) confirm Telegram username → Telegram user suggestions
     (individually or "Confirm all"); 5) final confirm "Import 148 responses" stating nothing is deleted and "No"
     answers end the role with its reason. Re-importing the same file must clearly say "Already imported" rows are
     skipped.

7. Linking: two lists.
   - "Needs review": conflicts such as "Telegram account already linked to another record", or signed-in people without
     a record who asked to be added. Resolve via dialogs.
   - "Pending invites": email, sent on, expires on, with "Resend" and "Revoke". Include the "Link account" dialog: search
     IdP accounts, show suggested matches with the reason ("Same verified Telegram account" / "Similar name — check
     before linking"), a required reason field, and confirm.

8. Capo Admin (scoped): header "Ingegneria Informatica · 3 groups". The admins of my groups with name, year, active
   since, representative, other associations, phone, and Telegram with quick "Open in Telegram" / "Open in WhatsApp"
   buttons. My groups, flagging groups without admins. Requests to join my groups.

9. My area (self-service), for a linked person: my profile (with "Request a correction"), my roles (member number and
   status; admin groups; teams), the open census ("Confirm for 2026/27" or "I'm leaving", with fields pre-filled from
   last year), my consents (with revoke), my Capo Admin and my Team Lead, and my team's roster (name, role, Telegram,
   PoliNetwork email only). Also show:
   - the first-time link flow: "Is this you?" with the matched record summary and "Yes, link my account" / "This isn't
     me";
   - the state for a signed-in person with no record: "You're not on the volunteer or member lists", with "Ask to be
     added".

## Role-based views

Add a prototype-only "Viewing as" switcher (outside the real UI chrome, clearly a prototype control) to preview the same
screens as:

- Direttivo: everything, the only role that writes the member register and appoints Team Leads and Capo Admins.
- HR: Overview, Admins, Teams, Census, Linking with write access; member register read-only (no write actions shown).
- Capo Admin: only the Capo Admin section and My area.
- Team Lead (IT): the IT team page with full fields and contacts, plus My area.
- Team member (IT): My area and the IT roster (name, role, Telegram, PoliNetwork email; no phone, no notes).
- Admin with no other role: My area only.

Missing rights remove actions and sections entirely: no disabled buttons and no locked icons. Field visibility: phone and
personal email are visible to Direttivo, HR, Capo Admins (their scope) and Team Leads (their team) only. HR notes and
full census answers are visible to Direttivo and HR only.

## States to include

Loading skeletons matching each template, empty states ("No people match" with "Clear filters"; "No campaigns yet"), an
import with errors, a link conflict, an expired invite, and a person with no roles left (archived look).

## Sample data

Use realistic Italian names, Politecnico di Milano courses (Ingegneria Informatica, Ingegneria Gestionale, Design della
Comunicazione, Architettura…), years (1st–3rd bachelor, 1st–2nd master, graduated) and campuses (Leonardo, Bovisa,
Cremona, Piacenza, Mantova, Lecco, External). Show ~150 people overall, with only ~40 having a linked account, ~60
members, ~110 admins and ~25 team members, and some overlaps.

## Deliverable

A navigable prototype of the pages above with the "Viewing as" switcher. For each page, add a short note on decisions
you made where this brief was ambiguous.
