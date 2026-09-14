# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault ("06-arcade-vault") — a retro/neon platform for playing arcade games in the browser and competing on points. UI copy and specs are in Spanish.

Current state (SPECs 01–11 merged):

- Visual MVP ported from the prototype in `references/templates/` (neon palette, Press Start 2P / JetBrains Mono / Courier Prime fonts, perspective grid background, scanlines, CRT bezel, tilting cards).
- Catalog of 8 games stored in Supabase (`games` table).
- Real leaderboard stored in Supabase (`scores` table); `games.best` / `games.plays` kept up to date by a DB trigger.
- 4 games with a real playable engine: **ROCAS** (Asteroids), **CAÍDA** (Tetris), **BLOQUE BUSTER** (Arkanoid), **SERPENTINA** (Snake). The other games still use the fake score simulation in the Player.
- Player CRT scales to both available width and height of the viewport.
- Auth is still mock (see Session below).

## Commands

Run from the repo root (`06-arcade-vault/`), not from `app/`:

```bash
npm run dev     # start dev server (Next.js, Turbopack default via `next dev`)
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
```

There is no test runner configured yet. Verification is `npm run lint`, `npm run build` and manual testing in the browser.

Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.local.example`).

## Styles

Usa siempre /frontend-design para diseñar frontend.

- Most styling lives in `app/globals.css` as hand-written classes ported from `references/templates/styles.css` (`btn`, `crt`, `lb-row`, `neon-cyan`, `av-*`…) and CSS variables (`--ink`, `--magenta`, `--yellow`, `--line`, `--mono`, `--pixel`…). Reuse them before adding new ones.
- Tailwind CSS v4 is available via `@tailwindcss/postcss` but used sparingly.

## Routes

| Route               | File                                                                       | Notes                                                              |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `/`                 | `app/page.tsx` → `components/home-client.tsx`                              | Landing page (SPEC 02), game preview                               |
| `/biblioteca`       | `app/biblioteca/page.tsx` → `components/biblioteca-client.tsx`             | Game grid, search, category filter                                 |
| `/juego/[id]`       | `app/juego/[id]/page.tsx`                                                  | Detail: plays, global best, top 10 scores (server-rendered)        |
| `/juego/[id]/jugar` | `app/juego/[id]/jugar/page.tsx` → `components/jugar-client.tsx`            | Player: HUD, CRT, pause/end/exit, game-over modal that saves score |
| `/salon-de-la-fama` | `app/salon-de-la-fama/page.tsx` → `components/salon-de-la-fama-client.tsx` | Per-game top 12 + "your best" rank, fetched client-side            |
| `/login`            | `app/login/page.tsx`                                                       | Mock login / sign up / guest                                       |
| `/supabase-status`  | `app/supabase-status/page.tsx`                                             | Connection check against `health_check` table (SPEC 03)            |

Shared `Nav` (`components/nav.tsx`) and footer are in `app/layout.tsx`, wrapped in `SessionProvider`.

## Architecture

- Next.js 16 App Router. The `@/*` path alias resolves to the repo root (see `tsconfig.json`).
- **Server Component + Client Component split**: each `page.tsx` is an async Server Component that loads data from Supabase and passes it as props to a `components/*-client.tsx` Client Component.
- ESLint config (`eslint.config.mjs`) extends `eslint-config-next` core-web-vitals + typescript rulesets.
- `AGENTS.md` at the repo root is auto-generated/re-added by `next dev` (see `node_modules/next/dist/server/lib/generate-agent-files.js`) — do not hand-edit its content beyond what's already there; committing it is fine, but expect `next dev` to keep recreating it if removed.

### Supabase

Project ref `ddbbdyjjsvrxzbijprwg`, also reachable through the Supabase MCP server configured in `.mcp.json`. Schema changes are applied with `mcp__supabase__apply_migration` and documented in the corresponding spec.

- `lib/supabase/server.ts` — server client (`@supabase/ssr`, cookies). `lib/supabase/client.ts` — browser client.
- `proxy.ts` — Next.js 16 proxy (formerly middleware) that refreshes the Supabase session on each request.
- `lib/supabase/games.ts` — `getGames()`, `getGame(id)`.
- `lib/supabase/scores.ts` — `getTopScores(gameId, limit)` → `ScoreRow[]`.
- Tables (all with RLS):
  - `health_check` — public read, used only by `/supabase-status`.
  - `games` (`id, title, short, long, cat, cover, color, best, plays`) — public read-only. Type `Game` in `lib/games.ts` mirrors it (`best`, `plays` are integers).
  - `scores` (`game_id` FK → `games.id`, `name` 1–10 chars, `score >= 0`, `created_at`) — public `SELECT` and `INSERT`, no `UPDATE`/`DELETE`.
  - Trigger `AFTER INSERT ON scores` sets `games.best = GREATEST(best, NEW.score)` and `games.plays = plays + 1` (SPEC 07). The app never writes `games` directly — saving a score is the only write.

### Session (mock)

`lib/session.tsx` exposes `SessionProvider` / `useSession()` with `user`, `login`, `logout`, `saveScore`.

- The user (`{ name }`) is stored in `localStorage` (`av:user:v1`) and read via `useSyncExternalStore`; no real auth or passwords.
- `saveScore({ game, score, name })` inserts a row into Supabase `scores`.

### Real game engines

Pattern shared by all real games (follow it for new ones; the `add-arcade-game` skill automates it):

1. `lib/<game>-engine.ts` — framework-agnostic TypeScript engine: `create<Game>Engine(canvas, { onUpdate })` returns a handle with `pause`, `resume`, `reset`, `forceGameOver`, `destroy`. Owns its canvas, game loop and keyboard listeners.
2. `components/<game>-canvas.tsx` — Client Component that mounts the engine in a `<canvas>`, exposes `RealGameHandle` via `useImperativeHandle` and forwards `RealGameState` (`score, lives, level, gameOver`) through `onUpdate`.
3. Register it in `REAL_GAMES` in `components/real-game-registry.tsx`, keyed by the `games.id`.

`components/jugar-client.tsx` checks `REAL_GAMES[game.id]`: if present it renders the engine and syncs the HUD/modal to its state; otherwise it runs the fake score simulation. It also sizes the CRT (4:3) from the available width and `window.innerHeight` (SPEC 11).

| Game id         | Engine                        | Source                                                     | Controls                                           |
| --------------- | ----------------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| `rocas`         | `lib/rocas-engine.ts`         | `references/started-games/02-asteroids`                    | ← → rotate, ↑ thrust, Space shoot                  |
| `caida`         | `lib/caida-engine.ts`         | `references/started-games/03-tetris`                       | ← → move, ↓ soft drop, ↑/X rotate, Space hard drop |
| `bloque-buster` | `lib/bloque-buster-engine.ts` | `references/started-games/04-arkanoid`                     | ← → paddle                                         |
| `serpentina`    | `lib/serpentina-engine.ts`    | Built from scratch; fruit sprites in `public/snake-assets` | Arrow keys                                         |

## References

- `references/templates/` — original React/CDN prototype (visual source of truth).
- `references/started-games/` — plain-JS games to port into engines.
- `references/source-assets/` — raw assets (e.g. snake sprites).
- `references/implemented_games.md` — quick-reference table (id, title, category, color, description) of the games with a real engine; consult it when you need that info instead of re-querying Supabase.
- `references/games-suggestions-todo.md` — persistent log of game candidates (pending / approved / implemented / discarded), maintained by the `game-planner` agent (see Tooling).

## Tooling

- `.claude/settings.json` — `PostToolUse` hook on `Write|Edit` runs `.claude/hooks/format-on-write.ps1` (Prettier + `eslint --fix` on `.tsx/.jsx/.md/.mdx`).
- `.claude/skills/add-arcade-game` — project skill to add a real game (engine + registry + leaderboard).
- `.claude/skills/frontend-design` — design skill (mandatory for frontend work).
- `.claude/agents/game-planner` — planning-only agent for the game catalog: decides which candidate game (new or from `references/started-games/`) best fits Arcade Vault next. It never writes app code; its only writable file is `references/games-suggestions-todo.md`, where it keeps the persistent log of pending/approved/implemented/discarded suggestions. Use it to decide what to build, then hand off to `add-arcade-game` (or a new spec) to actually build it.

## Spec Driven Design

The project follows Spec Driven Design with the `/spec` and `/spec-impl` skills from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills) (installed under `app/.claude/skills/` and `app/.agents/skills/`).

- Specs live in `specs/NN-slug.md` with Status / Depends on / Date / Objective header, scope, data model, steps, acceptance criteria and decisions.
- `specs/.spec-config.yml` — `AutoCreateBranch: true`: `/spec-impl` creates a `spec-NN-slug` branch automatically. Each spec is merged into `main` through a PR.
- Before planning or implementing a feature, read the related existing specs and create a new one with the next number.

| #   | Spec                            | Summary                                                     |
| --- | ------------------------------- | ----------------------------------------------------------- |
| 01  | `01-mvp-pantallas-visuales`     | 5 visual screens from the prototype, mock data              |
| 02  | `02-pagina-de-inicio`           | Landing page at `/`, library moved to `/biblioteca`         |
| 03  | `03-conexion-supabase`          | `@supabase/ssr` clients, proxy, `health_check`              |
| 04  | `04-motor-real-rocas`           | Real Asteroids engine in ROCAS, registry pattern            |
| 05  | `05-tabla-juegos-supabase`      | `games` table, Server/Client split                          |
| 06  | `06-leaderboard-real`           | `scores` table, real leaderboard in Detail and Hall of Fame |
| 07  | `07-estadisticas-reales-juegos` | Trigger keeps `games.best` / `games.plays` live             |
| 08  | `08-caida-tetris-motor-real`    | Real Tetris engine in CAÍDA, generic `RealGameState`        |
| 09  | `09-bloque-buster-motor-real`   | Real Arkanoid engine in BLOQUE BUSTER                       |
| 10  | `10-serpentina-motor-real`      | Snake engine built from scratch in SERPENTINA               |
| 11  | `11-crt-adaptable-a-resolucion` | Player CRT fits viewport width and height                   |
