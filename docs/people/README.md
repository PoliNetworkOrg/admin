# People area: handoff

Everything an agent needs to build, or continue building, the People area of the dashboard.

| File                           | What it is                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| [`brief.md`](brief.md)         | The original brief, verbatim                                                             |
| [`decisions.md`](decisions.md) | What was settled after the brief: owner decisions, navigation, per-page rules, roles     |
| [`contract.md`](contract.md)   | The `people.*` backend contract the dashboard codes against                              |
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
