# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault ("06-arcade-vault") — a planned platform for playing games online and competing on points. The repo is currently a fresh `create-next-app` scaffold with no app-specific code yet: `app/page.tsx` and `app/layout.tsx` are still the default template.

## Commands

Run from the repo root (`06-arcade-vault/`), not from `app/`:

```bash
npm run dev     # start dev server (Next.js, Turbopack default via `next dev`)
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
```

There is no test runner configured yet.

## Architecture

- Next.js 16 App Router. Routes/layouts live under `app/`; the `@/*` path alias resolves to the repo root (see `tsconfig.json`).
- Styling is Tailwind CSS v4 via `@tailwindcss/postcss` (see `postcss.config.mjs`), with global styles in `app/globals.css`.
- ESLint config (`eslint.config.mjs`) extends `eslint-config-next` core-web-vitals + typescript rulesets.
- `AGENTS.md` at the repo root is auto-generated/re-added by `next dev` (see `node_modules/next/dist/server/lib/generate-agent-files.js`) — do not hand-edit its content beyond what's already there; committing it is fine, but expect `next dev` to keep recreating it if removed.

## Spec Driven Design

This project intends to follow Spec Driven Design using the `/spec` and `/spec-impl` skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills), installed via:

```bash
npx skills@latest add Klerith/fernando-skills
```

These skills are not yet installed in this repo (no `.claude/skills` present). If asked to plan or implement a feature, check whether they've been added since this file was written before falling back to ad-hoc planning.
