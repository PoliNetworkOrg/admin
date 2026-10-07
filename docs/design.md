# PoliNetwork Admin — design system

Scope: every page of the admin dashboard. The shell is the "Rail" design (rail · panel · header bar). This document is the single source of truth for builders; where it conflicts with the code, this document wins and the code is the defect. Every sentence is a rule or a measurement. Nothing here is optional unless marked "only when". §9 maps it to files.

Vocabulary used throughout:

- **Service** — a rail entry: Overview, Telegram, WhatsApp, Microsoft 365, Web, Reports, Account.
- **Section** — a panel entry inside a service (Telegram › Groups).
- **Deep page** — a page reached from a section that is not itself in the panel (user detail, category node, tag page).
- **Header bar** — the 52px bar at the top of the content column. It is rendered by the page through `PageBar`.
- **Toolbar** — the search / filter / count / primary-action group. On section pages it lives _inside_ the header bar.

---

## 0. Principles

1. **Say it once.** A location is named in exactly one place per level: service → panel header, section → active panel item, record → one `h1` in the content. _Therefore:_ no breadcrumb, no eyebrow, no page `h1` on section pages, no dialog eyebrow.
2. **The chrome is for finding; the content is for doing.** Rail, panel and header bar locate and filter; nothing in them explains. _Therefore:_ page descriptions are removed; help lives in empty states, field hints and `(i)` tooltips on section headings only when the inventory had a description that carried real instruction.
3. **One accent, neutral everything else.** Brand blue marks the active location, the single primary action, links and focus. _Therefore:_ icons are one color (`--pn-fg-muted`), the only multicolor marks are the three branded service logos (Telegram, WhatsApp, Microsoft 365; see §2.1), status is expressed with five fixed tones and never with ad-hoc colors.
4. **Borders separate; shadows float.** Static surfaces (cards, tables, panel) use a 1px line; only layers that hover over the page (popover, menu, dialog, toast, drag ghost) cast a shadow. _Therefore:_ no card shadows, no hover-lift, dark mode swaps shadows for a 1px ring.
5. **Motion confirms, never decorates.** Animate only state changes the user caused and only on `transform`/`opacity`, under 200ms, ease-out in, faster ease-in out. _Therefore:_ switching sections, sorting, filtering, paging and keyboard navigation do not animate at all; the theme switch is the one deliberate exception (a light-bulb reveal at the toggle, §6).

---

## 1. Wayfinding and hierarchy

### 1.1 Decision

Today the same word appears four times (sidebar item, breadcrumb, eyebrow, `h1`). The new rule assigns each level of location to one element and gives the freed space to the thing the user is there to do:

- **Service** is stated once as text in the **panel header** (icon + "Telegram"). The rail only highlights it (icon + indicator, name on hover tooltip).
- **Section** is stated once by the **active panel item**. Section pages therefore have **no visible `h1`**; the shell renders one `<h1 class="sr-only">` with the section name (from `sectionFor(match)`) for assistive tech and `document.title` is `"{Section} · {Service} · PoliNetwork Admin"`.
- **The header bar on a section page holds the toolbar**, not a title. Search, filters and the count sit left; the one primary action sits right. Because the header bar is fixed above the scrolling content, the search field never scrolls away.
- **Deep pages** state their record once as an `h1` **in the content** (`RecordHeader`), and the header bar's left slot states the **parent context** they return to: an icon-only back button followed by the parent's identifier (the list name, the parent category path or the tag kind). The panel keeps the parent section highlighted, so the route is always visible: panel = section, header bar = parent path, content = record. No element repeats another.
- **Pages without a panel** (Overview, Account) put their `h1` in the header bar's left slot, because nothing else names them.
- **There is no breadcrumb component anywhere.**

### 1.2 Header bar contents by template

| Template                                                       | Left slot                                                                                                                                                   | Right slot                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Section page (list, cards, tree, browser root, grouped, queue) | Toolbar: search field → filters → `Count`                                                                                                                   | One primary action (plus at most one `outline` secondary)   |
| Deep page (record detail, category node, tag page)             | `BackButton` (icon-only, tooltip "Back to {parent}") → parent context text (`--pn-fg-muted`, 13px; mono when it is an identifier) → `ScrollTitle` (see 1.5) | Record-level actions (max 1 primary + 1 outline + overflow) |
| Overview                                                       | `h1` "Overview" (15/600)                                                                                                                                    | —                                                           |
| Account                                                        | `h1` "Account" (15/600)                                                                                                                                     | —                                                           |
| Any page `< 1024px`                                            | Row 1: panel toggle button → `h1` or parent context; Row 2 (section pages only): the toolbar                                                                | Row 1: primary action                                       |

### 1.3 Shell wireframe at 1440px (Telegram › Groups)

```
┌──────┬────────────────────────┬───────────────────────────────────────────────────────────────────────────────┐
│ [PN] │ ✈ Telegram             │ [🔍 Search by name or tag…        ] [Labels ▾]  1,318 groups       [+ Add group]│  52px
│      ├────────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
│ ▦ Ov │   Users                │                                                                               │
│ 🔍 ⌘K│ ▌ Groups               │  Group                      Telegram ID    Tag        Labels           ⋯      │
│──────│   Grants               │  ───────────────────────────────────────────────────────────────────────────  │
│ ▌✈ Tg│                        │  Analisi Matematica 1       -1001234567    @am1       Didattica › Primo  ⎙ 👁 🏷 🗑│
│  ◯ Wa│                        │  Fisica Tecnica             -1009876543    —          Extra › Lecco     ⎙ 👁 🏷 🗑│
│  ☁ M3│                        │  …                                                                            │
│  ⊕ We│                        │  ───────────────────────────────────────────────────────────────────────────  │
│  ⚑ Re│                        │  Showing 1–20 of 1,318                      Rows 20 ▾   ‹ 1 2 3 … 66 ›        │
│      │                        │                                                                               │
│  ☾   │                        │                                                                               │
│ (LC) │                        │                                                                               │
└──────┴────────────────────────┴───────────────────────────────────────────────────────────────────────────────┘
  56px          224px                                   content, max 1280px, 32px side padding
```

"Telegram" appears once (panel header). "Groups" appears once (panel). The `▌` bar is the active indicator on both rail and panel.

### 1.4 Shell wireframe at 1024px (same page)

```
┌──────┬──────────────────┬────────────────────────────────────────────────────────────────┐
│ [PN] │ ✈ Telegram       │ [🔍 Search by name or tag…  ] [Labels ▾]  1,318 groups [+ Add]  │ 52
│──────├──────────────────┼────────────────────────────────────────────────────────────────┤
│ ▦    │   Users          │  Group                 Telegram ID   Labels              ⋯     │
│ 🔍   │ ▌ Groups         │  …                                                              │
│──────│   Grants         │                                                                 │
│ ▌✈   │                  │                                                                 │
│  ◯   │                  │                                                                 │
│  ☁   │                  │                                                                 │
│  ⊕   │                  │                                                                 │
│  ⚑   │                  │                                                                 │
│  ☾   │                  │                                                                 │
│ (LC) │                  │                                                                 │
└──────┴──────────────────┴────────────────────────────────────────────────────────────────┘
  56          224                       content 744px, 24px side padding
```

At exactly 1024 the panel is still visible. Below 1024 the panel is removed from the flow and becomes a left `Sheet` (see 2.2). The "Tag" column is the first to drop (column priority in 4.1).

### 1.5 Deep-page rule (Telegram user detail)

```
┌──────┬────────────────┬──────────────────────────────────────────────────────────────────────────┐
│ rail │ ✈ Telegram     │ [←] 184220371                        [Add grant] [End grant] [⋯]         │ 52
│      ├────────────────┼──────────────────────────────────────────────────────────────────────────┤
│      │ ▌ Users        │  (GF)  Giulia Ferrari                                                     │
│      │   Groups       │        @giuliaf · 2 roles                                                  │
│      │   Grants       │        [admin] [hr]                               [+ Assign role] [− Remove role]
│      │                │  ─────────────────────────────────────────────────────────────────────── │
```

- Header bar left: back button + parent identifier. For a record the identifier is its stable id (mono, `--pn-fg-muted`). For a category node it is the parent path ("Didattica › Ingegneria"). For a tag page it is the kind ("Attributes" or "Publications").
- Content starts with `RecordHeader`: 40px avatar, `h1` 20/600 name, 13px muted meta line, optional chips row, actions right (only when `canWrite`).
- `ScrollTitle`: when the content `h1` scrolls out of view, the record name fades into the header bar after the parent identifier, separated by a 1px × 16px vertical rule. 150ms opacity + 4px translateY, ease-out. Reduced motion: instant. This is the only moment a name appears twice, and only when the original is off-screen.
- The parent panel item stays active on deep pages (`aria-current="page"` moves to the content `h1` region; the panel item gets `data-ancestor`).

### 1.6 Descriptions and help text

- All page descriptions and eyebrows of the previous dashboard are removed. The ones that carried instruction become hints where the instruction is needed:
  - Group labels: the three section explanations ("A browsable hierarchy…", "Permanent tags…", "Temporary batches…") become one-line `SectionHeading` descriptions (13px muted) because users confuse the three kinds. They are the only section descriptions in the app.
  - Grants: "board-authorized periods…" moves into the Grants empty state text.
  - Azure groups: "Looking for groups with zero or one member?" info alert is removed; the collapsed section's own heading "Groups with 0–1 member (n)" carries it.
  - Overview intro card and bullets are removed.
- Help on individual controls uses field hints (12px under the field) or an `(i)` icon with a tooltip. No paragraphs above tables.

---

## 2. Shell spec

### 2.1 Rail

| Property             | Value                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Width                | 56px, full viewport height, `--pn-nav` background, 1px right border `--pn-line`                                                                                                                                                                                                                                                                                                                                          |
| Padding              | 8px top/bottom, items centered                                                                                                                                                                                                                                                                                                                                                                                           |
| Order (top → bottom) | Logo (static) · Overview · Search (⌘K) · divider (24×1px `--pn-line`, 8px margin) · Telegram · WhatsApp · Microsoft 365 · Web · Reports · _spacer_ · Theme toggle · Account avatar                                                                                                                                                                                                                                       |
| Item geometry        | 40×40 button, radius `--pn-r-3` (8px), 4px vertical gap                                                                                                                                                                                                                                                                                                                                                                  |
| Icon                 | 20px. Telegram, WhatsApp and Microsoft 365 use their branded logos (`src/assets/svg/telegram.svg`, `whatsapp.svg`, `azure.svg`) as `<img>`, everywhere the service is named: rail, panel header, sheet, Overview service cards, command palette (`ServiceGlyph`). Everything else is lucide, stroke 1.75, `--pn-fg-muted`: Overview `LayoutDashboard`, Search `Search`, Web `Globe`, Reports `Flag`, Theme `Sun`/`Moon`. |
| Logo                 | 28px `logo.png` centered in a 40×40 box, bottom margin 8px. Brand mark only: not a link, not focusable, `aria-hidden`, because the Overview item right below already leads home (no two controls for one destination). The navigation sheet header shows the logo + "PoliNetwork Admin" the same way; its Overview row is the link.                                                                                      |
| Hover                | background `--pn-muted`, icon `--pn-fg`, 120ms color/background                                                                                                                                                                                                                                                                                                                                                          |
| Active               | background `--pn-accent-soft`, icon `--pn-accent`; indicator: 2px × 20px bar, radius 1px, `--pn-accent`, positioned at the rail's left edge (x = 0), vertically centered on the item. The indicator does not animate between items.                                                                                                                                                                                      |
| Focus                | `outline: 2px solid --pn-focus; outline-offset: 2px` (focus-visible only)                                                                                                                                                                                                                                                                                                                                                |
| Pressed              | none (high-frequency control)                                                                                                                                                                                                                                                                                                                                                                                            |
| Tooltip              | right side, 8px offset, label = service name (plus "⌘K" kbd for Search). First tooltip opens after 400ms (`TOOLTIP_DELAY_SLOW` on the trigger: the pointer sweeps the rail on its way elsewhere); moving to a sibling within 300ms opens instantly (provider group timeout 300).                                                                                                                                         |
| Keyboard             | The rail is one tab stop (roving tabindex on the active item). `↑/↓` move focus, `Home/End` jump, `Enter`/`Space` activate. `Tab` leaves to the panel (or header bar when no panel).                                                                                                                                                                                                                                     |
| Click behaviour      | Service → navigates to the service's first section (or the last visited section of that service, remembered in session storage). On `< 1024px` a service with more than one section opens the panel sheet instead of navigating; one-section services navigate directly.                                                                                                                                                 |
| Account              | 28px `Avatar` with initials on `--pn-accent-solid`, inside the same 40×40 button; same active/hover treatment; tooltip shows the user's name. Clicking navigates to `/dashboard/account`. Sign out is on the Account page, not in a menu.                                                                                                                                                                                |
| Theme                | Same geometry; no active state; icon swaps instantly; `aria-label` "Switch to dark mode"/"Switch to light mode". Theme switch: a light-bulb reveal at the toggle icon, light flooding out of it or retreating into it (§6); element transitions stay off while it runs (`:root[data-theme-switching] * { transition: none !important }`).                                                                                |

### 2.2 Panel

