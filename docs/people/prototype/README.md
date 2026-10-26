# Prototype source

`prototype.dc.html` and `prototype.css` are the clickable prototype from the Design canvas
(<https://claude.ai/artifact/7rwGssnepqJ2nWuLvGLrjT>). They run only inside that canvas (they need its `support.js`
runtime), so read them as reference:

- `buildData()` in the script is the sample-data generator to port to `src/features/people/people.fixtures.server.ts`
  (same seed, names, courses, groups, distributions and key people such as Giulia Rossi `P-0142`, Davide Russo
  `P-0098`, Sara Galli `P-0034`, Matteo Conti `P-0115`).
- `VIEWS` shows what each role sees; `page*()` methods list each page's columns, filters, actions and copy; `dlgView()`
  holds every dialog's copy and validation messages; `importView()` the import wizard.
- `prototype.css` is **not** to be ported: it is a stand-in for the repo's components and contains spacing errors.

These files are excluded from `pnpm check` (see `vite.config.ts`).
