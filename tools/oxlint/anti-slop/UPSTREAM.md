# Vendored anti-slop

Source: https://github.com/dmmulroy/anti-slop
Revision: c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b
Retrieved: 2026-09-20 (copied from the PoliNetwork `aule` repository, which vendors the same revision)

Copied production `src/` and the root MIT license. Upstream test files and the optional Effect plugin are omitted. Generic rule implementation files are unchanged apart from importing the Oxlint plugin API from `vite-plus/lint/plugins`; the spacing rule's ESLint Stylistic license and provenance remain in `vendor/eslint-stylistic/`.

This replaces the `@zap-studio/oxlint/anti-slop` package, which bundled the same rules. The rules enabled in this repository are listed in the `lint` block of `vite.config.ts`. This vendored implementation is excluded from lint and formatting.
