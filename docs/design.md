# Design system

The rules every dashboard page follows. Measurements and copy live in the code: token values in `src/styles.css`,
component props and geometry in each primitive's JSDoc, page copy in the page. This file says which piece to use, where,
and why. When you change a rule, change it here in the same commit.

Login and onboarding pages use the same tokens but not the shell.

## 1. Principles

1. **Say it once.** Every place, control, label and number appears once per screen. No breadcrumbs, eyebrows, page
   descriptions or `h1` on section pages; no count that repeats one already visible.
2. **The chrome is for finding; the content is for doing.** Rail, panel and header bar locate and filter; nothing in
   them explains. Help lives in empty states, field hints and dialog descriptions.
3. **One accent, neutral everything else.** Brand blue marks the active location, the one primary action, links and
   focus. Icons are `--pn-fg-muted`. The only multicolor marks are the Telegram, WhatsApp and Microsoft 365 logos.
   Status uses the fixed tones, never ad-hoc colors.
4. **Borders separate; shadows float.** Static surfaces (cards, tables, nav) get a 1px line; only layers above the page
   (popover, menu, dialog, sheet, toast, drag ghost) cast a shadow.
5. **Motion confirms, never decorates.** Animate only changes the user caused, mostly on `transform`/`opacity`, short
   and ease-out. Switching pages, sorting, filtering, paging and keyboard moves never animate; the one exception is the
   panel sliding in or out (§6).

## 2. Shell and wayfinding

```
┌──────┬────────────────────┬──────────────────────────────────────────────────────────────────┐
│ [PN] │ ✈ Telegram         │ [🔍 Search by name or tag…] [Labels ▾] [All|Visible|Hidden]   …  │ header bar
│ ▦ Ov │────────────────────│                                                                  │
│ 🔍 ⌘K│   Users            │  Group               Telegram ID   Tag      Labels         ⎘ ↗ 👁 🏷 ⇥│
│──────│ ▌ Groups           │  Analisi Matematica  -1001234567   @am1     Didattica › …          │
│▌✈ Tg │   Grants           │  …                                                               │
│ ◯ Wa │                    │  Showing 1–20 of 1,318                  Rows 20 ▾   ‹ 1 2 … 66 › │
│ ☁ M3 │                    │                                                                  │
│ ⊕ We │                    │                                                                  │
│ ⚑ Re │                    │                                                                  │
│ ☾ (LC)                    │                                                                  │
└──────┴────────────────────┴──────────────────────────────────────────────────────────────────┘
  rail      panel                      content column: header bar + scrolling main
```

Vocabulary, used throughout:

- **Service**: a rail entry (Overview, Telegram, WhatsApp, Microsoft 365, Web, Reports, Account).
- **Section**: a panel entry inside a service (Telegram › Groups).
- **Deep page**: a page under a section that is not in the panel (Telegram user, category node, tag page).
- **Header bar**: the bar on top of the content column, rendered by each page through `PageBar`.
- **Toolbar**: `lead` (controls that scope the page, such as the FAQ category), search, filters and `Count`; on section
  pages it is the header bar's left slot.

Services and sections are defined once, in `src/components/shell/nav.ts`, with each section's search placeholder; rail,
panel, sheet, command palette and Overview read from it. Services are drawn with `ServiceGlyph` (the branded logo for
Telegram, WhatsApp and Microsoft 365, lucide otherwise): never import the SVGs.

**Where each level is named**

| Level   | Named by                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------- |
| Service | the panel header (the rail only highlights it; its name is a tooltip)                               |
| Section | the active panel item; the shell also renders an sr-only `h1`                                       |
| Record  | the `h1` in `RecordHeader` on deep pages; the header bar shows the parent context and a back button |
| Page    | Overview and Account have no panel, so `PageBar title` renders their `h1` in the header bar         |

**Rail.** One tab stop with roving focus (`↑/↓`, `Home/End`). A service opens the last section visited in that service
this session, else its first. The logo is decoration (Overview right below it leads home). Theme toggle and the account
avatar sit at the bottom; sign out lives on the Account page.

