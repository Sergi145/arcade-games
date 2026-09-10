# SPEC 05 — Tabla de juegos en Supabase

> **Status:** Implemented
> **Depends on:** SPEC 03
> **Date:** 2026-09-10
> **Objective:** Migrar el catálogo de los 8 juegos de `lib/games.ts` a una tabla `games` en Supabase, leída desde Server Components y pasada como prop a las pantallas cliente existentes, sin cambiar su apariencia ni comportamiento.

## Por qué existe este spec

SPEC 03 conectó Supabase solo como plomería (tabla `health_check` de prueba, sin datos de dominio). SPEC 04 dejó explícitamente fuera de alcance "cambios a los metadatos del juego `rocas` en `lib/games.ts`" y "leaderboard real ... sigue usando `seededScores`". Este spec es el primero de dos encadenados — el catálogo de juegos deja de ser un array estático y pasa a vivir en Supabase, lo cual además es un prerrequisito de esquema: la tabla de puntuaciones del spec de leaderboard (siguiente, fuera de este alcance) necesitará una FK real a `games.id`.

## Scope

**In:**

- Migración SQL que crea la tabla `games` en Supabase con las mismas columnas que el tipo `Game` actual (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`), sembrada con los 8 juegos existentes en `lib/games.ts`, con RLS habilitado y una política de solo lectura pública (mismo patrón que `health_check` de SPEC 03).
- `lib/supabase/games.ts` con `getGames(): Promise<Game[]>` (todas) y `getGame(id): Promise<Game | null>`, usando el cliente de servidor de `lib/supabase/server.ts`.
- `lib/games.ts` se recorta: se elimina el array `GAMES`, se conservan los tipos `Game`, `GameCategory`, `GameColor` y la constante `CATS`.
- `app/page.tsx` (Home) se divide en un Server Component que llama `getGames()` y un componente cliente (`components/home-client.tsx`) que recibe `games` como prop y conserva toda la interactividad actual (reveal on scroll, mini-cards, etc.).
- `app/biblioteca/page.tsx` se divide igual: Server Component que llama `getGames()`, componente cliente (`components/biblioteca-client.tsx`) que recibe `games` como prop y conserva búsqueda y filtro por categoría.
- `app/juego/[id]/page.tsx` (Detalle) pasa a usar `getGame(id)` en vez de `GAMES.find(...)` — ya es Server Component, no necesita dividirse.
- `app/juego/[id]/jugar/page.tsx` (Reproductor) se divide: Server Component que llama `getGame(id)` y hace `notFound()` si no existe, componente cliente (`components/jugar-client.tsx`) que recibe `game` como prop con toda la lógica de juego actual sin cambios.
- `app/salon-de-la-fama/page.tsx` se divide igual: Server Component que llama `getGames()`, componente cliente (`components/salon-de-la-fama-client.tsx`) que recibe `games` como prop y conserva las pestañas.

**Out of scope (para specs futuros):**

- Tabla de puntuaciones (`scores`) real y leaderboard real en Detalle/Salón de la Fama — siguen usando `seededScores`; es el spec encadenado siguiente, que dependerá de este por la FK a `games.id`.
- Valores dinámicos de `best`/`plays` calculados a partir de partidas reales — se siembran estáticos con los mismos números mock de hoy.
- Cualquier UI para crear, editar o borrar juegos — la tabla es de solo lectura desde la app.
- Cambios a `components/nav.tsx` o `components/game-card.tsx` (solo usan el tipo `Game`, no el array) ni a `lib/session.tsx`.
- Cambios a `lib/rocas-engine.ts` o a cualquier motor de juego.

## Data model

```sql
create table games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null,
  cover text not null,
  color text not null,
  best integer not null,
  plays text not null
);

alter table games enable row level security;

create policy "Public read access" on games
  for select
  to anon, authenticated
  using (true);