| Property    | Value                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Presence    | Rendered only for services with two or more sections (Telegram, Microsoft 365, Web, Reports): a single item would repeat the rail. Not rendered for WhatsApp (one section), Overview and Account; the content column takes the width (`servicePanelVisible`). At ≥ 1024px the header bar shows no "{Service} › {Section}" title for them either: the rail already names the service. Showing/hiding the panel slides it (§6).                       |
| Width       | 224px, `--pn-nav` background, 1px right border; like the rail and the navigation sheet it is `select-none` (clicking or dragging through it never highlights text)                                                                                                                                                                                                                                                                                  |
| Header      | 52px tall with a 1px bottom border `--pn-line` (the header bar has none), 16px side padding, 16px service glyph in `--pn-fg-muted` + service name 14/600 `--pn-fg`. No count.                                                                                                                                                                                                                                                                       |
| List        | `nav` with `aria-label="{Service} sections"`, 8px padding, 2px gap                                                                                                                                                                                                                                                                                                                                                                                  |
| Item        | 32px tall, 10px side padding, radius `--pn-r-2` (6px), 13px/500 (weight never changes), 16px icon `--pn-fg-muted`, 8px gap.                                                                                                                                                                                                                                                                                                                         |
| Item hover  | background `--pn-muted`, 120ms                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Item active | background `--pn-nav-active`, text `--pn-fg`, icon `--pn-accent`, indicator 2px × 16px `--pn-accent` at the item's left inner edge (x = 0 of the item), `aria-current="page"`. On deep pages the parent item uses the same visual with `data-ancestor` and no `aria-current`.                                                                                                                                                                       |
| Counts      | Only Reports › Open shows a count: pending reports, 12px tabular `--pn-fg-muted`, right-aligned. Zero hides it. No other badges in the panel.                                                                                                                                                                                                                                                                                                       |
| Keyboard    | Natural tab order through items; `↑/↓` also move within the list.                                                                                                                                                                                                                                                                                                                                                                                   |
| `< 1024px`  | Panel is not in the layout. The header bar gains a 36px icon button (`PanelLeft`) at the far left that opens a `Sheet` from the left, 280px wide, containing: the rail services as a list (56px rows with glyph + name) with the active service expanded to show its sections underneath (same item spec). Choosing a section navigates and closes the sheet. Sheet motion: 200ms translateX ease-out in, 150ms ease-in out, backdrop `--pn-scrim`. |
| `< 640px`   | Rail is also hidden; the sheet is the only navigation and includes Overview, Search, Theme and Account rows at the bottom.                                                                                                                                                                                                                                                                                                                          |

### 2.3 Header bar (`PageBar`)

| Property     | Value                                                                                                                                                                                                                                                                                                                                                                 |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Height       | 52px (`≥1024`); two rows of 52 + 44 on section pages below 1024                                                                                                                                                                                                                                                                                                       |
| Background   | `--pn-bg`; no bottom border: the bar reads as the top of the content, not as chrome aligned with the panel header                                                                                                                                                                                                                                                     |
| Padding      | 0 24px (`≥1024`: 0 32px when the content container is 1280 wide); 16px top at `≥1024`. Content below starts 12px after the bar (20px on settings pages), so toolbar → content is about 20px                                                                                                                                                                           |
| Position     | Outside the scroll container: the `main` element scrolls; the header bar never moves                                                                                                                                                                                                                                                                                  |
| Layout       | `grid-template-columns: minmax(0,1fr) auto; gap 16px; align-items center`                                                                                                                                                                                                                                                                                             |
| Left slot    | See 1.2. Items are spaced 8px; the `Count` is separated from filters by 16px.                                                                                                                                                                                                                                                                                         |
| Right slot   | Buttons spaced 8px; primary is the right-most element.                                                                                                                                                                                                                                                                                                                |
| Search field | 36px tall, 280px wide at `≥1280` (up to 360px when the placeholder needs it: Labels, Members), 240px at `≥1024`, full row width below. Leading `Search` icon 16px; trailing clear button appears only with a value. Placeholder text per page from §7. `/` focuses it from anywhere on the page. Filtering is deferred (`useDeferredValue`) and resets the page to 1. |
| Filters      | `outline` buttons 36px with a trailing `ChevronDown`; when active they show a count chip ("Labels · 2") and the border becomes `--pn-accent` at 40% mix. Segmented filters use `ToggleGroup` (36px), every segment as wide as the widest label from 1024px; narrower, segments keep their natural width so long sets can wrap.                                        |

### 2.4 Content container

| Template                                             | Max width | Side padding         | Top padding |
| ---------------------------------------------------- | --------- | -------------------- | ----------- |
| List/table, Card-collection, Browser, Queue, Grouped | 1280px    | 24px (`≥1440`: 32px) | 24px        |
| Tree                                                 | 960px     | same                 | 24px        |
| Record detail                                        | 1040px    | same                 | 24px        |
| Settings (Account)                                   | 720px     | same                 | 32px        |
| Overview                                             | 1040px    | same                 | 24px        |

Content is centered. Bottom padding 48px. The scroll container is `main` (`overflow-y: auto; overscroll-behavior: contain`); the document itself never scrolls.

### 2.5 Command palette (⌘K)

It exists. One dialog, `cmdk` inside `Dialog`, 560px wide, top-aligned at 15vh, no entrance animation (power-user tool), backdrop `--pn-scrim`.

| Group    | Items                                                                                                                                                                                                                                                             | Action                                                          |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Sections | every section as "{Service} › {Section}", with the service glyph                                                                                                                                                                                                  | navigate                                                        |
| Records  | Telegram users (name, @username, id), Telegram groups (title, tag), WhatsApp groups (title), labels (humanized path), Microsoft 365 groups (displayName). Max 5 per type, matched by `includes` on normalized text. Shown only when the query has ≥ 2 characters. | navigate to the detail page or to the list pre-filtered (`?q=`) |
| Actions  | "Switch to dark/light theme", "Open account", "Sign out"                                                                                                                                                                                                          | run                                                             |

The Records group is not built yet: it needs a client-side search source over users, groups, labels and Microsoft 365 groups. Until then the palette lists Sections and Actions only.

Keyboard: `⌘K`/`Ctrl+K` toggles; `↑/↓` move; `Enter` runs; `Esc` closes; typing filters. Dismissing (`Esc`, outside press) returns focus to where it was, without opening that element's tooltip (`suppressNextFocusTooltip`); running an entry does not (the user has moved to a new page or theme, and focusing the trigger would light up the rail Search button and its tooltip). Row 40px, 14px text, meta 12px muted on the right, selected row `--pn-muted` background. Empty: "Nothing matches “{q}”." in 13px muted, 32px padding.

---

## 3. Tokens

All variables are defined in `src/styles.css` on `:root` (light) and `.dark` (dark). Builders use **only** these variables and the Tailwind utilities that resolve to them. Raw hex in components is a defect.

### 3.1 Brand scale (hue 257.4, derived from #1156ae at step 600)

| Step | OKLCH                      | Hex       | Use                                              |
| ---- | -------------------------- | --------- | ------------------------------------------------ |
| 50   | `oklch(0.975 0.011 257.4)` | `#f2f7fe` | light soft fill (`--pn-accent-soft`)             |
| 100  | `oklch(0.945 0.026 257.4)` | `#e2eeff` | light soft hover                                 |
| 200  | `oklch(0.890 0.054 257.4)` | `#c5ddff` | selection background                             |
| 300  | `oklch(0.800 0.100 257.4)` | `#95c0fe` | dark accent text/icons, dark focus               |
| 400  | `oklch(0.690 0.140 257.4)` | `#619cf1` | dark solid button                                |
| 500  | `oklch(0.580 0.160 257.4)` | `#3578d7` | light focus ring                                 |
| 600  | `oklch(0.466 0.155 257.4)` | `#1156ae` | **brand**; light accent text, light solid button |
| 700  | `oklch(0.400 0.135 257.4)` | `#0a448e` | light solid hover, light info text               |
| 800  | `oklch(0.340 0.110 257.4)` | `#0a366f` | —                                                |
| 900  | `oklch(0.285 0.085 257.4)` | `#0a2953` | dark soft fill                                   |
| 950  | `oklch(0.220 0.060 257.4)` | `#071a36` | dark soft hover                                  |

Contrast (WCAG): 600 on white 7.08; 700 on 50 8.75; white on 600 7.08; 300 on dark card 9.58; n950 text on 400 6.96. All pairs used below pass AA for normal text.

### 3.2 Neutrals (cool, hue 250 — blue UIs want cool greys)

| Step | OKLCH                    | Hex       |
| ---- | ------------------------ | --------- |
| 0    | `oklch(1 0 0)`           | `#ffffff` |
| 50   | `oklch(0.985 0.003 250)` | `#f9fafc` |
| 100  | `oklch(0.967 0.005 250)` | `#f2f4f7` |
| 200  | `oklch(0.930 0.008 250)` | `#e4e8ed` |
| 300  | `oklch(0.870 0.011 250)` | `#cfd5db` |
| 400  | `oklch(0.720 0.016 250)` | `#9da6ae` |
| 500  | `oklch(0.580 0.020 250)` | `#727c86` |
| 600  | `oklch(0.490 0.020 250)` | `#58626c` |
| 700  | `oklch(0.400 0.020 250)` | `#404952` |
| 800  | `oklch(0.300 0.022 250)` | `#262f39` |
| 900  | `oklch(0.220 0.024 250)` | `#121b25` |
| 950  | `oklch(0.160 0.022 250)` | `#060e16` |

### 3.3 Semantic variables

| Variable                  | Light                          | Dark                               | Notes                                                                                  |
| ------------------------- | ------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------- |
| `--pn-bg`                 | n0 `#ffffff`                   | `oklch(0.165 0.016 250)` `#090f15` | content canvas                                                                         |
| `--pn-surface`            | n0 `#ffffff`                   | `oklch(0.205 0.018 250)` `#11181f` | cards, table surface                                                                   |
| `--pn-surface-raised`     | n0 `#ffffff`                   | `oklch(0.240 0.018 250)` `#192028` | popover, menu, dialog, toast                                                           |
| `--pn-nav`                | n50 `#f9fafc`                  | `oklch(0.145 0.016 250)` `#060b11` | rail + panel                                                                           |
| `--pn-nav-active`         | n200 `#e4e8ed`                 | `oklch(1 0 0 / 0.08)`              | active panel item                                                                      |
| `--pn-muted`              | n100 `#f2f4f7`                 | `oklch(0.250 0.018 250)` `#1b222a` | hover fills, skeleton, neutral chip bg                                                 |
| `--pn-line`               | `oklch(0.22 0.024 250 / 0.10)` | `#262f38` (solid)                  | all static borders; alpha in light so it composites, solid in dark so it does not glow |
| `--pn-line-strong`        | `oklch(0.22 0.024 250 / 0.18)` | `#353e47`                          | input borders, dividers that must read on `--pn-muted`                                 |
| `--pn-fg`                 | n900 `#121b25`                 | n100 `#f2f4f7`                     | body text (17.4 / 16.2)                                                                |
| `--pn-fg-muted`           | n600 `#58626c`                 | n400 `#9da6ae`                     | secondary text, icons (6.2 / 7.2 on surface)                                           |
| `--pn-fg-subtle`          | n500 `#727c86`                 | n500 `#727c86`                     | placeholders and disabled text only (4.25 — never for information)                     |
| `--pn-accent`             | brand-600                      | brand-300                          | text, icons, active marks, links                                                       |
| `--pn-accent-hover`       | brand-700                      | brand-200                          | link hover                                                                             |
| `--pn-accent-solid`       | brand-600                      | brand-400                          | primary button background                                                              |
| `--pn-accent-solid-hover` | brand-700                      | brand-300                          |                                                                                        |
| `--pn-accent-solid-fg`    | `#ffffff`                      | n950 `#060e16`                     | primary button text                                                                    |
| `--pn-accent-soft`        | brand-50                       | brand-900                          | active rail item, selected list rows, soft brand badge                                 |
| `--pn-accent-soft-hover`  | brand-100                      | brand-950                          |                                                                                        |
| `--pn-selection`          | brand-200                      | brand-800                          | `::selection`                                                                          |
| `--pn-focus`              | brand-500 `#3578d7`            | brand-300 `#95c0fe`                | focus outline                                                                          |
| `--pn-success-fg`         | `#00642b`                      | `#83d494`                          | text/icon                                                                              |
| `--pn-success-bg`         | `#e8f9eb`                      | `#122d19`                          | soft badge bg (6.7 / 8.35 with fg)                                                     |
| `--pn-success-solid`      | `#007835`                      | `#83d494`                          | dots, solid fills (white text 5.6)                                                     |
| `--pn-warning-fg`         | `#774500`                      | `#f3ad66`                          |                                                                                        |
| `--pn-warning-bg`         | `#fff1e4`                      | `#372108`                          | 7.2 / 7.9                                                                              |
| `--pn-warning-solid`      | `#8e5300`                      | `#f3ad66`                          |                                                                                        |
| `--pn-danger-fg`          | `#8c2d28`                      | `#ffa196`                          |                                                                                        |
| `--pn-danger-bg`          | `#ffefed`                      | `#3b1c19`                          | 7.5 / 7.9                                                                              |
| `--pn-danger-solid`       | `#a43b35`                      | `#c9524a`                          | destructive confirm button bg (white text 6.45 / 4.6)                                  |
| `--pn-info-fg`            | brand-700                      | brand-300                          |                                                                                        |
| `--pn-info-bg`            | brand-50                       | brand-900                          |                                                                                        |
| `--pn-scrim`              | `oklch(0.16 0.02 250 / 0.40)`  | `oklch(0 0 0 / 0.60)`              | dialog/sheet backdrop, no blur                                                         |

Hue values used: success 150, warning 65, danger 27, info = brand. Tints are built by lowering chroma, not by opacity, so they do not go grey.

### 3.4 Surface layering

| Layer                                 | Light                 | Dark                                 | Edge                                                                                             |
| ------------------------------------- | --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Nav (rail, panel)                     | `--pn-nav`            | `--pn-nav`                           | 1px `--pn-line` right                                                                            |
| Canvas                                | `--pn-bg`             | `--pn-bg`                            | —                                                                                                |
| Card / table surface                  | `--pn-surface`        | `--pn-surface` (lighter than canvas) | 1px `--pn-line`, no shadow                                                                       |
| Raised (popover, menu, combobox list) | `--pn-surface-raised` | `--pn-surface-raised`                | light: `--pn-shadow-float`; dark: `0 0 0 1px --pn-line-strong` + `0 8px 24px oklch(0 0 0 / 0.5)` |
| Modal (dialog, sheet)                 | `--pn-surface-raised` | `--pn-surface-raised`                | light: `--pn-shadow-modal`; dark: ring 1px `--pn-line-strong` + `0 24px 48px oklch(0 0 0 / 0.6)` |
| Toast                                 | `--pn-surface-raised` | `--pn-surface-raised`                | same as raised                                                                                   |

```css
--pn-shadow-float:
  0 0 0 1px oklch(0.22 0.024 250 / 0.06), 0 2px 4px oklch(0.22 0.024 250 / 0.04),
  0 8px 24px oklch(0.22 0.024 250 / 0.08);
--pn-shadow-modal:
  0 0 0 1px oklch(0.22 0.024 250 / 0.06), 0 4px 8px oklch(0.22 0.024 250 / 0.04),
  0 24px 48px oklch(0.22 0.024 250 / 0.12);
```