**Panel.** Rendered only for services with two or more sections (Telegram, Microsoft 365, Web, Reports). WhatsApp,
Overview and Account have none, and the content column takes the width. On deep pages the parent section stays
highlighted (`data-ancestor`). The only count in the panel is the open reports next to Reports › Open. (`nav.ts`'s
`panelServices` are the services that have sections, for rail, sheet and palette; the panel itself needs two.)

**Header bar.** Sits outside the scroll container (`main` scrolls, the document never does), so search and actions never
scroll away. `/` focuses the page search from anywhere; `Esc` clears it. Left/right slots per template:

| Template          | Left                                                                  | Right                                               |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| Section page      | `Toolbar`: lead → search → filters → `Count`                          | one primary action, at most one `outline` secondary |
| Deep page         | `BackButton` → parent context (mono when it is an id) → `ScrollTitle` | record actions; the primary is right-most           |
| Overview, Account | `h1`                                                                  | —                                                   |

`ScrollTitle` fades the record name into the bar only while the content `h1` is scrolled out of view.

**Small screens.** Below 1024px the panel leaves the layout and becomes a left `Sheet` opened from a button at the start
of the header bar; on section pages the bar gains a first row reading "{Service} › {Section}" and the toolbar wraps
below it. Below 640px the rail is hidden too and the sheet is the only navigation (it adds Overview, Search, Theme and
Account rows).

**Command palette** (`⌘K`/`Ctrl+K`): sections and shell actions (theme, account, sign out); records are not searchable
there.

## 3. Page templates

Wrap every page body in `PageContent` and give `PageBar` the same `width` (both default to `wide`), so bar and content
share edges.

| Template        | `width`    | Used by                                                                        |
| --------------- | ---------- | ------------------------------------------------------------------------------ |
| List            | `wide`     | Telegram users, groups, grants; WhatsApp groups; Members; Freshman guide; FAQs |
| Queue           | `wide`     | Reports › Open, Reports › Closed                                               |
| Card collection | `wide`     | Projects, Associations                                                         |
| Grouped         | `wide`     | Microsoft 365 groups                                                           |
| Browser         | `wide`     | Categories root and nodes, tag page                                            |
| Tree            | `tree`     | Labels                                                                         |
| Record          | `record`   | Telegram user                                                                  |
| Settings        | `settings` | Account                                                                        |
| Overview        | `overview` | Overview                                                                       |

**List.** A `DataTable` with search and filters in the toolbar. One row height (44px), no dense mode. Columns declare a
priority; the lowest hide first when the table surface narrows, never the first or the actions column. Give columns
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

**Record.** `RecordHeader` (avatar, `h1`, meta, chips), then `SectionCard`s in one column, no summary tiles.

**Settings.** `SectionCard`s in one column, each with a title and an action slot. The destructive card goes last,
further apart, without a red border.

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

| Role                | Variables                                                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas and surfaces | `--pn-bg` canvas · `--pn-surface` cards, tables · `--pn-surface-raised` popover, menu, dialog, toast · `--pn-nav` rail and panel                                                                          |
| Fills               | `--pn-muted` hover, skeleton, neutral fills · `--pn-nav-active` active panel item · `--pn-scrim` backdrop (no blur)                                                                                       |
| Lines               | `--pn-line` static borders · `--pn-line-strong` inputs, dividers on muted fills                                                                                                                           |
| Text                | `--pn-fg` · `--pn-fg-muted` secondary text and icons · `--pn-fg-subtle` placeholders, disabled, decorative glyphs; never information                                                                      |
| Accent              | `--pn-accent(-hover)` text, icons, links · `--pn-accent-solid(-hover, -fg)` primary button · `--pn-accent-soft(-hover)` active/selected fills · `--pn-focus` · `--pn-selection`                           |
| Status              | `--pn-{success,warning,danger}-{fg,bg,solid}`, `--pn-info-{fg,bg}`                                                                                                                                        |
| Row-action tones    | `--pn-action-{blue,green,amber,red}`, `--pn-action-{green,amber}-tint`: only through `IconButton appearance="tinted"`                                                                                     |
| Elevation           | `--pn-shadow-float` popover, menu, toast · `--pn-shadow-modal` dialog, sheet · `--pn-media-ring` images, avatars                                                                                          |
| Radii               | `--pn-r-1` 4 kbd, swatches · `-2` 6 menu/panel items · `-3` 8 `sm` buttons, rail items, search field · `-4` 10 cards, tables, popovers · `-5` 12 dialogs, sheets, toasts · `-full` badges, chips, avatars |
| Motion              | `--pn-ease-out`, `--pn-ease-in`, `--pn-ease-move`                                                                                                                                                         |

