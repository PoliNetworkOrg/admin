# People area: handoff

Everything an agent needs to build, or continue building, the People area of the dashboard.

> [!IMPORTANT]
> **Cleanup (#138).** Soci (the member register), fees and receipts, and the census are now **unconnected UI
> mockups**: their pages render static sample data from `src/features/people/mockup-data.ts`, make no backend call,
> disable every action and show a banner. Soci, fees and receipts will be rebuilt from scratch on Microsoft 365 members
> in Phase 2 (#144), the census in Phase 3 (#145). Record matching (the Linking review queue, merging, My area's "Is
> this you?", Ask to be added) and Telegram group tracking (group columns, join requests) are removed. The permissions
> `people:members:read`, `people:members:write`, `people:fees:write` and `people:receipts:sign` are gone; the mockups
> open with `people:read`. Sections below that describe these features describe the mockup or the removed design.

| File                           | What it is                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| [`brief.md`](brief.md)         | The original brief, verbatim                                                             |
| [`decisions.md`](decisions.md) | What was settled after the brief: owner decisions, navigation, per-page rules, roles     |
| [`contract.md`](contract.md)   | The `people.*` backend contract the dashboard codes against                              |
| [`fees.md`](fees.md)           | Fees and receipts as designed; now an unconnected mockup until Phase 2 (#144)            |
| [`plan.md`](plan.md)           | Phases, checklist and progress log: **start here to know what is done and what is next** |
| [`prototype/`](prototype/)     | The clickable prototype's source (structure and copy reference only)                     |

## Continuing the work

1. Read `AGENTS.md` and `docs/design.md`, then `decisions.md`, `contract.md` and `plan.md` in that order.
2. Check out branch `claude/eager-mayer-bsom7v` and read the open pull request and its latest commits.
3. Pick the first unchecked item in `plan.md`. Commit small and often; tick the box and add a progress-log line in the
   commit that finishes an item.
4. Run `PORT=1xxxx AGENT_MODE=true pnpm dev` to see the pages with sample data; set `AGENT_PERMISSIONS` and
   `AGENT_PERSON` (once phase 1 adds them) to preview restricted roles.

## The prototype has visual errors

The prototype fixes what each page shows and does, not how it measures. Its spacing, paddings, column widths and some
components are hand-made and wrong in places. Do not copy its CSS or markup: build from the repo's shell and primitives
so spacing and behaviour match the rest of the dashboard, and fix anything that looks off. See "Prototype is a
reference" in `decisions.md` for the known defects.

Prototype canvas (owner only, all pages in desktop/mobile × light/dark): <https://claude.ai/artifact/7rwGssnepqJ2nWuLvGLrjT>

Permission matrix: [`permissions.md`](permissions.md).