Images and avatars get `box-shadow: inset 0 0 0 1px oklch(0 0 0 / 0.10)` (light) / `oklch(1 0 0 / 0.10)` (dark).

### 3.5 Radii

| Variable      | Value | Use                                                                                 |
| ------------- | ----- | ----------------------------------------------------------------------------------- |
| `--pn-r-1`    | 4px   | chips inside inputs, kbd, color swatches                                            |
| `--pn-r-2`    | 6px   | panel items, menu items, table-internal buttons, inner cards (outer 10 − padding 4) |
| `--pn-r-3`    | 8px   | buttons, inputs, rail items, badges-as-tiles                                        |
| `--pn-r-4`    | 10px  | cards, table surface, popovers                                                      |
| `--pn-r-5`    | 12px  | dialogs, sheets, toasts                                                             |
| `--pn-r-full` | 999px | status badges, chips, avatars                                                       |

Nested rule: inner radius = outer radius − padding (a 10px card with 16px padding holds 0px-radius children; a 10px card with 4px padding holds 6px children).

### 3.6 Spacing rhythm

4px base. Allowed steps: 4, 8, 12, 16, 20, 24, 32, 48. Use `gap`, never per-child margins. Vertical rhythm inside content: sections 32px apart; heading to body 12px; card padding 16px (20px for Settings cards); table cell padding 12px vertical × 16px horizontal.

### 3.7 Type

Family: DM Sans (opsz axis on, `font-optical-sizing: auto`), DM Mono for identifiers. Weights loaded: 400, 500, 600 (Sans), 400, 500 (Mono). `-webkit-font-smoothing: antialiased`. Body `font-feature-settings: "ss01"` off; `font-variant-numeric: tabular-nums` on every numeric cell, count, badge number, date, time, and stat.

| Variable         | Size/line | Weight | Tracking | Use                                                                |
| ---------------- | --------- | ------ | -------- | ------------------------------------------------------------------ |
| `--pn-text-xs`   | 12/16     | 400    | 0        | captions, field hints, table header, meta lines                    |
| `--pn-text-sm`   | 13/20     | 400    | 0        | table cells, panel items, list rows, dialog descriptions           |
| `--pn-text-base` | 14/20     | 400    | 0        | body, inputs (desktop), buttons                                    |
| `--pn-text-md`   | 15/22     | 600    | −0.005em | header bar `h1`, dialog title, section card title                  |
| `--pn-text-lg`   | 18/24     | 600    | −0.01em  | record `h1` on cards, empty-state title                            |
| `--pn-text-xl`   | 20/28     | 600    | −0.015em | `RecordHeader` `h1`                                                |
| `--pn-text-2xl`  | 28/32     | 600    | −0.02em  | Overview stat numbers (tabular)                                    |
| `--pn-text-mono` | 13/20     | 400    | 0        | Telegram IDs, chat ids, label paths, versions, codes, IP addresses |

Rules: uppercase text is not used anywhere (no eyebrows, no uppercase table headers). Mono is used only for identifiers listed above; never for labels or keys. Italic is not used; "unset" values are rendered as `—` in `--pn-fg-muted` (see §8). Headings use `text-wrap: balance`; body `text-wrap: pretty`. Truncation uses `text-overflow: ellipsis` plus a `title` attribute. Real `…` and `’` characters in copy.

Touch: `@media (pointer: coarse)` inputs and textareas are 16px.

### 3.8 Focus ring

```css
:focus-visible {
  outline: 2px solid var(--pn-focus);
  outline-offset: 2px;
}
:is(input, textarea, [data-slot="combobox-input"]):focus-visible {
  outline: none;
  border-color: var(--pn-focus);
  box-shadow: 0 0 0 3px color-mix(in oklch, var(--pn-focus) 25%, transparent);
}
tr:focus-visible {
  outline-offset: -2px;
}
```

### 3.9 Mapping shadcn variables

So that every `@/components/ui/*` component re-themes without edits:

```css
:root {
  --background: var(--pn-bg);
  --foreground: var(--pn-fg);
  --card: var(--pn-surface);
  --card-foreground: var(--pn-fg);
  --popover: var(--pn-surface-raised);
  --popover-foreground: var(--pn-fg);
  --primary: var(--pn-accent-solid);
  --primary-foreground: var(--pn-accent-solid-fg);
  --secondary: var(--pn-muted);
  --secondary-foreground: var(--pn-fg);
  --muted: var(--pn-muted);
  --muted-foreground: var(--pn-fg-muted);
  --accent: var(--pn-accent-soft);
  --accent-foreground: var(--pn-accent);
  --destructive: var(--pn-danger-solid);
  --border: var(--pn-line);
  --input: var(--pn-line-strong);
  --ring: var(--pn-focus);
  --radius: 8px;
  color-scheme: light;
}
.dark {
  color-scheme: dark; /* dark values of every --pn-* */
}
```

`styles.css` declares the theme with `@theme inline`, so Tailwind utilities reference `var(--primary)` etc. at runtime and resolve to the `--pn-*` palette. Login and onboarding pages use the same tokens.

---

## 4. Page templates

Slot names in brackets are props of the shared primitives in §9.

### 4.1 List/table page

Used by: Telegram users, Telegram groups, Grants, WhatsApp groups, Microsoft 365 members, Freshman guide, tag page table, category node table, Reports (queue variant 4.8).

```
PageBar  [left: Search][Filter…][Count]                     [right: Primary]
──────────────────────────────────────────────────────────────────────────────
DataTable surface (border, r-4)
  thead 36px   Col A         Col B ↓      Col C      numeric   actions
  tr 44px      …
  tfoot        Showing 1–20 of 1,318          Rows per page [20▾]  ‹ 1 2 3 … 66 ›
```

- Toolbar: search (when the inventory page has search, plus the additions in §7), then segmented or popover filters, then `Count`. Primary action right. `canWrite=false` hides the primary action and the actions column.
- Density: one row height, 44px. No dense mode.
- Column priority: each column declares `priority: 1..n`; when the table surface is narrower than the sum of column min-widths, the lowest-priority columns hide (CSS container query on the surface; thresholds per page in §7). The first column and the actions column never hide.
- Pagination: rendered in the table footer only when `total > pageSize`. Default page size per page as in the inventory (25 users/members, 20 everything else). Page-size options 20 / 50 / 100 (the 10 and 25 options are dropped; users and members default to 25 → changed to 20 for one rule). Changing search, filter or sort resets to page 1. `< 640px`: "‹ 3 / 66 ›" only.
- Loading: `TableSkeleton` with the real column count and 8 rows of 44px; thead is real.
- Empty: `EmptyState` rendered inside the surface spanning all columns (no dashed border). Two variants per page: filtered ("No {things} match" + "Clear search" ghost action) and true-empty ("No {things} yet" + create action when one exists).
- Error: `InlineAlert tone=danger` in place of the table body with "Retry" `outline` button; the header bar stays.

### 4.2 Card-collection page

Used by: Projects, Associations.

```
PageBar  [left: Search / Segments][Count]                     [right: + Add …]
──────────────────────────────────────────────────────────────────────────────
grid  gap 16   (2 columns ≥ 1024, 1 below; Projects: always 1)
  ┌ InlineEditCard ───────────────────────────────────────────────────────┐
  │ [logo 40] Title                                   [✎] [🗑] [⋮]         │
  │ link (muted, 13)                                                      │
  │ IT  …description, 4-line clamp…                                       │
  │ EN  …                                                                 │
  └───────────────────────────────────────────────────────────────────────┘
```

- Cards: `--pn-surface`, 1px `--pn-line`, `--pn-r-4`, 16px padding, 12px internal gap. No hover elevation; hover shows nothing except on the action buttons. Cards in one grid row share its height; a card footer (Associations: links count + `Manage links`) sits at the bottom (`mt-auto`), so footers line up.
- Edit mode replaces text with fields of identical line boxes (see §5.9) and turns the border into a dashed `--pn-accent` one (background unchanged); card width and position do not change.
- Drafts (new, unsaved) get a dashed `--pn-accent` border like any card in edit mode (background unchanged) and a `StatusBadge tone=warning` "Draft" after the title and are inserted at the top of the grid.
- Drag (Projects): handle icon `GripVertical` 16px at the card's left edge, visible always in `--pn-fg-subtle`, `--pn-fg` when the handle itself is hovered or focused (not on card hover: only the handle drags). The dragged card becomes a ghost (`opacity .9`, `--pn-shadow-float`, `scale 1.01`); siblings translate with 160ms ease-in-out; on drop the ghost settles with 200ms ease-out. Reduced motion: siblings swap instantly.
- Loading: 4 card skeletons with the card geometry. Empty: `EmptyState` centered in the content.

### 4.3 Tree page

Used by: Labels (today "Group labels").

```
PageBar  [left: Search][Count]                       [right: Add tag ▾][+ Add category]
──────────────────────────────────────────────────────────────────────────────
SectionHeading  Categories                  (i) description 13px
  ▸ Didattica                                                                  [⋮]
  ▾ Extra
      ▸ ● Lecco           Groups at the Lecco campus                      [✎][🗑][⋮]
          ● Primo Anno    —                                               [✎][🗑][⋮]
SectionHeading  Attributes
  ● Italian        Language of the group                                  [✎][🗑][⋮]
SectionHeading  Publications                                 [Create publication]
  ● release-2026-27   Batch for the 2026/27 freshmen                      [✎][🗑]
```

- Row actions read `✎ 🗑 ⋮` (edit, delete, menu) everywhere, as on Projects cards (§4.2): More actions always occupies the far-right position.
- Below 640px, label rows remain 44px high with one trailing `⋮` menu. Edit and Delete move into that menu; category indentation is 8px per level, capped at 32px. Desktop action placement and indentation stay unchanged.
- Rows 44px, flat list surfaces per section (one bordered surface, rows separated by 1px `--pn-line`). Depth is indentation of 24px per level; no vertical guide lines.
- Chevron 16px `ChevronRight`, rotates 90° in 150ms ease-out when expanded (the one rotating icon in the app); `Expand {name}`/`Collapse {name}` aria-labels. Expanded state persists in session storage; search force-expands.
- Pure grouping nodes show the segment name in `--pn-fg` and `—` in the description cell; real labels show a colored dot (8px) before the name.
- The `Add tag ▾` button is a dropdown with "Add attribute" and "Create publication" (the two dialogs). The Publications `SectionHeading` keeps its inline "Create publication" `outline` button as the inventory specifies.

### 4.4 Browser page

Used by: Categories root and nodes, tag page.

```
Root:
PageBar  [left: Count "2 roots · 18 categories"]                 [right: + Add category]
  grid of NavCards (2 col ≥ 768): [▸ Didattica   12 categories]  [▸ Extra   6 categories]

Node:
PageBar  [← ] Didattica › Ingegneria                 [+ Add category] [+ Add group]
  RecordHeader  h1 "Informatica"       (dot in label color)      38 groups
  SectionHeading  Sub-categories
    NavCards: [▸ Primo Anno  9] [▸ Secondo Anno  11] …
  SectionHeading  Groups          [Search by group name or tag…]
    DataTable (CombinedGroupsTable)
```

- `NavCard`: 56px tall, name 14/500, count 12 muted right, chevron 16 right, hover `--pn-muted`, focus ring; the whole card is one `<a>` with the name as accessible text.
- On the node page the search field lives in the Groups `SectionHeading` right slot (the header bar left is occupied by the parent path). This is the one template where search is not in the header bar.
- Tag page is the node layout without the Sub-categories block; header bar left = `[←] Attributes` or `[←] Publications`; right = `[Publish 12 groups]` (publications only, when rows exist) + `[+ Add group]`.

### 4.5 Record detail page

Used by: Telegram user detail. Full spec in §7.4.

```
PageBar  [←] 184220371 ·(scroll title)                 [Add grant][End grant]
  RecordHeader   avatar 40 · h1 20/600 · meta 13 muted · chips · actions
  ─ divider 1px
  SectionCard  Grants                               (status chip)   [Add grant]
  SectionCard  Group administration  3                              [Add group]
  SectionCard  Recent messages  15
  SectionCard  Audit log  4
```

- Single column, 1040 max. Sections are `SectionCard`s stacked 24px apart. No 3-up summary cards.
- Loading: `RecordSkeleton` (header block + 3 section blocks). Error: `RouteError` content.

### 4.6 Settings page

Used by: Account. Full spec in §7.2.

- Single column, 720 max, `SectionCard`s stacked 24px apart, each with title 15/600, description 13 muted, and a right-aligned action slot in the card header row. Card body 20px padding. Lists inside cards use 56px rows separated by 1px lines.
- Destructive section last, separated by 48px (not 24px), no red border.

### 4.7 Grouped-collapsible page

Used by: Microsoft 365 groups.

```
PageBar  [left: Search by group or email…][Count "42 groups · 318 memberships"]
  Collapsible surface   ▾ Groups with 2+ members  (36)
     row 56px  Board            board@polinetwork.org   9 members  (avatars ×7 +2)   [+👤][−👤]
     …
  Collapsible surface   ▸ Groups with 0–1 member  (6)
```

- Collapsible header 48px, chevron + title 14/500 + `Count` muted. Second group collapsed by default; state persists in session storage. Search expands both.
- Row: name 13/500, mail 12 muted mono-free, `Count` "9 members" 12 muted tabular, `AvatarGroup` (24px, max 7, "+N" chip), actions (icon buttons `UserPlus`/`UserMinus`, `canWrite`).
- Content animates with `grid-template-rows 0fr→1fr` 200ms ease-in-out plus opacity 150ms; reduced motion instant.

### 4.8 Queue page

Used by: Reports › Open, Reports › Closed.

- List template with: segmented filter `All | Telegram | WhatsApp | Missing group` (Open) and `All | Resolved | Dismissed` (Closed), search by reference/details, `Count`.
- Row 44px; grouped duplicates show a neutral `CountBadge` "×3" after the reference. Row click navigates (see §7.17). Actions (Open only): `Dismiss` (icon `X`) and `Resolve` (icon `Check`); both are instant with optimistic removal of the row (opacity 0 in 120ms, then row collapses without animation) and a toast; failure restores the row and shows an error toast.