Nested radii: inner = outer − padding.

**Spacing.** 4px grid (4, 8, 12, 16, 20, 24, 32, 48). Lay out with `gap`, not per-child margins. Card padding 16px (20px
on Settings).

**Type.** DM Sans, DM Mono for identifiers only (Telegram IDs, chat ids, label paths, versions). Sizes: 12 captions,
hints, table headers, meta · 13 table cells, rows, panel items, dialog descriptions · 14 body, inputs · 15/600 header
bar `h1`, dialog and card titles · 18/600 empty-state titles · 20/600 `RecordHeader` `h1` · 28/600 stat numbers. Weights
400/500/600, and never change on hover, active or selected. No uppercase (no eyebrows, no uppercase table headers; the
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

**Tables (`DataTable`).** Sentence-case 12px headers, sticky. Sortable headers are buttons with `aria-sort`; an unsorted
column shows its sort icon only on hover or focus. Numeric quantities right-aligned; identifiers mono, left-aligned. A
clickable row is focusable, opens on `Enter`/`Space`, has `aria-label="Open {name}"` and its first cell is a real link
(`rowHref`; return `null` for rows that go nowhere). Only the first column may carry a 12px secondary line. Chip lists
never wrap (`ChipOverflow`), so rows stay 44px.

**Row actions** (`RowActions`, `IconButton`). Order: other actions → edit → delete → `⋮` menu, the menu always far
right. Always visible. Default `ghost` in `--pn-fg-muted`; group tables use `appearance="tinted"` with a tone per action
(blue visible, gray hidden, green edit, amber labels, red leave/delete). In tables mixing Telegram and WhatsApp rows an
action one platform lacks keeps an empty 36px slot, so the columns of icons align.

**Badges and chips.** `StatusBadge` (dot + label, tones `neutral`/`brand`/`success`/`warning`/`danger`) only for states:
grant Active (success), Scheduled (brand); report Pending (warning), Resolved (success), Dismissed (neutral); session
"Current" and guide edition "Latest" (brand); Draft (warning). Absence of a state shows nothing (no "Visible", "Public"
or "Published" badges). `Chip` for categorical values (roles, licenses, IT/EN markers). `LabelChip` for labels.
`CountBadge` for neutral counts such as `×3` duplicates. Platforms are a 14px `PlatformGlyph` (an image with alt text),
not a text badge.

**Buttons.** Text buttons `size="sm"` (36px), icon buttons `icon-sm` (36px); the 40px `default` size only in dialog
footers; never `xs`. One `default` (primary) button per region (header bar, dialog footer, form card); secondaries
`outline`, tertiary `ghost`. Destructive in page content is an `outline` with danger text, solid danger only inside a
confirm dialog. Every icon button has an `aria-label` and a tooltip with the same text. A raw `ui` `Button` gets
`className={buttonMotion}`; pending actions use `LoadingButton` (spinner, `disabled`, `aria-busy`, motion included).
Labels are verb + object in sentence case ("Add group", "Publish 12 groups").

**Dialogs.** Forms use `FormDialog` (`md` one column, `lg` two columns or steppers); confirmations use `ConfirmDialog`
(400px `AlertDialog`, no close button, no outside-click close, focus on Cancel). Header: title + description, no icon,
no eyebrow. Footer right-aligned: `Cancel` (`outline`) then the primary. `Enter` submits single-line fields,
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
2. Each text becomes a field in the same place, the card keeps its width and grid position, and its border turns dashed
   accent.
3. Footer: validation message or the shortcut hint (hidden on coarse pointers) left; tinted cancel (`X`) and save
   (`Check`, enabled when valid and dirty) right. `Esc` cancels, `Enter`/`⌘Enter` saves. A shortcut on an unchanged
   record closes the editor; on an invalid one it focuses the first invalid field.
4. Saving shows the spinner in the save button and makes the fields read-only; errors appear in the footer, success
   closes edit mode with a toast.

**Bilingual text** (`TranslationGroup`/`TranslationPanel`): one panel per language, Italian first, side by side from
560px container width, stacked below; each panel sets `lang`. In edit mode the panel itself is the field (`bare` inputs
where the text was), so nothing moves. Single-line list rows use IT/EN tiny chips instead.

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
| Sheet                                                                                  | slide from the left, 200ms in / 150ms out                                                                                                                                                                                |
| Panel appearing or leaving                                                             | panel and content column slide together as transforms, 220ms in / 180ms out; the leaving panel leaves the flow at once, so width never animates                                                                          |
| Accordion, collapsible, tree                                                           | `grid-template-rows` 0fr→1fr 200ms (`--pn-ease-move`) + content opacity; chevron rotates                                                                                                                                 |
| Drag (Projects)                                                                        | ghost lifts instantly; siblings move 160ms; drop settles 200ms                                                                                                                                                           |
| Optimistic row removal                                                                 | opacity out 120ms, then unmount without height animation                                                                                                                                                                 |
| Copy feedback (invite link)                                                            | icon swap with a short bounce-free spring                                                                                                                                                                                |
| `ScrollTitle`                                                                          | opacity + 4px rise, 150ms in / 100ms out                                                                                                                                                                                 |
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
  Segmented filters show a bare total per option over the whole list. Next to such a filter the toolbar `Count` appears
  only while search or another filter narrows the list further.
- **Dates** (`src/lib/format.ts`): "6 Oct 2026", "6 Oct 2026, 09:00", ranges with " → ". Always `Europe/Rome` and
  `en-GB`, so server and browser render the same text; inputs use the local timezone. No relative times in tables.
- **Unset values:** `Unset` renders `—` (muted, `aria-label="Not set"`) instead of "Not set", "No description" and the
  like. Fallbacks that name a thing stay words: "Unnamed passkey", "Unknown device", "User {id}".

## 8. Page notes

Rules that the templates above don't imply.

- **Overview**: stat tiles link to their section; "Needs attention" rows come from loader counts and drop at zero
  (hidden groups link with `?visibility=hidden`). A service that failed to load shows `—` and one warning alert with
  Retry.
- **Account**: the exemplar Settings page. Passkeys and sessions load together and share one Retry. Sign out needs no
  confirmation (signing in again undoes it).
- **Telegram users**: no create action (users appear once the bot sees them); search strips a leading `@`.
- **Telegram user**: grant actions (End grant, Add grant) are the header bar actions, as grants are the main act on a
  user. Role buttons disable with a tooltip explaining why instead of hiding.
- **Grants**: a row opens the grantee; "Authorized by" links to the grantor.
- **Telegram and WhatsApp groups**: `?q=` prefills the search and `?visibility=` the segment (Reports, Overview and the
  user page link here that way). Telegram groups are bot-managed: no create action, the destructive action is "Leave".
  The visibility toggle is optimistic with one request in flight.
- **Microsoft 365 members**: the member ID edit is optimistic.
- **Projects**: one column at every width, because card order is the order on the website; drag to reorder (handle
  only), a failed reorder reverts. Segments replace `Count`.
- **Associations**: links are edited in their own dialog, not inline.
- **FAQs**: the category picker and its edit/delete buttons form one grouped control in the toolbar `lead`.
- **Labels**: three kinds (categories, attributes, publications), each a `SectionHeading` with a one-line description:
  the only section descriptions in the app, because users confuse the kinds.
- **Categories and tag pages**: a node lists only groups tagged with exactly that path. Publishing a tag acts on every
  row, not the searched subset.
- **Reports**: rows group duplicates (`×n`), but counts and the panel badge count individual reports. Open is
  oldest-first, Closed newest-first.