```

La propia migración siembra las 8 filas con los valores actuales de `lib/games.ts` (mismos `id`/`title`/etc., sin renombrar ningún slug).

```ts
// lib/supabase/games.ts
export async function getGames(): Promise<Game[]>;
export async function getGame(id: string): Promise<Game | null>;
```

`Game`, `GameCategory`, `GameColor` y `CATS` siguen viviendo en `lib/games.ts` sin cambios de forma.

## Implementation plan

1. Aplicar la migración SQL que crea `games`, siembra las 8 filas, habilita RLS y añade la política de lectura pública, vía `mcp__supabase__apply_migration`. Verificación: `mcp__supabase__list_tables` muestra `games` con 8 filas y `rls_enabled: true`.
2. Crear `lib/supabase/games.ts` con `getGames()` y `getGame(id)`, usando el cliente de servidor. Verificación: se importa sin errores de tipos (aún no se usa desde ninguna página).
3. Recortar `lib/games.ts`: eliminar el array `GAMES`, conservar `Game`, `GameCategory`, `GameColor`, `CATS`. Verificación: el build falla temporalmente en los 6 archivos que importaban `GAMES` (esperado, se resuelve en los pasos siguientes).
4. Adaptar `app/juego/[id]/page.tsx` (Detalle) para usar `getGame(id)` en vez de `GAMES.find(...)`. Verificación: `/juego/rocas` muestra el mismo contenido que antes; `/juego/no-existe` sigue devolviendo 404.
5. Dividir `app/biblioteca/page.tsx` en Server Component + `components/biblioteca-client.tsx`. Verificación: `/biblioteca` muestra la misma grid, búsqueda y filtro por categoría que antes.
6. Dividir `app/page.tsx` (Home) en Server Component + `components/home-client.tsx`. Verificación: `/` muestra las mismas 7 secciones, incluida la preview de 6 juegos.
7. Dividir `app/juego/[id]/jugar/page.tsx` (Reproductor) en Server Component + `components/jugar-client.tsx`. Verificación: `/juego/rocas/jugar` sigue funcionando igual (motor real incluido) y `/juego/serpentina/jugar` sigue mostrando la simulación falsa.
8. Dividir `app/salon-de-la-fama/page.tsx` en Server Component + `components/salon-de-la-fama-client.tsx`. Verificación: `/salon-de-la-fama` muestra las mismas pestañas y contenido que antes.
9. Ejecutar `npm run lint` y `npm run build`, y recorrer manualmente las 5 pantallas afectadas. Verificación: ambos comandos terminan sin errores y no hay diferencia visual ni de comportamiento frente al estado previo al spec.

## Acceptance criteria

- [x] La tabla `games` existe en Supabase con 8 filas, RLS habilitado y una política de solo lectura pública.
- [x] `lib/games.ts` ya no exporta `GAMES`; sigue exportando `Game`, `GameCategory`, `GameColor` y `CATS`.
- [x] `/`, `/biblioteca`, `/juego/[id]`, `/juego/[id]/jugar` y `/salon-de-la-fama` obtienen los datos de juego desde Supabase (vía `getGames()`/`getGame()`) y se ven y funcionan exactamente igual que antes del spec.
- [x] `/juego/no-existe` sigue devolviendo 404.
- [x] La búsqueda y el filtro por categoría en `/biblioteca` siguen funcionando igual que antes.
- [x] El motor real de `rocas` en `/juego/rocas/jugar` sigue funcionando sin cambios.
- [x] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** dividir este trabajo en dos specs encadenados (este + un spec futuro de leaderboard real que dependerá de este) en vez de uno combinado — decidido explícitamente en la fase de preguntas; evita mezclar dos modelos de datos y dos políticas de RLS distintas en un solo plan.
- **Sí:** patrón Server Component padre + componente cliente que recibe `games`/`game` como prop, en vez de fetch en cliente vía `useEffect` — decidido explícitamente; evita estados de carga nuevos en 4 pantallas y sigue el mismo patrón que `app/supabase-status/page.tsx` de SPEC 03.
- **Sí:** `best` y `plays` se siembran estáticos con los valores mock actuales, no calculados desde partidas reales — decidido explícitamente; calcularlos de verdad depende de la tabla de puntuaciones del spec siguiente, y hacerlo ahora crearía una dependencia circular entre los dos specs.
- **Sí:** `lib/games.ts` conserva los tipos (`Game`, `GameCategory`, `GameColor`, `CATS`) y solo pierde el array `GAMES` — decidido explícitamente; minimiza el churn de imports en los 6 archivos que ya importan tipos de ese módulo.
- **No:** política de escritura (insert/update/delete) en `games` — decidido explícitamente; no existe ningún flujo en el producto que cree o edite juegos, así que no hace falta esa superficie.
- **No:** tabla de puntuaciones o leaderboard real en este spec — es el spec siguiente, con su propia FK a `games.id`.

## Risks

| Riesgo                                                                                                                                          | Mitigación                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dividir 4 páginas cliente en Server + Client component puede introducir un mismatch si el componente cliente asume que `games` nunca está vacío | El shape de datos (`Game[]`) no cambia respecto al array estático, solo su origen; el paso 9 incluye una pasada manual por las 5 pantallas afectadas.                                                              |
| Si la consulta a Supabase falla (red, credenciales), las páginas migradas romperían donde antes nunca fallaban                                  | Aceptado para este spec, sin manejo de error visible nuevo — mismo nivel de robustez que `health_check` en SPEC 03 (sin retry); un spec futuro puede añadir estados de error si se vuelve un problema real en uso. |

## What is **not** in this spec

- Tabla de puntuaciones (`scores`) ni leaderboard real — sigue en `seededScores` hasta el spec siguiente.
- `best`/`plays` calculados desde partidas reales.
- Cualquier UI de administración de juegos.
- Cambios a `lib/session.tsx`, `components/nav.tsx` o al motor de `rocas`.

Cada uno de estos, si se implementa, va en su propio spec.