---

## 5. Component rules

### 5.1 Tables (`DataTable`)

| Property       | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Surface        | `--pn-surface`, 1px `--pn-line`, `--pn-r-4`, overflow hidden; horizontal scroll inside when needed                                                                                                                                                                                                                                                                                                                                                                            |
| Header row     | 36px, 12/500 `--pn-fg-muted`, sentence case, transparent background, 1px bottom `--pn-line`; sticky to the surface top when the surface scrolls horizontally only                                                                                                                                                                                                                                                                                                             |
| Sort indicator | sortable headers are buttons (36px hit area, full cell); unsorted shows no icon; hover shows `ChevronsUpDown` 12px `--pn-fg-subtle`; sorted shows `ChevronUp`/`ChevronDown` 12px `--pn-fg`; `aria-sort` set                                                                                                                                                                                                                                                                   |
| Rows           | 44px; 1px `--pn-line` between rows; last row no border                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Cells          | 13/400; first column 13/500 `--pn-fg`; padding 12 × 16, first cell 20 left, last cell 20 right; `vertical-align: middle`                                                                                                                                                                                                                                                                                                                                                      |
| Numeric / id   | right-aligned when numeric quantities (counts, member id); mono left-aligned when identifiers (Telegram IDs)                                                                                                                                                                                                                                                                                                                                                                  |
| Hover          | `--pn-muted` background 120ms, only when the row is interactive or has actions                                                                                                                                                                                                                                                                                                                                                                                                |
| Clickable row  | `cursor: pointer`, `tabindex=0`, `Enter`/`Space` open, `aria-label="Open {name}"`; the first cell text is also a real `<a>` for middle-click                                                                                                                                                                                                                                                                                                                                  |
| Selected       | `--pn-accent-soft` background (used only in pick lists)                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Actions column | right-aligned, 36px icon buttons `ghost`, always visible in `--pn-fg-muted`, hover `--pn-fg` on `--pn-muted`; the destructive action follows the primary actions, separated by 8px extra, hover `--pn-danger-fg` on `--pn-danger-bg`; max 4 icons, further actions go into a `⋯` menu at the far right                                                                                                                                                                        |
| Truncation     | the title column takes the width the other columns leave (`fill`), `truncate`, `title` attr; no fixed `max-w-*` caps; link cells show the host only                                                                                                                                                                                                                                                                                                                           |
| Column widths  | stable across search, filters and paging: list tables give every non-title column a fixed `width` (`table-layout: fixed`), the title column takes the rest, and chips/ids truncate inside their column (full text in `title`/tooltip). Group lists: Labels 320, Telegram ID 150, Tag 176. The scroll container and the header bar reserve the same scrollbar gutter, so a short result list does not widen the table and the toolbar keeps the content's left and right edges |
| Secondary line | allowed only in the first column (13 → 12 muted), row remains 44px via 20+16 line boxes                                                                                                                                                                                                                                                                                                                                                                                       |

### 5.2 Status badges (`StatusBadge`) and chips (`Chip`)

`StatusBadge`: 22px tall, `--pn-r-full`, 8px padding, 12/500, 6px dot + label, soft background + tone foreground. Used **only** for states. `Chip`: same geometry without dot, `--pn-line` border, transparent background, `--pn-fg`; used for categorical values (licenses, roles, language). Label colors use `LabelChip` (dot in label color, outline) for categories and solid-tinted pills for tags, as today.

| Value (where)                                              | Element                                                                                                        | Tone                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Active (grant ongoing)                                     | StatusBadge                                                                                                    | success                   |
| Scheduled (grant)                                          | StatusBadge                                                                                                    | brand                     |
| Expired / Interrupted (grant, if shown)                    | StatusBadge                                                                                                    | neutral                   |
| Pending (report)                                           | StatusBadge                                                                                                    | warning                   |
| Resolved (report)                                          | StatusBadge                                                                                                    | success                   |
| Dismissed (report)                                         | StatusBadge                                                                                                    | neutral                   |
| Current (session)                                          | StatusBadge                                                                                                    | brand                     |
| Latest (guide edition)                                     | StatusBadge                                                                                                    | brand                     |
| Draft / Unsaved (card)                                     | StatusBadge                                                                                                    | warning                   |
| Hidden (group)                                             | not a badge: the visibility toggle shows `EyeOff` in `--pn-warning-fg`; visible shows `Eye` in `--pn-fg-muted` | —                         |
| Public / Visible                                           | absence; no badge                                                                                              | —                         |
| Published                                                  | absence (publications disappear when published)                                                                | —                         |
| Broken link / Missing group (report issue)                 | plain text in the Issue cell with the platform glyph                                                           | —                         |
| Telegram / WhatsApp (platform)                             | 14px glyph with `aria-label`, no text badge                                                                    | —                         |
| @tag (group tag)                                           | mono text                                                                                                      | —                         |
| Roles                                                      | Chip                                                                                                           | —                         |
| Licenses                                                   | Chip (underscores → spaces)                                                                                    | —                         |
| IT / EN language markers                                   | 18px `Chip` variant `tiny` 11/500, uppercase is **not** used: text is "IT"/"EN" as proper nouns                | —                         |
| Member counts, group counts, FAQ counts, report duplicates | `Count` text or `CountBadge` (neutral)                                                                         | neutral                   |
| Report group count >1                                      | `CountBadge` "×{n}"                                                                                            | neutral (was destructive) |

### 5.3 Buttons

| Rule               | Value                                                                                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sizes              | one text size: `size="sm"` (36px, 13px text); icon buttons `size="icon-sm"` (36px). `default` (40) is used only inside dialog footers. `xs` is not used.                                                         |
| Hierarchy per view | exactly one `default` (primary) button visible per page region (header bar or dialog footer); secondaries are `outline`; tertiary are `ghost`; links use `link`.                                                 |
| Destructive        | in content: `outline` with `--pn-danger-fg` text and 40% danger border ("Sign out of this device", "End grant"); in confirm dialogs: solid `--pn-danger-solid` with white text. Never red solid in page content. |
| Icon buttons       | always `aria-label`; tooltip after 100ms with the same text; 36px hit area even when the glyph is 16px                                                                                                           |
| Pressed            | `translateY(1px)` (existing `active:` rule) kept for text buttons; icon buttons in tables have no pressed transform                                                                                              |
| Loading            | spinner 16px replaces the leading icon (or is prepended); label unchanged; button `disabled` and `aria-busy`; width locked by `min-width` so it does not shrink                                                  |
| Disabled           | `--pn-fg-subtle` text, `--pn-muted` background, no opacity (except primary which uses 50% mix with surface)                                                                                                      |
| Labels             | verb + object, sentence case ("Add group", "Save labels", "Publish 12 groups")                                                                                                                                   |

### 5.4 Dialogs (`Dialog`, `ConfirmDialog`)

| Rule            | Value                                                                                                                                                                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sizes           | `sm` 400px (confirm), `md` 480px (one-column forms), `lg` 640px (two-column forms: association links; add-group-to-label; grant with stepper). Mobile: `calc(100vw − 32px)`, max-height `calc(100dvh − 32px)`, content scrolls, header/footer fixed                                                 |
| Header anatomy  | title 15/600 + description 13 `--pn-fg-muted`, 20px padding, no icon, **no eyebrow** (USER ROLES, GROUP ADMINISTRATION, AZURE MEMBERS, WEB · GUIDES, WEB · ASSOCIATION LINKS are removed), close `X` top-right on form dialogs only                                                                 |
| Body            | 20px padding, fields 16px apart                                                                                                                                                                                                                                                                     |
| Footer          | 16/20 padding, top 1px `--pn-line`, right-aligned: `Cancel` (`outline`) then the primary; destructive confirms: `Cancel` then solid danger. Buttons 40px. On `< 480px` footer stacks full width, primary first.                                                                                     |
| Confirm dialogs | `size=sm`, `AlertDialog` (no close X, no outside-click close), title "{Verb} {object}?", description one sentence stating the consequence, no "Are you sure". Focus lands on `Cancel`.                                                                                                              |
| Dirty close     | any form dialog whose values differ from initial intercepts Esc/X/outside-click/Cancel and opens a nested `ConfirmDialog`: "Discard changes?" / "Your edits to this {noun} will be lost." / `Keep editing` (cancel) + `Discard` (danger). This replaces the grant toast and the guide inline alert. |
| Autofocus       | first field on fine pointers; none on coarse pointers                                                                                                                                                                                                                                               |
| Submit          | `Enter` in single-line inputs submits; `⌘/Ctrl+Enter` in textareas submits; the primary shows loading; on success the dialog closes and a toast fires; on error an `InlineAlert tone=danger` appears above the footer inside the dialog (dialog stays open)                                         |
| Motion          | overlay and panel share 200ms ease-out in (`opacity 0→1`, `scale .97→1`), 150ms ease-in out; see §6                                                                                                                                                                                                 |

### 5.5 Popover vs dialog rule

Popover when **all** hold: non-destructive; ≤ 1 input or a picker; ≤ 320px wide; closing without action is harmless. Otherwise dialog. Consequences: label filter → popover; color picker, date picker, time wheel → popover; "Move project to category" → dropdown menu; FAQ delete and FAQ-category delete → `ConfirmDialog` (were popovers); every create/edit → dialog or inline edit.

### 5.6 Inline alerts (`InlineAlert`)

Tones neutral/info/success/warning/danger; 12px padding, `--pn-r-3`, tone soft background, 16px tone icon, 13px text, optional action right. Used for: persistent load errors, dialog submit errors, partial-save warnings. Not used for action success (toast).

### 5.7 Toasts

| Rule        | Value                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Position    | bottom-right, 24px offset; `< 640px` bottom-center                                                                                                                                                                                                                                                                                                              |
| Visual      | `--pn-surface-raised`, `--pn-shadow-float`, `--pn-r-5`, 12px padding, 16px tone icon (`CircleCheck` success, `Info`, `TriangleAlert`, `CircleX`) in tone color, text 13 `--pn-fg`. Backgrounds are **not** tinted. The one `Toaster` is mounted in the root document (`ui/sonner.tsx`, toast class `app-toast`, styled in `styles.css`); pages call `appToast`. |
| Duration    | success/info 4000ms; warning 6000ms; error 8000ms; never infinite                                                                                                                                                                                                                                                                                               |
| Max visible | 3, stacked                                                                                                                                                                                                                                                                                                                                                      |
| Copy        | §8.3                                                                                                                                                                                                                                                                                                                                                            |
| Actions     | at most one text action ("Undo" is not offered anywhere in this scope)                                                                                                                                                                                                                                                                                          |

### 5.8 Comboboxes, selects, label tree selector

- `Combobox` (Base UI): 36px input, list `--pn-surface-raised` raised layer, items 36px 13px, highlighted `--pn-muted`, selected check 16px right. Empty row 13 muted "No {things} match".
- `Select`: same list; trigger is an `outline` button with trailing chevron.
- `LabelTreeSelector`: 320px tall bordered box (`--pn-line`, `--pn-r-3`); search 36px at top; selected chips row (removable, max 2 lines then scroll) under the search; body sections "Categories", "Attributes", "Publications" as 12/500 muted headings (sentence case, not uppercase); tree rows 32px with 24px indent, selected state `--pn-accent-soft` + `Check`, partial `Minus`; attribute/publication chips as `Chip` with pressed state filled in label color at 15% chroma mix. Searching flattens categories into "Didattica › Ingegneria › Informatica" rows.

### 5.9 Inline editing (`InlineEditCard` / `InlineEditRow`)

One pattern for Projects, Associations, FAQs, label cards:

1. View mode shows an `✎` icon button (36px) among the row/card actions. Only one item per page is in edit mode; starting another cancels the current one if clean, or asks "Discard changes?" if dirty.
2. Edit mode swaps each text element for a field **with the same line box** (input height = text line-height + 16px padding, so the card grows by a fixed 16px per field rather than reflowing); the card keeps its width and grid position; no animation.
3. Fields: inputs 36px for titles/links; textareas auto-grow from 3 rows; a `maxLength` counter (12px muted, "148/160") appears only in the last 20% of the limit.
4. Footer row inside the card: left = validation message, or the hint "Press `⌘/Ctrl + Enter` to save, `Esc` to cancel" (12px muted, `kbd` chips; hidden on coarse pointers); right = `IconButton appearance="tinted"` cancel (`X`, danger) then save (`Check`, success, disabled until valid and dirty), each with a tooltip naming its shortcut. `Esc` cancels; `Enter` saves in single-line inputs; `⌘/Ctrl+Enter` saves in textareas. The shortcut is never a silent no-op: on an unchanged record it closes the editor, and when something required is missing it focuses the first invalid (else empty) field.
5. Save shows the spinner in the save button; on success the card returns to view mode and a toast fires; on error an `InlineAlert` appears in the footer-left slot.

### 5.10 Forms

| Rule             | Value                                                                                                                                                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Labels           | above the field, 13/500 `--pn-fg`, 6px gap; always real `<label for>`                                                                                                                                                      |
| Required         | not marked; optional fields say "(optional)" in the label                                                                                                                                                                  |
| Hint             | 12px `--pn-fg-muted` under the field                                                                                                                                                                                       |
| Validation       | on submit, then on blur for fields that have errored; never on every keystroke. Error: border `--pn-danger-solid`, 12px `--pn-danger-fg` text with `CircleAlert` 14px under the field, `aria-invalid` + `aria-describedby` |
| Inputs           | 36px, 14px (16px on coarse pointer), `--pn-line-strong` border, `--pn-surface` bg, placeholder `--pn-fg-subtle`; `type=search` for search, `inputmode=numeric` for ids                                                     |
| Read-only values | rendered as text in a `KeyValueList`, never as disabled inputs (the Account email input becomes a read-only row)                                                                                                           |
| File inputs      | `outline` button "Choose file" + selected filename chip with remove; hint lists type and size limit ("PNG or JPEG, up to 1 MB")                                                                                            |
| Date/time        | existing `Calendar` popover and `WheelPicker` time popover kept; buttons 36px; mono "HH:MM"; `datetime-local` on coarse pointers                                                                                           |
| Checkbox rows    | label wraps the control; the hint is part of the label hit area                                                                                                                                                            |

