# Design system

The rules every dashboard page follows. Measurements and copy live in the code: token values in `src/styles.css`,
component props and geometry in each primitive's JSDoc, page copy in the page. This file says which piece to use, where,
and why. When you change a rule, change it here in the same commit.

Login and onboarding pages use the same tokens but not the shell.

## 1. Principles

1. **Say it once.** Every place, control, label and number appears once per screen. Each page has one `h1` with one
   line of context under it (a total or the page's purpose); no eyebrows, and no count that repeats one already
   visible. Deep pages show a short breadcrumb ("Users / 5021007919") instead of a context line.
2. **The chrome is for finding; the content is for doing.** Rail, panel, top bar and bottom nav locate; nothing in
   them explains. Help lives in the page context line, empty states, field hints and dialog descriptions.
3. **One accent, neutral everything else.** Brand blue marks the active location, the one primary action, links,
   "on" states (a visible group) and focus. Icons are `--pn-fg-muted`, and every service and platform is a
   monochrome lucide icon: there are no multicolor logos. Status uses the fixed tones, never ad-hoc colors.
4. **Borders separate; shadows float.** Static surfaces (cards, tables, nav) get a 1px line; only layers above the page
   (popover, menu, dialog, sheet, toast, drag ghost) cast a shadow.
5. **Motion confirms, never decorates.** Animate only changes the user caused, mostly on `transform`/`opacity`, short
   and ease-out. Switching pages, sorting, filtering, paging and keyboard moves never animate; the one exception is the
   panel sliding in or out (§6).

## 2. Shell and wayfinding

```
┌──────┬──────────────────────┬────────────────────────────────────────────────────────────────┐
│ (PN) │ ✈ Telegram           │  Groups                                                         │ page header:
│  🔍  │──────────────────────│  680 groups managed by the bot                     [+ Primary]  │ h1 + context + actions
│ ──── │   👤 Users           │                                                                │
│▌ ✈   │ ▌ 💬 Groups          │  [🔍 Search by group name or tag…  /] [Labels ▾] [All|Visible|Hidden] │ toolbar row
│  💬  │   🛡 Grants          │  ┌────────────────────────────────────────────────────────────┐ │
│  ☁   │                      │  │ Group            Telegram ID   Labels        Actions       │ │
│  🌐  │                      │  │ Analisi 1        -1001234567   Didattica…    ⎘ ↗ │ 👁 🏷 ⇥ │ │ 52px rows
│  ⚑•  │                      │  └────────────────────────────────────────────────────────────┘ │
│  ☀   │                      │                                                                │
│ (GV) │                      │                                                                │
└──────┴──────────────────────┴────────────────────────────────────────────────────────────────┘
  rail        panel (240px)         scrolling column: page header, toolbar row, content
```

Below 760px:

```
┌──────────────────────────────────┐
│ (PN) Telegram          🔍  ☀ (GV) │ top bar
│ (👤 Users) (💬 Groups) (🛡 Grants) │ section pills, scroll with the page
│ Groups                            │
│ 680 groups managed by the bot     │
│ [        + Primary action       ] │
│ [🔍 Search…                      ] │
│ ┌───────────────────────────────┐ │
│ │ Analisi Matematica 1          │ │ tables become stacked cards
│ │ -1001234567  @am1             │ │
│ │ ⎘ ↗ │ 👁 🏷 ⇥                  │ │
│ └───────────────────────────────┘ │
│  ✈      💬      ☁      🌐     ⚑•   │ bottom nav, sticky
└──────────────────────────────────┘
```

Vocabulary, used throughout:

- **Service**: a rail entry (Telegram, WhatsApp, Microsoft 365, Web, Reports), plus Overview (the logo) and Account
  (the avatar).
- **Section**: a panel entry inside a service (Telegram › Groups).
- **Deep page**: a page under a section that is not in the panel (Telegram user, category node, tag page).
- **Page header**: the top of every page, rendered through `PageBar`: the `h1`, one line of context and the page
  actions; deep pages show a back button and a breadcrumb instead.
- **Toolbar**: the row under the page header: `lead` (controls that scope the page), search, filters and `Count`.

Services and sections are defined once, in `src/components/shell/nav.ts`, with each section's icon, search placeholder
and whether it reads `?q=`; rail, panel, pills, bottom nav, command palette and Overview read from it. A service is
drawn with its monochrome `icon`; the bottom nav uses its `short` label ("M365"). Never import logos.

**Where each level is named**

| Level   | Named by                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------ |
| Service | the panel header (desktop) or the top bar title (mobile); the rail only highlights it            |
| Section | the active panel item or pill, and the page `h1` (defaults to the section title)                 |
| Record  | the `h1` in `RecordHeader` on deep pages; the page header shows a back button and the breadcrumb |
| Page    | Overview and Account pass their own `title` to `PageBar`                                         |

**Rail** (64px, from 760px). One tab stop with roving focus (`↑/↓`, `Home/End`). The PoliNetwork logo is the link to
Overview and gets an accent ring while Overview is open; then Search (opens the palette), a divider and the five
services as monochrome icons. The active service has a muted fill and a 3px accent bar on the rail's edge. Reports shows
an accent dot while there are open reports. A service opens the last section visited in that service this session,
else its first. Theme toggle and the account avatar (ringed while Account is open) sit at the bottom; sign out lives on
the Account page.

**Panel** (240px, 200px below 1100px). Rendered only for services with two or more sections (Telegram, Microsoft 365,
Web, Reports); WhatsApp, Overview and Account have none. A 64px header with the service icon and title, then 38px items:
the current one has a muted fill, an accent icon and a 3px accent bar; on deep pages the parent section keeps the fill
and accent icon without the bar (`data-ancestor`). The only count is the open reports next to Reports › Open, as a
small accent pill.

**Page header.** Scrolls with the page (the page, not the document, scrolls: the column below the top bar is the
scroll container). `h1` 24px (22px on mobile) with the context line in 14px muted, actions on the right at 40px; below
760px the actions take the full width under the title. The toolbar row follows 20px below. `/` focuses the page
search from anywhere; `Esc` clears it. A service with a single section (WhatsApp) shows its icon in a 44px tile next to
the `h1`.

| Template          | Header                                                       | Toolbar row                                  |
| ----------------- | ------------------------------------------------------------ | -------------------------------------------- |
| Section page      | `h1` + context line, one primary action, ≤ 1 `outline`       | `Toolbar`: lead → search → filters → `Count` |
| Deep page         | `BackButton` → breadcrumb (section / parent), record actions | none; `RecordHeader` follows in the content  |
| Overview, Account | `h1`                                                         | none                                         |

**Small screens** (below 760px). Rail and panel leave the layout. A 56px top bar holds the logo (Overview), the
service title ("PoliNetwork Admin" on Overview), Search, the theme toggle and the avatar; the service's sections follow
as horizontally scrolling pills that scroll away with the page; a 64px bottom nav lists the five services (current one
accent with a top bar, Reports with the open-reports dot). Section pills and bottom nav are the only navigation; there
is no sheet.

**Command palette** (`⌘K`/`Ctrl+K`, the rail and top bar Search, the Overview search): sections, "Find “…” in
{Service} › {Section}" for every section that reads `?q=` (Telegram users and groups, WhatsApp groups), and shell
actions (theme, account, sign out).

## 3. Page templates

Wrap every page body in `PageContent` and give `PageBar` the same `width` (both default to `wide`), so header and content
share edges. Every route's `pendingComponent` renders the same `PageBar` (deep pages: with their `back`), so the title
does not move when data arrives.

| Template        | `width`    | Used by                                                        |
| --------------- | ---------- | -------------------------------------------------------------- |
| List            | `wide`     | Telegram users, groups, grants; WhatsApp groups; Members; FAQs |
| Queue           | `wide`     | Reports › Open, Reports › Closed                               |
| Card collection | `wide`     | Projects, Associations                                         |
| Grouped         | `wide`     | Microsoft 365 groups                                           |
| Browser         | `wide`     | Categories root and nodes, tag page                            |
| Tree            | `tree`     | Labels, Freshman guide                                         |
| Record          | `record`   | Telegram user                                                  |
| Settings        | `settings` | Account                                                        |
| Overview        | `overview` | Overview                                                       |

**List.** A `DataTable` with search and filters in the toolbar. One row height (52px), no dense mode. Columns declare a
priority; from 760px the lowest hide first when the table surface narrows, never the first or the actions column.
Below 760px every row is a stacked card: the first column on its own line, the others inline as 12px meta
(`mobile: "full"` gives a column its own line, `"hidden"` drops it), the actions on their own line. Give columns
whose content length varies a `width` (the table switches to fixed layout and the title column takes the rest), so
nothing jumps across search, filters and paging. Pagination shows in the table footer once rows exceed the smallest page
size (20; options 20/50/100). The page resets to page 1 itself when search, filters or sort change (`DataTable`
doesn't). List state that other pages link to (`?q=`, `?visibility=`) goes through the route's `validateSearch`. Without
write access the primary action and mutation controls disappear (read-only actions such as copying an invite link stay).

**Queue.** A list whose rows are worked off: segmented filter with totals, row click opens the reported group or
category, and resolve/dismiss remove the row optimistically.

**Card collection.** Cards edited in place (`InlineEditCard`, §5). New items start as a draft card on top. Cards in a
row share their height so footers line up.

**Grouped.** Collapsible surfaces (`Reveal`) with a count in the heading; open state persists in session storage and
search expands every group.

**Browser.** `NavCard` grids to walk a hierarchy, then the items at this level in a table. On node pages the header
bar's left slot holds the parent path, so the search sits in the table's `SectionHeading` instead (the one exception).

**Tree.** One bordered surface per section, 44px rows, indentation for depth, a rotating chevron. Expanded nodes persist
in session storage; search force-expands.

**Record.** `RecordHeader` (64px avatar or label dot, 28px `h1` with an optional status badge, meta, description),
then `SectionCard`s. The Telegram user puts recent messages and grants side by side from 1000px (1.55 : 1), with the
audit log full width below; no summary tiles.

**Settings.** `SectionCard`s in one column, each with a title and an action slot. The destructive card goes last,
further apart, without a red border.

**Overview.** A 52px search that opens the command palette; a hero card with the Telegram users total, its growth over
the selected range and a TanStack Charts line (3M per day, 1Y per week, All per month; one 2px accent line, a light
grid, month labels, a dashed hover guide and a tooltip with the date, total and growth), and Telegram groups, Open
reports and Active grants as links on its right (a row under it on mobile); then "Areas": one card per service whose
whole surface leads where the rail icon does, with each section as a 44px button.

**States.** While a route loads, its `pendingComponent` renders `PageBar`, `PageContent` and the template's skeleton
(`TableSkeleton`, `CardsSkeleton`, `RecordSkeleton`, `SettingsListSkeleton`, labelled "Loading {things}…"), so nothing
shifts when data arrives. Empty uses `EmptyState` (page) or `SectionEmpty` (one card or slot), see §7. A failed loader
renders the route error; pages that load parts independently (Overview, Account) show an inline warning with Retry
instead.

## 4. Tokens

Use only the `--pn-*` variables (or the Tailwind utilities that resolve to them). Raw hex and Tailwind palette colors
(`slate-*`, `amber-*`…) are defects; the one exception is label colors, which are user data and go through `LabelChip`.
shadcn's variables (`--primary`, `--border`…) are remapped to `--pn-*` in `styles.css`, so `@/components/ui/*` re-theme
without edits. Light borders are alpha so they composite; dark borders are solid so they don't glow.

| Role                | Variables                                                                                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Canvas and surfaces | `--pn-bg` canvas · `--pn-surface` cards, tables · `--pn-surface-raised` popover, menu, dialog, toast · `--pn-nav` rail, panel, top bar, pills row, bottom nav                                                            |
| Fills               | `--pn-muted` hover, skeleton, neutral fills · `--pn-nav-active` active panel item · `--pn-scrim` backdrop (no blur)                                                                                                      |
| Lines               | `--pn-line` static borders · `--pn-line-strong` inputs, dividers on muted fills                                                                                                                                          |
| Text                | `--pn-fg` · `--pn-fg-muted` secondary text and icons · `--pn-fg-subtle` placeholders, disabled, decorative glyphs; never information                                                                                     |
| Accent              | `--pn-accent(-hover)` text, icons, links · `--pn-accent-solid(-hover, -fg)` primary button · `--pn-accent-soft(-hover)` active/selected fills · `--pn-focus` · `--pn-selection`                                          |
| Status              | `--pn-{success,warning,danger}-{fg,bg,solid}`, `--pn-info-{fg,bg}`                                                                                                                                                       |
| Charts              | paints are the same variables: `--pn-accent-solid` line, `--pn-line` grid, `--pn-fg-muted` labels, so charts follow the theme without rebuilding                                                                         |
| Elevation           | `--pn-shadow-float` popover, menu, toast · `--pn-shadow-modal` dialog, sheet · `--pn-media-ring` images, avatars                                                                                                         |
| Radii               | `--pn-r-1` 4 kbd, swatches · `-2` 6 menu items · `-3` 8 buttons, rail and panel items · `-4` 10 popovers, inner tiles · `-5` 12 cards, tables, toasts · 14 dialogs, hero and area cards · `-full` badges, pills, avatars |
| Motion              | `--pn-ease-out`, `--pn-ease-in`, `--pn-ease-move`                                                                                                                                                                        |

Nested radii: inner = outer − padding.

**Spacing.** 4px grid (4, 8, 12, 16, 20, 24, 32, 48). Lay out with `gap`, not per-child margins. Card padding 16px (20px
on Settings).

**Type.** DM Sans; DM Mono for identifiers (Telegram IDs, chat ids, emails in M365, label paths, versions), counts
next to headings and in segments, the `/` and IT/EN tags and chart axes. Sizes: 12 captions, hints, table headers,
meta · 13 secondary rows · 14 body, table cells, panel items, inputs, dialog descriptions · 15/600 card titles · 17/600
section headings · 18/600 dialog titles, empty-state titles · 24/600 page `h1` (22 on mobile) · 28/600 `RecordHeader`
`h1`, stat numbers · 44/600 the Overview users total. Weights 400/500/600, and never change on hover, active or
selected. No uppercase (no eyebrows, no uppercase table headers; the
IT/EN language codes are the exception) and no italic. Numbers, counts and dates get `tabular-nums` and never wrap.
Headings `text-wrap: balance`, body `pretty`. Truncate with an ellipsis plus a `title`. Use `…`, not three dots. Inputs
are 16px on coarse pointers (no iOS zoom).

**Focus.** One global ring (`:focus-visible`, `--pn-focus`) in `styles.css`; inputs swap it for a border plus soft ring;
invalid fields show the danger border. Opt out only with `data-focus-ring="none"` when the element draws its own.

## 5. Components

Build from `@/components/shell` and `@/components/primitives`; reach into `@/components/ui` only for what the primitives
don't wrap. Each primitive's JSDoc states its props and rules. In the dashboard these `ui/` parts are replaced: `card`
and `alert` by `SectionCard`/surfaces and `InlineAlert` (they remain for login and onboarding); `collapsible` and
accordion's `AccordionContent` by `Reveal` (or Base UI `Accordion.Panel` with the grid-rows transition, as in FAQs),
because they animate height; `skeleton` by the primitives' skeletons.

**Tables (`DataTable`).** 12px radius surface, sentence-case 12px headers (42px, sticky), 14px cells in 52px rows, a
visible "Actions" header. Sortable headers are buttons with `aria-sort`; an unsorted column shows its sort icon only on
hover or focus. Numeric quantities right-aligned; identifiers mono, left-aligned. A clickable row is focusable, opens on
`Enter`/`Space`, has `aria-label="Open {name}"` and its first cell is a real link (`rowHref`; return `null` for rows
that go nowhere). In stacked cards every value after the first carries its column name, visually hidden, so screen
readers keep the context the hidden header row gave. Only the first column may carry a 12px secondary line; people get a 32px initials avatar. Chip lists
never wrap on desktop (`ChipOverflow`). Pagination: "Showing 1–20 of 680", rows per page and ‹ 1 2 3 … 34 › (no
first/last buttons); on narrow tables "‹ 1 of 34 ›".

**Row actions** (`RowActions`, `IconButton`). Order: other actions → edit → delete → `⋮` menu, the menu always far
right. Always visible, 2px apart, monochrome `--pn-fg-muted` ghosts: `tone="danger"` (and success/warning) only tints
the hover; `tone="info"` marks an "on" state in accent (the visibility eye). Group rows separate the invite-link pair
from the rest with a 1px divider; a group without a link shows an amber "Not shared" badge in place of the pair. In
tables mixing Telegram and WhatsApp rows an action one platform lacks keeps an empty 36px slot, so the columns of icons
align. Queues use labelled buttons instead (Reports: ghost "Dismiss", outline "Resolve"). Outside tables,
`appearance="boxed"` draws a bordered 36px button (Microsoft 365 add/remove member).

**Badges and chips.** `StatusBadge` (dot + label, tones `neutral`/`brand`/`success`/`warning`/`danger`) only for states:
grant Active (success), Scheduled (brand); report Pending (warning), Resolved (success), Dismissed (neutral); session
"Current" and guide edition "Latest" (brand); Draft (warning). Absence of a state shows nothing (no "Visible", "Public"
or "Published" badges). `Chip` for categorical values (roles, licenses, IT/EN markers). `LabelChip` for labels.
`CountBadge` for neutral counts such as `×3` duplicates. Platforms are a 16px monochrome `PlatformGlyph` (the service's
lucide icon with an accessible name), not a text badge.

**Buttons.** Text buttons `size="sm"` (36px), icon buttons `icon-sm` (36px); page-header actions and toolbar controls
(search, filter buttons, toggles, segmented controls) are 40px, as are dialog footer buttons; never `xs`. One `default`
(primary) button per region (page header, dialog footer, form card); secondaries
`outline`, tertiary `ghost`. Destructive in page content is an `outline` with danger text, solid danger only inside a
confirm dialog. Every icon button has an `aria-label` and a tooltip with the same text. A raw `ui` `Button` gets
`className={buttonMotion}`; pending actions use `LoadingButton` (spinner, `disabled`, `aria-busy`, motion included).
Labels are verb + object in sentence case ("Add group", "Publish 12 groups").

**Dialogs.** Forms use `FormDialog` (`md` one column, `lg` two columns or steppers); confirmations use `ConfirmDialog`
(460px `AlertDialog`, no close button, no outside-click close, focus on Cancel). 14px panel radius; header: 18px title
and 14px description, no eyebrow; confirmations lead with a 40px icon tile (danger-tinted for destructive ones, a
warning sign unless the action has its own icon). Footer right-aligned, buttons side by side at every width: `Cancel`
(`outline`) then the primary (solid danger for destructive confirmations). Below 760px every dialog is a bottom sheet:
full width, rounded top, sliding up. `Enter` submits single-line fields,
`⌘/Ctrl+Enter` textareas. On error an `InlineAlert` appears above the footer and the dialog stays open. On success a
toast fires and the dialog closes: `ConfirmDialog` closes itself, `FormDialog` doesn't, so call `onOpenChange(false)`
after the mutation, and keep the dialog's record in state after closing so its content survives the exit animation. A
dirty form intercepts every close with the discard confirmation (`FormDialog` does it when the dialog passes `dirty`).
Key a dialog body with `useOpenGeneration` so every opening starts clean. Autofocus the first field on fine pointers
only.

**Popover or dialog.** Popover only when all hold: not destructive, at most one input or a picker, at most 320px wide,
and closing without acting is harmless. Otherwise a dialog. Every delete is a `ConfirmDialog`.

**Inline editing** (`InlineEditCard`, `InlineEditRow`, `useEditSlot`), used by Projects, Associations, FAQs and Labels:

1. `✎` among the actions enters edit mode. One item per page edits at a time; starting another closes a clean one or
   asks to discard a dirty one.
2. Each text becomes a labelled field, the card keeps its width and grid position, and gets an accent border with a
   soft accent ring.
3. Footer: validation message left; "Cancel" (`outline`, with an `Esc` hint) and "Save" (primary, with a `⌘ ↵` hint,
   enabled when valid and dirty) right; the hints hide on coarse pointers. `Esc` cancels, `Enter`/`⌘Enter` saves. A
   shortcut on an unchanged record closes the editor; on an invalid one it focuses the first invalid field.
4. Saving shows the spinner in the save button and makes the fields read-only; errors appear in the footer, success
   closes edit mode with a toast.

**Bilingual text** (`TranslationGroup`/`TranslationPanel`): one panel per language, Italian first, side by side from
560px container width, stacked below; each panel sets `lang`. View: a small DM Mono "IT"/"EN" tag over the text. Edit:
the language name over a field-like box that holds the `bare` input. Single-line list rows use IT/EN tiny chips.

**Forms** (`FormField`, `fieldControl`). Label above, real `<label for>`. Required is unmarked; optional fields say
"(optional)". Hints 12px under the field. Validate on submit, then on blur for fields that have errored; never per
keystroke. Errors: danger border, 12px danger text with an icon, `aria-invalid` + `aria-describedby`. Read-only values
are text in a `KeyValueList`, never disabled inputs. Length counters (`FieldCounter`) appear only in the last 20% of the
limit.

**Alerts and toasts.** `InlineAlert` for what persists or needs action: load errors, dialog submit errors, partial
saves. It defaults to `tone="danger"` and `role="alert"`, so pass another tone for notices that aren't errors. Toasts
(`appToast.success/info/warning/error`, never raw `toast`) confirm actions; untinted, tone on the icon only, at most
three, never infinite, no "Undo".

**Accessibility.** Every input has a label; focus is never removed; dialogs trap focus and return it to the trigger;
when a row disappears (optimistic removal, confirmed delete) `useFocusAfterRemoval` keeps focus in the list. Color is
never the only signal. Hit areas are at least 36px. DOM order matches visual order.

## 6. Motion

Shared classes live in `primitives/motion.ts` (`buttonMotion`, `floatingMotion`, `dialogMotion`, `scrimClasses`).
`transition-property` is always explicit (no `transition-all`). Exits are shorter than entrances and ease in.

| Element                                                                                | Motion                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hover (rail, panel, rows, buttons)                                                     | `background-color`/`color` 120ms; text buttons press `translateY(1px)`, icon buttons don't                                                                                                                               |
| Tooltip                                                                                | 100ms delay (`TOOLTIP_DELAY`), 400ms on the rail (`TOOLTIP_DELAY_SLOW`); siblings open instantly within 300ms                                                                                                            |
| Popover, menu, combobox list                                                           | opacity + scale .97→1 from the trigger, 160ms in / 120ms out (`floatingMotion`)                                                                                                                                          |
| Dialog and scrim                                                                       | opacity (+ scale .97 on the panel), 200ms in / 150ms out (`dialogMotion`)                                                                                                                                                |
| Bottom sheet (dialogs below 760px)                                                     | slide up with the dialog fade, 200ms in / 150ms out                                                                                                                                                                      |
| Panel appearing or leaving                                                             | panel and content column slide together as transforms, 220ms in / 180ms out; the leaving panel leaves the flow at once, so width never animates                                                                          |
| Accordion, collapsible, tree                                                           | `grid-template-rows` 0fr→1fr 200ms (`--pn-ease-move`) + content opacity; chevron rotates                                                                                                                                 |
| Drag (Projects)                                                                        | ghost lifts instantly; siblings move 160ms; drop settles 200ms                                                                                                                                                           |
| Optimistic row removal                                                                 | opacity out 120ms, then unmount without height animation                                                                                                                                                                 |
| Copy feedback (invite link)                                                            | icon swap with a short bounce-free spring                                                                                                                                                                                |
| Chart tooltip and hover guide                                                          | none: they follow the pointer or keyboard focus                                                                                                                                                                          |
| Skeleton                                                                               | opacity pulse 1.4s; the only loop besides spinners                                                                                                                                                                       |
| Theme toggle                                                                           | light-bulb reveal: a View Transition `clip-path` circle from the toggle (700ms to light, 520ms to dark), reversible mid-way; element transitions are off while it runs (`data-theme-switching`). Go through `useTheme()` |
| Navigation, sort, filter, paging, inline-edit swap, command palette, active indicators | none                                                                                                                                                                                                                     |

Reduced motion: the global rule in `styles.css` zeroes CSS durations; `motion/react` code checks `useReducedMotion()`;
the theme reveal and the skeleton pulse switch off.

## 7. Copy

- Sentence case everywhere. Verb first, object named: "Delete passkey", "Save labels".
- No "please", "successfully", exclamation marks or "Are you sure". Contractions are fine in errors.
- "Microsoft 365", never "Azure" or "Office 365", in user-facing text ("Microsoft Entra" when naming the directory).
- **Confirmations:** title "{Verb} {object}?", one sentence stating the consequence, `Cancel` + "{Verb} {object}"
  (danger for destructive, primary for publish). Discard prompts use `Keep editing` / `Discard`.
- **Toasts:** success "{Object} {past participle}." ("Group deleted.", "Grant created for {name}."); error "Couldn't
  {verb} {object}." plus at most one next step; partial "{What happened}, but {what didn't}." Server messages that carry
  information are shown verbatim.
- **Empty states:** title "No {things} yet" (nothing exists), "No {things} match" (filtered), or a scoped title when the
  view is a subset ("No open reports", "Nothing needs attention"); one sentence on what will appear and how, or how to
  widen the filter. Action: the page's create action as `outline` (the header primary stays), or a `ghost` "Clear
  search"/"Clear filters".
- **Counts** (`Count`, `Intl.PluralRules`): "{n} {noun}" or "{n} of {total} {noun}", joined with " · ", never "results".
  The page header's context line carries the list's total, so the toolbar `Count` appears only while search or a
  filter narrows the list ("12 of 680 groups"). Segmented filters show a bare total per option over the whole list. Next to such a filter the toolbar `Count` appears
  only while search or another filter narrows the list further.
- **Dates** (`src/lib/format.ts`): "6 Oct 2026", "6 Oct 2026, 09:00", ranges with " → ". Always `Europe/Rome` and
  `en-GB`, so server and browser render the same text; inputs use the local timezone. No relative times in tables.
- **Unset values:** `Unset` renders `—` (muted, `aria-label="Not set"`) instead of "Not set", "No description" and the
  like. Fallbacks that name a thing stay words: "Unnamed passkey", "Unknown device", "User {id}".

## 8. Page notes

Rules that the templates above don't imply.

- **Overview**: the hero stats link to their section; a service that failed to load shows `—` and one warning alert
  with Retry. The users chart reads `tg.users.getCreationHistory` (new users per Europe/Rome day, from `created_at`)
  through `getTelegramUserHistory`; the range buckets are computed in the browser. Without `tg:users:read` the hero
  shows only the stats; while the backend lacks the procedure, or refuses it as unauthenticated (agent mode calls
  the backend anonymously and the procedure is token-only), the chart is left out and the total stays.
- **Account**: the exemplar Settings page. Passkeys and sessions load together and share one Retry. Sign out needs no
  confirmation (signing in again undoes it).
- **Telegram users**: no create action (users appear once the bot sees them); search strips a leading `@`.
- **Telegram user**: grant actions (End grant, Add grant) are the page header actions, as grants are the main act on a
  user. Role buttons disable with a tooltip explaining why instead of hiding.
- **Grants**: a row opens the grantee; "Authorized by" links to the grantor.
- **Telegram and WhatsApp groups**: `?q=` prefills the search and `?visibility=` the segment (Reports, Overview and the
  user page link here that way). Telegram groups are bot-managed: no create action, the destructive action is "Leave".
  The visibility toggle is optimistic with one request in flight.
- **Microsoft 365 members**: the member ID edit is optimistic.
- **Projects**: one column at every width, because card order is the order on the website; drag to reorder (handle
  only), a failed reorder reverts. Segments replace `Count`.
- **Associations**: links are edited in their own dialog, not inline.
- **FAQs**: the categories are a list beside the questions (icon, Italian title, count; pills below 1100px) ending in a
  dashed "Add category"; the selected category's header holds its edit and delete actions and the question search.
- **Freshman guide**: the latest edition is a card (version, "Latest", publication date, Download PDF) above the "All
  editions" table.
- **Categories**: each fixed root is a card that opens it, with its first five sub-categories as chips carrying their
  group counts and "+ n more".
- **Labels**: three kinds (categories, attributes, publications), each a `SectionHeading` with a one-line description:
  the only section descriptions in the app, because users confuse the kinds.
- **Categories and tag pages**: a node lists only groups tagged with exactly that path. Publishing a tag acts on every
  row, not the searched subset.
- **Reports**: rows group duplicates (`×n`), but counts and the panel badge count individual reports. Open is
  oldest-first, Closed newest-first. The rail and bottom nav show a dot on Reports while any report is open.
- **Account**: permissions are grouped by area (Dashboard, Telegram, WhatsApp, group labels, Microsoft 365, Web) with
  the service icon.
