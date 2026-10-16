# Web toolchain migration

This branch follows the Web release candidate (PR #14). It removes the vulnerable
braces / micromatch / fast-glob and postcss-selector-parser dependency chains.

## Changes

- Tailwind CSS 4 with the dedicated PostCSS plugin. Autoprefixer is no longer
  required. The empty legacy Tailwind config has no custom theme or plugins.
- Utility renames follow the Tailwind v4 upgrade guide; v3 border, placeholder,
  cursor and ring defaults are explicitly preserved where possible.
- Biome replaces the old ESLint setup and the unsupported `next lint` command.
  Recommended Biome rules are enabled, without suppressing findings. This is not
  a claim of one-to-one equivalence with Next.js ESLint rules.

## Validation on 2026-10-16

- Full npm audit: zero reported vulnerabilities.
- TypeScript: passed.
- Vitest: 107 passed; security source regression checks: 3 passed.
- Next.js production build: passed, 87 static pages.
- Biome: the follow-up quality branch resolves the original 99 errors, 160
  warnings and 19 informational findings. Recommended rules remain enabled;
  CI now also runs lint with warnings treated as failures.
- Browser visual verification is required before merging this major CSS upgrade.
- Tailwind v4 requires Safari 16.4+, Chrome 111+, Firefox 128+. Validate these
  browser requirements against the intended Web audience before rollout.

## Release gates

Keep the existing full dependency audit in CI. Do not bypass it using omit=dev,
force a downgrade of Next.js lint rules, or ignore the original advisories.
Validate CI and Vercel against the same SHA, then compare catalogue, sign-in,
payment modal and dashboards at desktop and narrow Web widths before merging.
Production OAuth, PostgreSQL credentials, MFA and DNS are separate checks.

References:
- https://tailwindcss.com/docs/upgrade-guide
- https://biomejs.dev/installation/migrate-eslint-prettier/