### 5.11 Skeletons

Blocks in `--pn-muted`, `--pn-r-2`, opacity pulse 1 → 0.6 → 1 over 1.4s ease-in-out (the one looping animation); reduced motion: static. Shapes match the template exactly (`TableSkeleton`, `CardsSkeleton`, `RecordSkeleton`, `SettingsListSkeleton`) so nothing shifts when data arrives. `aria-busy="true"` on the region with sr text "Loading {things}…".

### 5.12 Keyboard shortcuts

| Keys                               | Action                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `⌘K` / `Ctrl+K`                    | command palette                                                                            |
| `/`                                | focus the page search (when not in an input)                                               |
| `Esc`                              | close palette/dialog/popover; cancel inline edit; clear focused search when it has a value |
| `Enter` / `Space` on a focused row | open the row                                                                               |
| `⌘Enter` / `Ctrl+Enter`            | save in any textarea                                                                       |
| `↑/↓`                              | move within rail, panel, palette, lists                                                    |

### 5.13 Accessibility baseline

Every icon button has `aria-label`; every input has a label; focus is never removed; dialogs trap focus and return it to the trigger; live regions: toasts (`role=status`), counts (`aria-live=polite` on `Count`), optimistic row removal announces "Report resolved". Color is never the only signal (status badges have text; visibility toggle has `aria-pressed` and label). Hit areas ≥ 36px, ≥ 44px on coarse pointers via padding. DOM order = visual order (the header bar is rendered before `main`, including in server HTML).

### 5.14 Translations (`TranslationPanel`)

Every bilingual text (Projects and Associations descriptions, FAQ questions and answers, FAQ category titles) shows one panel per language, so Italian and English read as a pair:

| Rule     | Value                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout   | `TranslationGroup`: IT and EN side by side once the container is ≥ 560px (same height, compared line by line), stacked below; 12px gap. Italian first.                                                                                                                                                                                                                                                                                              |
| Header   | `Languages` icon 14px in `--pn-accent` + "IT"/"EN" 11/600, 0.08em tracking; `--pn-fg-muted` in view, `--pn-accent` in edit. The panel's accessible name is the language name.                                                                                                                                                                                                                                                                       |
| View     | `--pn-muted` at 60%, no border, `--pn-r-3`, 12px padding; text 13/20 `--pn-fg`, clamp per page (Projects 4, Associations 5).                                                                                                                                                                                                                                                                                                                        |
| Edit     | the panel is the field: same size, padding and background as view; fields are `bare` (no box or focus ring, 13/20, text exactly where the read-only text was, grows with its content). Only a 1px border `--pn-accent` 35% over `--pn-line` (70% plus `--pn-muted` while a field has focus, 120ms) and the accent label change. A press on the panel focuses its first field with the caret at the end. Counters and errors appear under the field. |
| Language | `lang` is set on each panel, so screen readers and the browser spellchecker use the panel's language.                                                                                                                                                                                                                                                                                                                                               |
| Not used | in single-line list rows (the FAQ accordion trigger keeps "IT"/"EN" tiny chips), where a panel would not fit the row height.                                                                                                                                                                                                                                                                                                                        |

---

## 6. Motion

Easings: `--pn-ease-out: cubic-bezier(0.32, 0.72, 0, 1)`; `--pn-ease-in: cubic-bezier(0.4, 0, 1, 1)`; `--pn-ease-move: cubic-bezier(0.45, 0, 0.2, 1)`. Only `transform` and `opacity` (plus `background-color`/`color` for hover) are transitioned; `transition-property` is always explicit.

| Element                                                                                          | In                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Out              | Notes                                                       |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------- |
| Section / service switch                                                                         | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | none             | content swaps instantly                                     |
| Panel show/hide (between a service with a panel and a page without: Overview, Account, WhatsApp) | panel `translateX(-100%→0)` + content column as a layout transform (`layout="position"`), 220ms `--pn-ease-out`; first paint none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 180ms same curve |                                                             |
| Rail / panel item hover                                                                          | `background-color, color 120ms ease`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | same             |                                                             |
| Table row hover                                                                                  | `background-color 120ms`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |                  |                                                             |
| Button hover / press                                                                             | 120ms                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |                  | press `translateY(1px)` no transition                       |
| Tooltip                                                                                          | `opacity 120ms ease-out`, `translate 4px → 0` from trigger side                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 80ms ease-in     | first delay 100ms (rail 400ms), siblings 0                  |
| Popover / dropdown / combobox list                                                               | `opacity + scale .97→1 160ms ease-out`, `transform-origin` from trigger side (`var(--transform-origin)`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 120ms ease-in    |                                                             |
| Dialog + overlay                                                                                 | `opacity 200ms ease-out`; panel also `scale .97→1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 150ms ease-in    | paired timing                                               |
| Sheet (panel on small screens)                                                                   | `translateX(-100%→0) 200ms ease-out`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 150ms ease-in    |                                                             |
| Toast                                                                                            | sonner default enter (translateY 16px→0 + opacity, 200ms ease-out)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 150ms            |                                                             |
| Accordion / collapsible                                                                          | `grid-template-rows 0fr→1fr 200ms ease-move` + content `opacity 150ms`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 150ms            | chevron `rotate 150ms ease-out`                             |
| Tree expand                                                                                      | same as accordion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |                  |                                                             |
| ScrollTitle (deep pages)                                                                         | `opacity 150ms ease-out`, `translateY 4px→0`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 100ms            |                                                             |
| Drag (projects)                                                                                  | ghost `scale 1.01` + shadow instantly; siblings `transform 160ms ease-move`; drop settle 200ms ease-out                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |                  |                                                             |
| Optimistic row removal                                                                           | `opacity 120ms ease-in` then unmount                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |                  | no height animation                                         |
| Visibility toggle                                                                                | icon swap instant; spinner replaces icon while pending                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |                  |                                                             |
| Inline edit swap                                                                                 | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | none             |                                                             |
| Theme toggle                                                                                     | View Transition, light-bulb metaphor at the toggle icon (palette: the rail toggle). To light: the new snapshot grows as `clip-path: circle()` from the icon to the farthest corner, 700ms `cubic-bezier(0.32, 0.72, 0, 1)` (entrance: fast flood, soft settle). To dark: the old light snapshot shrinks from the corners into the icon, uncovering the dark one, 520ms `cubic-bezier(0.55, 0.085, 0.68, 0.53)` (exit half of the pair: ease-in, ~25% shorter). Interruptible: pressing the toggle mid-way reverses the light from its current radius (the elapsed part of the same curve, backwards), as often as pressed; the page settles on whichever end the light reaches. The toggle is drawn live above the snapshots (own `view-transition-name`), so its icon follows every press, and shows a neutral hover tint (`data-pointer-over`, since `:hover` cannot match during a transition). Snapshots never cross-fade; element transitions off until it ends | —                | reduced motion or no View Transitions support: instant swap |
| Skeleton pulse                                                                                   | `opacity 1→.6→1 1.4s ease-in-out infinite`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |                  |                                                             |
| Command palette                                                                                  | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | none             |                                                             |

Never animates: layout width/height (except grid-rows trick), colors on theme change, the active indicators, sorting/filtering/paging, keyboard-initiated changes, initial page load (no `animate-appear`).

Reduced motion (`prefers-reduced-motion: reduce`): all durations above become 0 and the skeleton pulse stops; `motion/react` components use `useReducedMotion()` and set `initial={false}`. The global rule already in `styles.css` is kept.

---

## 7. Per-page specs

Common removals on every page: eyebrow, `h1` + description block (section pages), breadcrumb, `animate-appear`, dialog eyebrows, "successfully" in toasts. Common ports: `canWrite` gating is applied uniformly to every mutation control on every page (today only four pages gate), using `roles` from route context.

### 7.1 Overview `/dashboard`

- Template: Overview (no panel). Header bar: `h1` "Overview".
- Removed: eyebrow "Workspace", title "Operations overview", description, the "Administrator workspace" intro card and its bullets, "Administrative areas" heading and description.
- Content:
  1. `StatTiles` 4-up (2-up < 1024): "Telegram groups", "Telegram users", "Open reports", "Active grants"; number 28/600 tabular, label 12 muted; each tile is a link to its section; hover `--pn-muted` background only. Values come from the route loader; a tile whose service failed to load shows `—` and a warning alert with Retry sits above the tiles.
  2. `SectionHeading` "Needs attention" + list surface of up to 4 rows (44px) derived from the loader counts: "{n} open reports" → Reports › Open; "{n} hidden Telegram groups" → Telegram › Groups filtered; "{n} grants expire within 7 days" → Grants; "{n} Microsoft 365 groups with 0–1 member" → Microsoft 365 › Groups. Rows with zero are omitted; if all are zero the surface shows `EmptyState` "Nothing needs attention" / "Reports, hidden groups and expiring grants will appear here."
  3. `SectionHeading` "Areas" + 5 `ServiceCard`s (one per service): glyph, service name 14/600, and its sections as `Chip`-styled links. This ports today's six link cards (the mismatched "Web guides" copy is dropped).
- No activity feed (not in inventory, no data).

### 7.2 Account `/dashboard/account` — exemplar settings page

Template: Settings, 720px. Header bar: `h1` "Account". No panel.

```
PageBar   Account
────────────────────────────────────────────────────────────────────
SectionCard  Profile
  ┌──────────────────────────────────────────────────────────────────┐
  │ (avatar 64)  Lorenzo Corallo                      [Change picture]│
  │              lorenzo.corallo@polinetwork.org      [Remove]        │
  │ ─────────────────────────────────────────────────────────────── │
  │ Full name                                                        │
  │ [Lorenzo Corallo                                   ]             │
  │ Email              lorenzo.corallo@polinetwork.org  (read-only)  │
  │                                                      [Save name] │
  └──────────────────────────────────────────────────────────────────┘
SectionCard  Telegram
  │ Username        @lorenzo_corallo                                 │
  │ Telegram ID     184220371                                        │
  │ Roles           [owner] [web]                                    │
  │ ⓘ Roles and permissions come from this Telegram account.         │
SectionCard  Passkeys                                   [Add passkey]
  │ 🔑 MacBook Pro          Added 6 Oct 2026 · platform        [🗑]  │
  │ 🔑 Unnamed passkey      Added recently                      [🗑]  │
SectionCard  Sessions                         [Sign out other sessions]
  │ 🖥 Chrome on macOS       93.45.12.8 · Since 1 Oct 2026   [Current]│
  │ 🖥 Safari on iPhone      Unknown IP · Since 28 Sep 2026          │

                       (48px)
SectionCard  (no title)
  │ Sign out of this device                 [Sign out] (danger outline)│
  │ You will return to the sign-in page.                              │
```

- Removed: eyebrow "Account", title "Profile and security", description, page-level notice alerts, the separate "Profile details" and "Telegram identity" card headers' descriptions, card header icons, the email disabled input.
- **Profile** card: 64px avatar (image or initials on `--pn-accent-solid`); `Change picture` (`outline`, opens the hidden `image/png,image/jpeg` input) and `Remove` (`ghost`, only with an image) → `ConfirmDialog` "Remove profile picture?" / "Your current picture will be removed from this account." / `Remove picture`. The hint "PNG or JPEG, up to 1 MB." sits under `Change picture` (12px muted). With an empty name the name line reads "Complete your profile" (muted) and the initials come from the email. Client validation error "Use a PNG or JPEG image smaller than 1 MB." replaces the hint on the same line as a §5.10 field error (12px `--pn-danger-fg` with `CircleAlert`, `role=alert`), so nothing moves and no empty slot is reserved under the avatar row. Below a 1px divider: `Full name` input (required) and `Email` as a `KeyValueList` row with a `Lock` 14px icon and tooltip "Email is managed by your sign-in provider and cannot be changed here." `Save name` (`default`) disabled until changed; loading spinner inside. Toasts: "Profile picture updated." / "Couldn't update your profile picture." / "Profile picture removed." / "Couldn't remove the picture." / "Name updated." / "Couldn't update your name."
- **Telegram** card: `KeyValueList` Username (`@x` or `—`), Telegram ID (mono or `—` with hint "Not linked"), Roles (`Chip`s or `—`). One hint line replaces the card description.
- **Passkeys** card: action `Add passkey` (`default`; the only primary on the page — `Save name` is in a form region, so both are allowed: one per region). Rows 56px: `KeyRound` 16 muted, name 13/500 or "Unnamed passkey", meta 12 muted "Added {d MMM yyyy} · {deviceType}" or "Added recently"; trash icon button → `ConfirmDialog` "Delete passkey?" / "{name} will no longer sign in to this account." / `Delete passkey`. Loading: `SettingsListSkeleton rows=2` in the same slot. Empty: single 56px row text 13 muted "No passkeys yet. Add one to sign in without a code." `Add passkey` stays enabled while the list loads. Error loading security data: `InlineAlert tone=danger` in the Passkeys list slot only: "Couldn't load passkeys and sessions." + `Retry` (`outline`), spinner while retrying; the Sessions list slot shows one muted line "Couldn't load sessions." and shares that Retry. Toasts: "Passkey added." / "Couldn't add the passkey." / "Passkey deleted." / "Couldn't delete the passkey."
- **Sessions** card: action `Sign out other sessions` (`outline`, only when > 1; disabled while the list loads or failed) → `ConfirmDialog` "Sign out other sessions?" / "{n} other sessions will be signed out. This device stays signed in." / `Sign out sessions`. Rows: `MonitorSmartphone` icon, user agent or "Unknown device", meta "{ip or Unknown IP} · Since {date}"; current session first with `StatusBadge tone=brand` "Current". Toasts "Other sessions signed out." / "Couldn't sign out other sessions."
- **Sign out** card (destructive zone): title-less `SectionCard` with text 14/500 "Sign out of this device", hint 12 muted, and a danger `outline` button `Sign out` right. No confirmation (reversible by signing in). Failure toast "Couldn't sign out. Try again."
- All successes are toasts; the page never inserts alerts above the cards. Loading of security data swaps list ↔ skeleton inside the card so nothing above moves.

### 7.3 Telegram users `/dashboard/telegram/users`

- Template: List. Header bar: search "Search by name or username…" (strips leading @), `Count` "{n} users"; no primary action (users are not created here).
- Removed: eyebrow, title, description, avatar initials tile (first column is the name only).
- Columns: Name (13/500, one line) · Username (`@username` or `—`) · Telegram ID (mono), equal widths (all three are short values; fixed layout, the chevron column is 52px) · a trailing 16px `ChevronRight` in `--pn-fg-subtle` (`--pn-fg-muted` and 2px nudge on row hover) that signals the row opens the detail. Row click opens detail; `aria-label="Open {name}"`.
- Page size 20. Empty: filtered "No users match" / "Try another name or username." + `Clear search`; true "No Telegram users yet" / "Users appear here once the bot has seen them."

### 7.4 Telegram user detail `/dashboard/telegram/users/$userId`

Template: Record detail. Header bar left: `[←]` (tooltip "Back to users") + `184220371` mono muted + `ScrollTitle`. Header bar right (canWrite): `Add grant` (`default`, opens `CreateGrantDialog` with fixed user) and `End grant` (danger `outline`, only with an ongoing grant). Both header actions are the grant actions because grants are the primary administrative act on a user.

```
RecordHeader
  (GF 40)  Giulia Ferrari                                   (actions live in PageBar)
           @giuliaf                       ← "No Telegram username" → "—"
           [admin] [hr]  [+ Assign role] [− Remove role]      (chips + ghost xs→sm buttons, canWrite)
──────────────────────────────────────────────────────────────────── 1px
SectionCard  Grants
  ┌ Ongoing   ● Active    6 Oct 2026, 09:00 → 8 Oct 2026, 09:00                  ┐
  │ Scheduled ● Scheduled 12 Oct 2026, 08:00 → 12 Oct 2026, 20:00                │
  └ (empty: "No active or scheduled grants." + hint "Grants let this user send links without automatic moderation.") ┘
SectionCard  Group administration  3                                    [Add group]
  │ Analisi Matematica 1          -1001234567   Added by Marco · @marcobnc   [Remove] │
  │ …                                                                                │
SectionCard  Recent messages  15
  │ Analisi Matematica 1 ↗           Chat -1001234567        6 Oct 2026, 10:12       │
  │ │ message text…                                                                  │
  │   Message #4412 · Open message ↗                                                  │
SectionCard  Audit log  4
  │ ban      6 Oct 2026, 08:00    Spam links     Analisi Matematica 1 · -1001234567  │
```

- Removed: "← Back to users" text link (now the icon back button), eyebrow "Telegram profile · {id}" (id is in the header bar), the profile `Card` wrapper, the badge "{n} roles" (chips are visible), the **Identity summary card** (ID in header bar, name in `h1`, username in meta — all stated once), the three-up `SummaryCard` grid, mono uppercase section labels.
- Roles live in the `RecordHeader` chips row with `+ Assign role` / `− Remove role` as `ghost` 32px-text buttons (`size=sm`); disabled with tooltip "All configured roles are assigned" / "No roles to remove". `RoleDialog` (`md`): title "Assign role"/"Remove role", description kept, field "Role" combobox; footer `Cancel` + `Assign role`/`Remove role`. Toasts "{Role} role assigned." / "{Role} role removed."; error messages kept verbatim as `InlineAlert` inside the dialog.
- Grants section: rows 56px as `KeyValueList` horizontal: label ("Ongoing"/"Scheduled"), `StatusBadge`, range in `d MMM yyyy, HH:mm → d MMM yyyy, HH:mm`. `InterruptGrantDialog` → `ConfirmDialog` "End grant?" / "{name} will immediately return to the normal automatic moderation rules." / `End grant`. Toast "Grant ended for {name}."
- Group administration: rows 56px: title 13/500 (link to groups list `?q=`), mono id 12, "Added by {firstName} · @{username}" 12 muted, `Remove` ghost-danger text button → `ConfirmDialog` "Remove group administrator?" / "{name} will no longer administer {groupTitle}. Other assignments do not change." / `Remove administrator`. `Add group` → `AddGroupAdminDialog` (`md`): title "Add group administrator", description kept, field "Group" combobox; all-taken state as `InlineAlert tone=info` "This user already administers every available group." with the primary disabled. Toasts "Group administrator added." / "Group administrator removed."
- Recent messages: rows as cards inside the section surface (not separate cards): header line group title link (external icon 14), `Chat {id}` mono 12 muted, timestamp 12 muted right; body 13/20 with a 2px `--pn-line-strong` left rule (not brand); footer `Message #{id}` mono 12 + `Open message` link 12. Max 15. Empty "No recent messages from this user."
- Audit log: `DataTable` inside the section: Type (13/500, verbatim type), Date, Reason ("—" when null), Group ("{title} · {id}" mono id). Empty "No audit events for this user."
- `CreateGrantDialog` (`lg`): title "New grant" (sentence case); stepper kept only when no fixed user, restyled as two 4px progress bars with 12px labels; step 1 "Find Telegram user" toggle Username | Telegram ID, input, `Find user` (`outline`, spinner "Looking up…" label kept), result as `InlineAlert tone=success` with name, @username · Telegram ID, and clear `X`; step 2 `Change user` ghost, `GrantDateTimeFields` (labels "Valid from"/"Valid until", `Now` ghost, duration shortcuts as a `ToggleGroup` 2h/6h/12h/1d), "Motivation (optional)" textarea max 500 with counter. Footer `Cancel` / `Continue` → `Cancel` / `Create grant`. Dirty close → `ConfirmDialog` "Discard changes?" (replaces the shaking toast). Validation copy kept verbatim. Toast "Grant created for {name}."

### 7.5 Grants `/dashboard/telegram/grants`

- Template: List. Header bar: search "Search users, authorizers or reasons…", segmented `All {n} | Ongoing {n} | Scheduled {n}` (`ToggleGroup`, counts tabular muted inside), `Count` "{n} grants"; right (canWrite) `New grant` (`default`).
- Columns: User (name or "User {id}", secondary `@username` or mono `Telegram ID {id}`), Reason ("—" when null), Authorized by (name when the grantor is a known user, otherwise mono id — fixes inconsistency §6), Starts, Expires (sortable), Status (`StatusBadge`). Default sort Starts asc. Page 20.
- Empty: filtered "No grants match" / "Try another user, authorizer or reason."; true "No grants in this view" / "Grants are board-authorized periods when a user may send links without automatic moderation."

### 7.6 Telegram groups `/dashboard/telegram/groups`

- Template: List. Header bar: search "Search by group name or tag…" (prefilled from `?q=`), `Labels` filter popover (320px: "Must have" / "Must not have" `LabelTreeSelector`s stacked, `Clear label filters` ghost, empty state text "No labels have been created yet."), `Count` "{n} groups". No primary action (bot-managed). Active filter shows "Labels · 2".
- Removed: icon tile in Group cell; eyebrow/title/description; alerts above the table become toasts (mutation error) and an `InlineAlert tone=warning` row above the table only for the refresh error, dismissible.
- Columns: Group (13/500, sortable) · Telegram ID (mono, sortable) · Tag (mono `@tag` or `—`, sortable; priority 3, first to hide) · Labels (`GroupLabelBadges`) · actions: invite link (`ExternalLink`; disabled `Link2Off` with tooltip "Not shared"), visibility toggle (`Eye`/`EyeOff`, `aria-pressed`, spinner while pending, one in flight), edit labels (`Tags`, amber), leave (`LogOut`, destructive) → `ConfirmDialog` "Leave {title}?" / "The bot leaves this Telegram group and its record is deleted. This cannot be undone here." / `Leave group`. Toasts "Left {title}." / "{title} is now hidden." / "{title} is now visible." Errors verbatim.
- `GroupLabelsDialog` (`md`): "Edit labels" / "Choose the labels that apply to {title}." `LabelTreeSelector`; `Cancel` / `Save labels` (disabled until changed). Partial failure → `InlineAlert tone=warning` in the dialog with the verbatim text.
- Empty: filtered "No groups match" / "Clear the search or filters and try again." + `Clear filters`; true "No Telegram groups yet" / "Groups appear here once the bot joins them."

### 7.7 WhatsApp groups `/dashboard/whatsapp/groups`

- Template: List, without a panel (one section): the header bar starts with "WhatsApp › Groups" (15/600), then search "Search by group name…", `Labels` filter, visibility, `Count`; right `Add group` (`default`). The rail item leads straight here.
- Group actions retain the original colors in both themes through `--pn-action-*`: neutral outlined invite link, blue visible / amber hidden visibility, green edit, amber labels, red leave/delete. Use `IconButton appearance="tinted"` with the corresponding tone: colored icon with a soft tone outline (18% over `--pn-line-strong`) and a 5% tint at rest, stronger border and tint on hover; geometry and spacing follow §5.1. Other row actions keep their ghost treatment.
- Columns: Group (sortable) · Labels · actions: invite link, visibility, edit (`Pencil`), edit labels, delete (`Trash2`) → `ConfirmDialog` "Delete {title}?" / "The group record is removed. This cannot be undone." / `Delete group`. Toast "{title} deleted."
- `CreateEditGroupDialog` (`md`): titles "Add WhatsApp group" / "Edit WhatsApp group"; descriptions kept (the "labeled **{label}**" suffix rendered with a `LabelChip`); fields Title (max 200, hint counter), Invite link (hint "Must start with https://chat.whatsapp.com/"; error "Enter a valid WhatsApp group invite link."), create-only checkbox "Hide until published" with hint. Footer `Cancel` / `Add group` | `Save changes`. Toasts "{title} added." / "{title} added and labeled {label}." / "{title} updated." Submit error as `InlineAlert`.
- Empty: filtered as 7.6; true "No WhatsApp groups yet" / "Add the first WhatsApp group to list it on the site." + `Add group`.

### 7.8 Microsoft 365 groups `/dashboard/azure/groups` (service renamed from "Azure")

- Template: Grouped-collapsible. Header bar: search "Search by group or email…" (**added**), `Count` "{n} groups · {m} memberships" (replaces the two badges). No primary action.
- Removed: eyebrow "Azure directory", title, description, info alert, mail icon (email is text).
- Row spec in 4.7. `MembershipDialog` (`md`): titles "Add a group member" / "Remove a group member"; descriptions kept with the group name in 500 weight; `Command` list with search "Search by name or email…", heading "Available users" / "Current members", rows 40px avatar 24 + name (or "Unnamed user") + mail 12 muted; empty rows verbatim. Removal keeps the two-step: selecting a member swaps the dialog body to the confirm copy "Remove {name}?" / "They lose access to this Microsoft 365 group. Their account is not deleted." with footer `Keep member` / `Remove member` (danger). Toasts "{name} added to {group}." / "{name} removed from {group}."; errors verbatim as `InlineAlert`.
- Empty: "No Microsoft 365 groups yet" / "No groups were returned from Microsoft Entra."

### 7.9 Microsoft 365 members `/dashboard/azure/members` (title "Members")

- Template: List. Header bar: search "Search by name, email or member ID…", toggle `Members only` (`Toggle`, `aria-pressed`), `Count` "{n} members · {m} licenses" (replaces the stats strip); right (canWrite) `Add member` (`default`).
- Columns: Member ID (numeric right, sortable, `—`), Member (name or "Unnamed member"; the "Association member" sub-line is removed because the filter and the ID already say it), Email (`—` when null), Licenses (`Chip`s or `—`), actions (canWrite): `Pencil` "Set member ID". Default sort Member ID. Page 20.
- `MemberDialog` (`md`): create "Create a member" / "Creates the association record and sends a welcome email." fields First name, Last name, Welcome email recipient, Member ID (numeric); edit "Set member ID" / "Update the association number linked to this account." field Member ID (optimistic). Validation "Enter a valid positive member ID." Footer `Cancel` / `Create member` | `Save member ID`. Toasts "Member created." / "Member ID updated."
- Empty: filtered "No members match" / "Clear the search or turn off Members only."; true "No members yet" / "No members were returned from Microsoft Entra."

### 7.10 Projects `/dashboard/web/projects`

- Template: Card-collection in a single column at every width, because the card order is the order on the website. Header bar: segmented `News {n} | General {n} | Deprecated {n}`, `Count` "{n} projects"; right `Add project`.
- Card: drag handle, logo 40 (image or initials; fallback "PR"), title 14/500, actions `✎`, `🗑`, `⋮` (menu: "Move to News/General/Deprecated" radio group). Body (full card width, the actions sit beside the logo row only): link (13 `--pn-accent`, host only, external icon; `—` when missing), then IT/EN `TranslationPanel`s side by side (4-line clamp; §5.14).
- Inline edit per §5.9: logo upload button over the logo (SVG/PNG/JPEG ≤ 1 MB; verbatim errors as field errors), Title (max 160), Link (placeholder `https://…`), IT/EN textareas (max 5000). Save disabled until title + both descriptions.
- Drafts: `Add project` inserts a card at the top in edit mode with empty fields and placeholders "Project title" / "Descrizione in italiano" / "Description in English" (placeholders, not prefilled text) and a "Draft" badge.
- Delete → `ConfirmDialog` "Delete project?" / "{title} is removed from the website. This cannot be undone." / `Delete project`. Toasts "Project added." / "Project updated." / "Project deleted." / "Project moved to {Category}." Reorder error toast "Couldn't save the project order." (order reverts).
- Empty per category: "No {category} projects yet" / "Add a project here or pick another category." + `Add project`.

### 7.11 Associations `/dashboard/web/associations`

- Template: Card-collection. Header bar: search "Search associations…", `Count`; right `Add association`.
- Card: logo 40, name 14/500, actions `✎` `🗑` beside the logo row, IT/EN `TranslationPanel`s (5-line clamp; side by side when the card is ≥ 560px, §5.14), footer: `Count` "{n} public links" 12 muted + `Manage links` (`ghost`). Edit mode: logo upload (JPG/PNG/SVG ≤ 1 MB), name (max 200), IT/EN textareas in edit-mode `TranslationPanel`s (max 20,000). "Unsaved draft" → "Draft" badge.
- `AssociationLinksDialog` (`lg`, two columns): title "{name} links", description kept; 10 inputs with the verbatim placeholders and `type=url`/`email`; footer `Cancel` / `Save links`. Errors verbatim as `InlineAlert`.
- Delete → "Delete association?" / "{name} is removed from the website. This cannot be undone." / `Delete association`. Toasts "Association added." / "Association updated." / "Association deleted." / "Links updated."
- Empty: filtered "No associations match" / "Try a different name or description."; true "No associations yet" / "Add the first association shown on the public website." + `Add association`.

### 7.12 Freshman guide `/dashboard/web/guides` (section title "Freshman guide")

- Template: List (no pagination, no sort). Header bar: search "Search by version…", `Count` "{n} editions"; right `Publish edition` (`default`).
- Columns: Edition ("Version {v}" 13/500, `StatusBadge tone=brand` "Latest" on the newest), Published (`d MMM yyyy`), File (28px `outline` button: muted `Download` 14px icon + "PDF" 13/500, 8px/10px padding, `--pn-r-2`; opens a new tab), actions `🗑` → `ConfirmDialog` "Delete edition?" / "Version {v} is removed and its PDF is no longer linked. This cannot be undone." / `Delete edition`.
- `CreateGuideDialog` (`md`): title "Publish a new edition", description kept; Version (prefilled next; dup error verbatim), Date (calendar popover, shown `d MMM yyyy`), PDF file (file button, hint "PDF only, up to 2 MB."). Dirty close → shared `ConfirmDialog`. Footer `Cancel` / `Publish edition`. Toasts "Edition {v} published." / "Edition deleted."
- Empty: filtered "No editions match" / "Try a different version number."; true "No editions yet" / "Upload the first PDF edition of the Guida della Matricola." + `Publish edition`.

### 7.13 FAQs `/dashboard/web/faqs`

- Template: List variant with accordion. Header bar left: one 36px category surface (`role="group"`, 1px `--pn-line-strong`, `--pn-r-3`): a muted "Category" prefix 12/500, the borderless category `Select` (icon + Italian title; items show IT title, EN title muted, count tabular), then `✎` Edit category and `🗑` Delete category as square 36px icon buttons, the parts split by 1px `--pn-line` dividers, so everything acting on the category reads as one control; `Count` "{n} FAQs" (**search added**: "Search questions…" filters within the category), right: `Add category` (`outline`) + `Add FAQ` (`default`, disabled with tooltip "Create a category first" when none).
- Removed: eyebrow/title/description, the "Category:" label card bar (its label now prefixes the category surface in the header bar), `Q:`/`A:` prefixes, colored hover tints on icon buttons.
- Category actions sit right of the select as two icon buttons: `✎` "Edit category", `🗑` "Delete category" → `ConfirmDialog` "Delete category?" / "{titleIt} and all its FAQs are deleted. This cannot be undone." / `Delete category` (was a popover with "Confirm Delete").
- `AddCategoryDialog` (`md`): "Add category" / "Edit category"; field "Icon" as a 8-column grid of 32 lucide icons (36px cells, selected `--pn-accent-soft` + ring); a "Title" label over IT/EN edit-mode `TranslationPanel`s holding `bare` inputs (accessible names "Title (Italian)"/"Title (English)"; errors under the field, panel border danger; §5.14) (placeholders verbatim). Both required (fixes the IT-only check); errors inline under fields instead of the toast "Category titles cannot be empty." Footer `Cancel` / `Create category` | `Save changes`.
- Accordion list: one surface, items 1px apart, trigger row 48px: "IT" tiny chip + question 13/500, "EN" tiny chip + question 13 muted below (row 56 when EN exists), chevron right, actions `✎` `🗑` (→ `ConfirmDialog` "Delete FAQ?" / "The question and both answers are deleted." / `Delete FAQ`). Content: IT and EN answers in view `TranslationPanel`s, side by side (§5.14). Edit mode (§5.9): one edit-mode panel per language holding its question (`bare` input, 13/500), a 1px `--pn-line` hairline and its answer (`bare` textarea), so question and answer stay separated within each language; placeholders "Question…"/"Answer…" (the panel names the language). Multi-open.
- Inline edit per §5.9 inside the item: two inputs "Question (Italian)" / "Question (English)", two textareas "Answer (Italian)" / "Answer (English)"; validation messages verbatim shown under the field (not as toasts). `Add FAQ` appends a draft item in edit mode and opens it.
- Toasts: "Category added." / "Category updated." / "Category deleted." / "FAQ saved." / "FAQ deleted." The toast "Please select or create a category first." is replaced by the disabled-button tooltip.
- Empty: "No FAQs in this category" / "Add the first question and answer." + `Add FAQ`; no category: "No categories yet" / "Create a category to start adding FAQs." + `Add category`.

### 7.14 Labels `/dashboard/web/group-labels` (section renamed from "Group labels")

- Template: Tree (4.3). Header bar: search "Search categories, attributes and publications…", `Count` "{n} of {total} labels"; right `Add tag ▾` (`outline`, menu: "Add attribute", "Create publication") + `Add category` (`default`).
- Three `SectionHeading`s with the one-line descriptions (1.6). Rows 44px: chevron (categories), dot 8px in label color (real labels), name 13/500 (link to the category page or tag page; hover underline), description 13 muted or `—`, actions in the §4.3 order: `✎` (color + description inline edit), `🗑`, `⋮` (attributes: Rename; categories: Rename, Add sub-category; roots: Add sub-category only; publications: no menu).
- Inline edit (`InlineEditRow`): color `Select` trigger is a 20px swatch (aria "Label color") with a 5-column swatch popover (Gray, Red, Orange, Amber, Green, Teal, Blue, Indigo, Purple, Pink; unknown → "Custom" outline) and a live `LabelChip` preview; description input (max 500, placeholder verbatim); `Cancel` / `Save`.
- Delete → `ConfirmDialog` "Delete label?" / "{breadcrumb} is removed from every group that uses it. This cannot be undone." / `Delete label`. Toasts "Label updated." / "Label deleted."
- `AddCategoryDialog` (`md`): step 1 title "Add category" description "Which top-level category does this belong under?" two `NavCard`s "Didattica" / "Extra"; step 2 `← Back` ghost, description "Creates a new category under {Root}.", field "Name" (max 128; validation verbatim). Footer `Cancel` / `Add category`. Toast "{Name} created under {Root}." then navigate.
- `AddTagDialog` (`md`): "Add attribute" / "Create publication"; descriptions verbatim; field "Name" (placeholders verbatim). Footer `Cancel` / `Add attribute` | `Create publication`. Toasts "Attribute {x} created." / "Publication {x} created."
- `RenameLabelDialog` (`md`): "Rename category" / "Rename attribute"; descriptions verbatim; field "Name"; preview row `KeyValueList` "Will become" + mono path. Footer `Cancel` / `Rename`. Toast "Renamed to {x}."
- `AddChildLabelDialog` (`md`): "Add sub-category" / "Creates a new category under {breadcrumb}."; field "Name"; preview "Will be created as" + mono path. Footer `Cancel` / `Add category`. Toast "{childPath} created."
- Empties verbatim titles with the formula: "No categories match" / "Try a different name or description."; "No attributes yet" / "Add the first attribute, like a language or campus." + `Add attribute`; "No publications yet" / "Create a publication, add existing groups, then publish the batch." + `Create publication`.

### 7.15 Categories `/dashboard/web/groups-by-label` and `/$`

- Root: Browser root (4.4). Header bar left `Count` "{n} categories"; right `Add category`. Content: two `NavCard`s "Didattica" / "Extra" with counts.
- Node: header bar left `[←]` (tooltip "Back to {Parent}") + parent path text ("Categories" for first-level nodes); right `Add category` (`outline`, `AddChildLabelDialog`) + `Add group` (`default`, `AddGroupToLabelDialog`). `RecordHeader`: dot in label color + `h1` last segment + meta "{n} groups tagged directly" + description text if the label has one (13 muted). Sub-categories `NavCard` grid; Groups `SectionHeading` with search "Search by group name or tag…" in its right slot; `CombinedGroupsTable`.
- Removed: "← Back to {Parent}" text link, eyebrow breadcrumb, description "Groups tagged directly with…" (now the meta line), "Sub-categories"/"Groups" as separate headings → `SectionHeading`s.
- `CombinedGroupsTable`: Group (platform glyph 14 + title; no "telegram"/"whatsapp" text line), Tag (mono), Labels, actions per platform as in 7.6/7.7 (Telegram edit is omitted instead of disabled). Page 20.
- `AddGroupToLabelDialog` (`lg`): title "Add group to {breadcrumb}". Step choose: two `NavCard`s "New group" / "Create a group that doesn't exist yet." and "Existing groups" / "Label groups you already have.". Step new (WhatsApp only): `WhatsappGroupFields` + "Attributes and publications" `LabelTreeSelector tagsOnly`; footer `Cancel` / `Add group`. Step existing: segmented "Telegram | WhatsApp", search "Search {platform} groups…", selected chips "{n} selected", pick list rows 40px (`aria-pressed`, selected `--pn-accent-soft` + check), empty "No matching groups"; footer `Cancel` / `Add group` | `Add {n} groups`. Toasts "{title} labeled {path}." / "{n} groups labeled {path}."
- Empty: "No groups labeled {breadcrumb}" / "Check the sub-categories above or add a group." + `Add group`.

### 7.16 Tag page `/dashboard/web/tags/$tag`

- Browser node variant. Header bar left `[←]` (tooltip "Back to labels") + "Attributes" or "Publications"; right (publications with rows) `Publish {n} groups` (`default`, `Megaphone`) + `Add group` (`outline`; `default` when no publish button).
- `RecordHeader`: dot + `h1` humanized tag + meta: publications "Publishing makes these groups visible and clears this tag." / attributes "{n} groups with this attribute." Then `SectionHeading` "Groups" with search + `CombinedGroupsTable`.
- `PublishTagGroupsDialog` → `ConfirmDialog` (primary, not danger): "Publish {tagName}?" description verbatim (both variants); footer `Cancel` / `Publish {n} groups`. Toast "Published {tag}: {n} groups visible, tag cleared."
- Empty: "No groups tagged {title}" / "Add existing groups to this tag to start using it." + `Add group`.

### 7.17 Reports `/dashboard/reports/group-links` → "Open", `/dashboard/reports/resolved` → "Closed"

- Template: Queue (4.8). Header bar: segmented filter, search "Search by group, label or link…" (**added**), `Count` "{n} open reports" / "{n} closed reports". No primary action.
- Columns: Reference (group title or label or `—`; `CountBadge ×n` for grouped duplicates), Issue (platform glyph + "Broken link" / "Missing group"), Details (reported link as host + path truncated, or details text; `—`), Status (Closed only, `StatusBadge`), Date (`d MMM yyyy`), actions (Open only): `X` "Dismiss", `Check` "Resolve".
- Row click/Enter: broken link → the platform's groups list with `?q={groupTitle}`; missing → the category page. Row has `aria-label="Open {reference}"`.
- Toasts "Report resolved." / "Report dismissed." / "Couldn't update the report. Check your permissions and try again."
- Empty: "No open reports" / "Broken Telegram or WhatsApp links and missing groups reported by students appear here." ; "No closed reports" / "Resolved and dismissed reports appear here."

---

## 8. Copy rules

### 8.1 Tone and casing

- Sentence case everywhere: titles, buttons, headers, badges, menu items ("Add category", not "Add Category").
- Verbs first, objects named: "Delete passkey", "Save labels", "Publish 12 groups".
- No "please", no "successfully", no exclamation marks, no "Are you sure".
- Contractions allowed in errors ("Couldn't save the project order.").
- Numbers in copy use digits with thousands separators (`Intl.NumberFormat("en-GB")`).
- "Microsoft 365" replaces "Azure" and "Office 365" in all user-facing text; "Microsoft Entra" is kept where the inventory names the source.

### 8.2 Confirmation normalization

Pattern: title "{Verb} {object}?" · one-sentence consequence · `Cancel` + "{Verb} {object}" (danger for destructive, primary for publish).

| Today (trigger → confirm label)                             | New title                   | New confirm label    |
| ----------------------------------------------------------- | --------------------------- | -------------------- |
| Remove picture → "Remove picture"                           | Remove profile picture?     | Remove picture       |
| Delete passkey → "Delete passkey"                           | Delete passkey?             | Delete passkey       |
| Sign out other sessions → "Sign out sessions"               | Sign out other sessions?    | Sign out sessions    |
| End grant → "End grant"                                     | End grant?                  | End grant            |
| Remove (group admin) → "Remove assignment"                  | Remove group administrator? | Remove administrator |
| Leave {title} → "Confirm leave"                             | Leave {title}?              | Leave group          |
| Delete {title} (WhatsApp) → "Delete"                        | Delete {title}?             | Delete group         |
| Delete project → "Delete"                                   | Delete project?             | Delete project       |
| Delete association → (none)                                 | Delete association?         | Delete association   |
| Delete Guide → "Confirm"                                    | Delete edition?             | Delete edition       |
| Delete "{titleIt}"? popover → "Confirm Delete"              | Delete category?            | Delete category      |
| Delete this FAQ? popover → "Confirm Delete"                 | Delete FAQ?                 | Delete FAQ           |
| Delete label → "Delete"                                     | Delete label?               | Delete label         |
| Remove {name}? (M365) → "Remove member"                     | Remove {name}?              | Remove member        |
| Publish "{tag}"? → "Confirm publish"                        | Publish {tag}?              | Publish {n} groups   |
| Discard grant changes? toast / Discard guide changes? alert | Discard changes?            | Discard              |

### 8.3 Toast formula

- Success: "{Object} {past participle}." — "Group deleted.", "Labels updated for {title}.", "Grant created for {name}." Object names in plain text, no quotes or bold.
- Error: "Couldn't {verb} {object}." + optional one clause of next step. Server-specific messages from the inventory are kept verbatim when they carry information ("You do not have permission to manage grants.").
- Warning (partial): "{What happened}, but {what did not}." — "The visibility was updated, but the latest group data could not be refreshed."
- Inline alert instead of toast when: the message belongs to a form (keep the dialog open), the condition persists (load failure), or the user must act (retry).

### 8.4 Empty-state formula

Title: "No {things} yet" (true empty) or "No {things} match" (filtered). Text: one sentence, either what will appear here and how it gets there, or how to widen the filter. Action: the create action when one exists on the page (true empty) or `Clear search`/`Clear filters` ghost (filtered). The create action inside an empty state is `outline`; the page primary stays in the header bar. Section-level empties (one card, collapsible or list slot inside a page) use `SectionEmpty`: the title formula in 13px muted plus an optional 12px hint, no icon or action. Icon: the section's panel icon, 20px `--pn-fg-muted`, in a 40px `--pn-muted` tile, `--pn-r-3`. Padding 48px, centered, max text width 36ch.

### 8.5 Counts

`Count` renders `{n} {noun}` or `{n} of {total} {noun}` with the noun pluralized by `Intl.PluralRules` ("1 group", "2 groups"). Multiple counts are joined with " · ". The word "results" is not used. Counts in segmented filters are bare tabular numbers after the label. Counts next to section titles are bare numbers in 13 muted tabular, 8px after the title.

### 8.6 Dates and times

`d MMM yyyy` ("6 Oct 2026") for dates; `d MMM yyyy, HH:mm` for timestamps; ranges with " → ". Relative time is not used in tables. "Added recently" / "Unknown device" / "Unknown IP" fallbacks are kept. All dates are tabular and never wrap (`whitespace-nowrap`).

Dashboard timestamps use `Europe/Rome` with `en-GB` formatting so the server and browser render the same text. Date/time inputs continue to use the local timezone for entry.

### 8.7 Unset values

`—` (em dash character, `--pn-fg-muted`, with `aria-label` "Not set") replaces "Not set", "Not provided", "Not assigned", "No link provided", "No description", "No licenses", "No labels", "No Telegram username", "Not available". Exceptions that stay as words: "Unnamed passkey", "Unnamed user", "Unnamed member", "Unnamed account", "Unknown device", "Unknown IP", "User {id}" (they name a thing, not an absence).

---

## 9. Builder notes

### 9.1 File layout

```
docs/design.md                     ← this file
src/styles.css                     ← all --pn-* tokens (light + dark), shadcn remap, focus, selection, invalid fields,
                                     disabled buttons, modal layers, toasts
src/components/shell/              ← import from "@/components/shell"
  shell.tsx                        ← DashboardShell: rail + panel + column(PageBar + scrolling PageContent) + sheet + palette
  rail.tsx, panel.tsx, panel-sheet.tsx, command-palette.tsx, account-avatar.tsx, service-glyph.tsx
  page-bar.tsx                     ← PageBar, Toolbar, SearchField, Count, BackButton, ScrollTitle, PageContent
  nav.ts                           ← services, sections, matchPath, documentTitle
  theme.ts, toast.ts, use-can-write.ts, use-sign-out.tsx, use-keyboard-shortcuts.ts
src/components/primitives/         ← import from "@/components/primitives" (one file per primitive, index.ts barrel)
src/components/route-error.tsx     ← RouteError / RouteNotFound: in the content column inside the shell, centred above it
src/components/telegram/           ← create-grant dialog and Telegram user helpers shared by the grants and user pages
src/components/ui/                 ← shadcn/Base UI building blocks (§9.3); pages compose them through the primitives
src/components/app-mark.tsx, theme-toggle.tsx ← login and onboarding only
src/lib/format.ts                  ← dates, numbers, plurals, hosts, licenses
src/router.tsx                     ← defaultErrorComponent: RouteError, defaultNotFoundComponent: RouteNotFound
src/routes/dashboard.tsx           ← renders DashboardShell; beforeLoad puts { session, roles } in the context; its
                                     notFoundComponent renders unknown /dashboard/… URLs inside the shell
src/routes/dashboard/**            ← one file route per page: loader (server functions) → page component
src/features/**                    ← pages, dialogs, server functions (*.functions.ts); features/groups holds the row
                                     actions and filters shared by the Telegram, WhatsApp and label group tables;
                                     features/web the card parts shared by projects and associations
```

Data flow: a route's `loader` calls server functions (`createServerFn`, `src/features/**/*.functions.ts`) and passes the result to the page. Pages hold UI state only (open dialogs, edit mode, query, page). Mutations follow four rules:

1. **Wrap the server function in `useServerFn(fn)`** (`@tanstack/react-start`) in the component that calls it from an event handler, so a protected function's auth redirect goes through the router. `tests/server-security.test.mjs` lists every POST server function with the file that wraps it; a new mutation needs an entry.
2. **Then `await router.invalidate({ sync: true })`** so every matched loader (including the shell's pending-reports count) has reloaded before the dialog closes or the success toast shows. Loader failures render the route error boundary; they do not mean the mutation failed. Do not offer to repeat a successful mutation because its subsequent reload failed.
3. **Optimistic UI reverts on failure** and shows the error toast (§9.4.16).
4. **Every `catch` block and `.catch(handler)` logs the caught error with `console.error(error)`** before mapping it to copy; the test suite enforces it.

Errors and not-found states need no per-route wiring: the router defaults render `RouteError` / `RouteNotFound`, inside the shell for every page route. Declare `notFoundComponent` only for a specific state (the Telegram user detail's "User not found").

`document.title` is set once, by the `/dashboard` route's `head`, from the deepest match: `documentTitle(matchPath(pathname))`. Pages do not set it, and child routes should not declare their own `head` title.

### 9.2 Shell and primitive APIs

Shell (`@/components/shell`):

- `PageBar({ left?, right?, title?, back?: { label, link }, context?, contextMono?, scrollTitleRef?, scrollTitle? })` — one per page, before `PageContent`; it renders the fixed 52px header on the server and client. Match its optional `width` to `PageContent`. `back` → deep-page template (`link` takes `Link` options, e.g. `{ to: "/dashboard/telegram/users" }` or a parent category with `params`); `title` → Overview/Account template; otherwise the section template (`left` = `Toolbar`). Below 1024px the section template's first row reads "{Service} › {Section}".
- `Toolbar({ lead?, search?: SearchFieldProps, filters?, count? })` — `lead` holds page-scoping controls before the search.
- `SearchField({ value, onChange, placeholder?, label?, inputRef?, className? })` — placeholder defaults to the section's `searchPlaceholder` in `nav.ts`; Esc clears; `/` focuses it.
- `Count({ value, total?, noun, plural?, parts? })` — pass the singular noun.
- `BackButton`, `ScrollTitle({ targetRef, title? })`.
- `PageContent({ width?: "wide" | "tree" | "record" | "settings" | "overview", children })` — the §2.4 container and `main` scroller; wrap every page body in it. The router restores its scroll position on Back/Forward and resets it on a new navigation.
- `useInShell()` — whether the caller renders inside `DashboardShell` (used by `RouteError` to pick its frame).
- The shell renders the one sr-only `h1` (the section title) on section pages; deep pages (`RecordHeader`) and Overview/Account (`PageBar title`) render their own visible `h1`.
- `appToast.{success, info, warning, error}(message)` — §5.7 durations; use it instead of raw `toast`.
- `useCanWrite(scope?: "web")`, `canWrite(roles, scope?)`.
- `useSignOut()` → `{ signOut, pending }` — shared pending state and an in-flight guard for the shell and Account; signs out, lands on `/login`, toasts "Couldn't sign out. Try again." on failure.
- `useTheme()` → `{ theme, setTheme, toggleTheme }`; `themeToggleLabel(theme)`.
- `nav.ts`: `services`, `panelServices`, `serviceById`, `matchPath`, `serviceFor`, `sectionFor`, `isDeepPage`, `documentTitle`, `DashboardPath` (every `/dashboard…` route path), `ServiceGlyph`.

Primitives (`@/components/primitives`): `DataTable` (+ `RowActions`, `TablePaginationBar`, `PAGE_SIZES`), `StatusBadge`, `Chip`, `ChipOverflow`, `CountBadge`, `LabelChip`, `LabelDot`, `GroupLabelBadges`, `labelDisplayName`/`labelKind`/`publicationName`, `PlatformGlyph`, `Unset`, `ConfirmDialog`, `FormDialog`, `InlineAlert`, `SectionHeading`, `SectionCard`, `SectionEmpty`, `KeyValueList`, `RecordHeader`, `EmptyState`, `NavCard`, `StatTile` (`value: null` renders `—`), `AvatarGroup`, `initialsOf`, `InlineEditCard`/`InlineEditRow`/`InlineEditInput`/`InlineEditTextarea` (`readOnly` for viewers without write access hides ✎, 🗑, `actions` and the `handle`; `viewHeader` puts the card actions beside the logo row so the body spans the full width), `useEditSlot`, `VisibilityToggle`, `InviteLinkButton`, `TranslationGroup`/`TranslationPanel`/`TranslationText` (§5.14), `LabelTreeSelector`, `SegmentedControl`, `Menu*`, `Combobox*`, `ColorSwatchSelect`, `FileButton`, `FieldCounter`, `IconButton`, `LoadingButton`, `Hint`, `FormField`/`fieldControl`/`checkboxControl`/`fieldHintId`, `Reveal`, `Spinner`, `useModifierKey`, `useFocusAfterRemoval`, `useOpenGeneration` (key a dialog body with it to start every opening from clean state), the skeletons (`TableSkeleton`, `CardsSkeleton`, `RecordSkeleton`, `SettingsListSkeleton`, `SkeletonRows`) and the class constants (`buttonMotion`, `floatingMotion`, `dialogMotion`, `raisedSurface`, `scrimClasses`, `dialogPanel`, `dialogFooter`, `dialogFooterButton`). `ChipOverflow` (and `GroupLabelBadges`) never wraps, so table rows stay 44px. `DataTable`'s `rowHref` may return `null` for a row with nowhere to go: that row is neither a link nor clickable. Links go through the `render` slot (`render={<Link to="/dashboard/…" />}`) or `href`. Each file's JSDoc states its props and rules.

### 9.3 `@/components/ui/*` to reuse

`button`, `input`, `textarea`, `label`, `field`, `checkbox`, `select`, `combobox`, `command`, `dialog`, `alert-dialog`, `popover`, `dropdown-menu`, `tooltip`, `toggle`, `toggle-group`, `accordion`, `collapsible`, `sheet`, `table` (`Table*` only — not `DataTableHead`, whose uppercase mono style violates §3.7), `skeleton`, `avatar`, `calendar`, `wheel-picker`, `sonner` (the one `Toaster`, mounted in `__root.tsx`), `separator`, `empty` (as the base of `EmptyState`), `badge` (as the base of `Chip`; `StatusBadge` is its own component). `card` and `alert` remain for the login and onboarding pages only; in the dashboard they are replaced by `SectionCard`/surfaces and `InlineAlert`. `breadcrumb`, `sidebar` and `pagination` were removed (the table footer replaces pagination).

### 9.4 Things a builder could get wrong

1. **Do not render an `h1` on section pages.** The shell renders the sr-only section `h1`; deep pages (`RecordHeader`) and Overview/Account (`PageBar title`) render their own and the shell renders none for them. `document.title` comes from the route.
2. **Do not reintroduce eyebrows**, uppercase labels, mono labels, breadcrumbs or page descriptions. The only descriptions are the three on the Labels page and dialog descriptions.
3. **Header bar is outside the scroller.** Structure: `div.shell > aside.rail + aside.panel + div.column > PageBar + main(overflow-y:auto)`. The `Toolbar` is rendered by the page into `PageBar.left`, not inside `main`.
4. **Services are drawn with `ServiceGlyph`**: the branded logo for Telegram, WhatsApp and Microsoft 365, lucide for the rest. Do not import the SVGs directly; do not recolor the logos.
5. **Active indicators never animate**; hover transitions list `background-color, color` explicitly. No `transition-all` anywhere (the `Button` base class has `transition-all`; override with `transition-[background-color,color,border-color,box-shadow]` in the shared button wrapper or accept it only on buttons).
6. **Weights never change on state** (hover/active/selected). Use color and background.
7. **Rows are 44px; icon buttons are 36px** (`icon-sm`). Do not use `icon-xs`/`xs` sizes in rows.
8. **Status vs category:** `StatusBadge` only for the states in §5.2; everything categorical is a `Chip` or plain text.
9. **Confirmations are `ConfirmDialog` only** — no popover deletes, no toast confirmations, no "Confirm"/"Confirm Delete" labels.
10. **Dirty-close** must be implemented in `FormDialog`, once; dialogs declare `dirty`.
11. **Tokens only.** No raw hex, no `slate-*`/`emerald-*`/`amber-*` utilities (the existing `GROUP_LABEL_COLORS` badge classes are the one exception because label colors are user data; wrap them in `LabelChip`).
12. **Light borders are alpha, dark borders are solid.** Do not use `border-white/10` in dark mode.
13. **Shadows only on floating layers**; cards and tables have none; dark mode uses rings.
14. **Theme toggle** goes through `useTheme()` (`@/components/shell`), which runs the light-bulb reveal (pass the click event so it starts from that icon; every toggle carries `data-theme-toggle`, which is how presses are recognised during a transition, when Chrome delivers them to `<html>`) and keeps `data-theme-switching` on `<html>` until it ends, suppressing transitions.
15. **Tooltips**: one `TooltipProvider` at the shell root with `delay={400}`; icon buttons always pair `aria-label` with the tooltip text.
16. **Optimistic actions** (visibility toggle, member id, project order, report resolve/dismiss) must revert on failure and show the error toast; one visibility toggle in flight at a time.
17. **Search**: deferred value, resets page to 1, `type="search"`, `/` focuses it, Esc clears when it has a value. Telegram users search strips a leading `@`.
18. **`canWrite`** gates every mutation control on every page: `useCanWrite()` (or `useCanWrite("web")` on Web and group pages) reads the roles `/dashboard` put in the route context and applies `hasWriteAdminRole`/`hasWebWriteRole` from `src/server/authorization.ts`. The server enforces the same rule; the UI only hides what would fail.
19. **Counts and dates are tabular** (`tabular-nums`) and never wrap.
20. **Reduced motion** is honored by every `motion/react` usage via `useReducedMotion()`; CSS transitions rely on the global rule in `styles.css`.
21. **Container width changes when the panel appears/disappears** (pages without a panel: Overview, Account, single-section services ↔ services with a panel): the panel slides in/out from under the rail and the content column moves with it as a transform (§6), so the reflow never animates `width`; the leaving panel is lifted out of the flow at once (`AnimatePresence mode="popLayout"`), not kept as a phantom column.
22. **`ScrollTitle`** uses an `IntersectionObserver` on the `RecordHeader` `h1` with `rootMargin: "-52px 0px 0px 0px"` against `main`; it never duplicates the title while the `h1` is visible.
