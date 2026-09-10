# SPEC 06 — Leaderboard real

> **Status:** Implemented
> **Depends on:** SPEC 03, SPEC 05
> **Date:** 2026-09-10
> **Objective:** Sustituir el leaderboard mock (`seededScores`) del Detalle y del Salón de la Fama por una tabla `scores` real en Supabase, alimentada por las puntuaciones que los jugadores guardan al terminar una partida en cualquiera de los 8 juegos.

## Por qué existe este spec

SPEC 05 migró el catálogo de juegos a Supabase precisamente para dejar lista la FK que necesita este spec. SPEC 04 dejó explícito que "Leaderboard real en la página de Detalle o en el Salón de la Fama — ambos siguen usando `seededScores`" quedaba fuera de su alcance. La sesión sigue siendo mock (sin Supabase Auth, ver SPEC 03), así que este spec trata la identidad del jugador como un nombre libre, igual que ya lo hacía `lib/session.tsx` al guardar en `localStorage`.

## Scope

**In:**

- Migración SQL que crea la tabla `scores` en Supabase (`game_id` con FK a `games.id`, `name`, `score`, `created_at`), con `CHECK` constraints (`score >= 0`, `name` entre 1 y 10 caracteres), RLS habilitado, política de `SELECT` pública y política de `INSERT` pública — sin `UPDATE` ni `DELETE`.
- `lib/scores.ts` se recorta: se elimina `seededScores` y el array `PLAYERS`, se conserva solo el tipo `ScoreRow`.
- `lib/supabase/scores.ts`: `getTopScores(gameId: string, limit: number): Promise<ScoreRow[]>`, usando el cliente de servidor, para el Detalle.
- `app/juego/[id]/page.tsx` (Detalle): usa `getTopScores(id, 10)` en vez de `seededScores`, con un estado vacío ("AÚN NO HAY PUNTUACIONES") cuando el juego no tiene puntuaciones reales todavía.
- `lib/session.tsx`: `saveScore` pasa a ser `async` y hace `insert` en la tabla `scores` vía el cliente de navegador (`lib/supabase/client.ts`), en vez de escribir en `localStorage`. Se elimina `appendSavedScore` y la clave `av:scores:v1`.
- `app/juego/[id]/jugar/page.tsx`: el botón "GUARDAR PUNTUACIÓN" espera (`await`) el resultado de `saveScore(...)`; si falla, muestra un mensaje de error en vez de marcar la puntuación como guardada.
- `components/salon-de-la-fama-client.tsx` (de SPEC 05): al montar y en cada cambio de pestaña, consulta las 12 mejores puntuaciones del juego activo vía el cliente de navegador, con un estado de carga simple mientras llega la respuesta y "AÚN NO HAY PUNTUACIONES" si no hay ninguna. El podio oculta los puestos sin datos cuando hay menos de 3 puntuaciones reales. Con sesión iniciada, se consulta aparte la mejor puntuación cuyo `name` coincide (sin distinguir mayúsculas) con `user.name` para ese juego; la fila "TU MEJOR MARCA" solo se muestra si hay coincidencia.

**Out of scope (para specs futuros):**

- Supabase Auth real o cualquier identidad de jugador más allá de un nombre libre — la fila "TU MEJOR MARCA" puede no encontrar coincidencia si dos jugadores usan el mismo nombre; se acepta como limitación conocida.
- Migrar las puntuaciones que ya existan en `av:scores:v1` (localStorage) de navegadores de prueba — la tabla `scores` arranca vacía.
- Anti-abuso o anti-cheat más allá de los `CHECK` constraints básicos (score no negativo, nombre no vacío) — cualquiera puede insertar una puntuación con la clave pública, igual que cualquier tabla con `INSERT` público en Supabase.
- El ticker "Actividad en Vivo" y "Top Jugadores · Hoy" de la Home (`app/page.tsx`) — SPEC 02 ya decidió que son arrays estáticos sin conexión a datos reales; este spec no los toca.
- `best`/`plays` calculados dinámicamente en la tabla `games` a partir de `scores` — sigue siendo una idea para un spec futuro, no parte de este.
- Cambios a `lib/games.ts`, a la tabla `games` o al motor de `rocas`.

## Data model

```sql
create table scores (
  id bigint generated always as identity primary key,
  game_id text not null references games(id),
  name text not null,
  score integer not null,
  created_at timestamptz not null default now(),
  constraint scores_score_nonnegative check (score >= 0),
  constraint scores_name_length check (char_length(name) between 1 and 10)
);

alter table scores enable row level security;

create policy "Public read access" on scores
  for select
  to anon, authenticated
  using (true);

create policy "Public insert access" on scores
  for insert
  to anon, authenticated
  with check (true);
```

`ScoreRow` (conservado en `lib/scores.ts`, sin cambios de forma):

```ts
export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
};
```

`getTopScores` mapea las filas de `scores` (ordenadas por `score desc`, limitadas a `limit`) a `ScoreRow[]`, calculando `rank` por posición y `date` a partir de `created_at`. El mismo mapeo se replica en `components/salon-de-la-fama-client.tsx` para la consulta hecha con el cliente de navegador.

## Implementation plan

1. Aplicar la migración SQL que crea `scores` con la FK a `games`, los `CHECK` constraints, RLS habilitado y las políticas de `SELECT`/`INSERT` públicas, vía `mcp__supabase__apply_migration`. Verificación: `mcp__supabase__list_tables` muestra `scores` con `rls_enabled: true`, 0 filas y la FK a `games`.
2. Recortar `lib/scores.ts`: eliminar `seededScores` y `PLAYERS`, conservar solo `ScoreRow`. Verificación: el build falla temporalmente en los 2 archivos que usaban `seededScores` (esperado, se resuelve en los pasos siguientes).
3. Crear `lib/supabase/scores.ts` con `getTopScores(gameId, limit)` usando el cliente de servidor. Verificación: se importa sin errores de tipos.
4. Actualizar `app/juego/[id]/page.tsx` (Detalle) para usar `getTopScores(id, 10)`, con el estado vacío "AÚN NO HAY PUNTUACIONES" cuando el array está vacío. Verificación: `/juego/rocas` muestra el leaderboard real (vacío al principio), sin datos mock.
5. Reescribir `saveScore` en `lib/session.tsx` como función `async` que hace `insert` en `scores` vía `lib/supabase/client.ts` con `{ game_id: entry.game, name: entry.name, score: entry.score }`; eliminar `appendSavedScore` y `av:scores:v1`. Verificación: el build compila; `useSession().saveScore` ahora devuelve una `Promise`.
6. Actualizar `app/juego/[id]/jugar/page.tsx`: el botón "GUARDAR PUNTUACIÓN" hace `await saveScore(...)` antes de marcar `saved=true`; en caso de error, muestra un mensaje simple en vez del toast de guardado. Verificación: guardar una puntuación real en `/juego/rocas/jugar` persiste una fila en `scores` (comprobable con `mcp__supabase__execute_sql` o recargando `/juego/rocas`).
7. Actualizar `components/salon-de-la-fama-client.tsx`: consulta las 12 mejores puntuaciones del juego activo al montar y en cada cambio de pestaña, con estado de carga y estado vacío, podio que oculta puestos sin datos, y consulta aparte de la mejor puntuación del usuario de sesión por coincidencia de nombre para "TU MEJOR MARCA". Verificación: `/salon-de-la-fama` muestra puntuaciones reales por pestaña, con los estados vacíos correctos.
8. Ejecutar `npm run lint` y `npm run build`, y probar manualmente: guardar varias puntuaciones reales en `rocas` y en al menos otro juego con simulación falsa, confirmar que aparecen en `/juego/[id]` y en `/salon-de-la-fama`, y que un juego sin puntuaciones muestra el estado vacío. Verificación: los criterios de aceptación siguientes se cumplen y ambos comandos terminan sin errores.

## Acceptance criteria

- [x] La tabla `scores` existe en Supabase con FK a `games(id)`, RLS habilitado, política de `SELECT` pública y política de `INSERT` pública con los `CHECK` constraints (`score >= 0`, `name` entre 1 y 10 caracteres).
- [x] `lib/scores.ts` ya no exporta `seededScores` ni `PLAYERS`; sigue exportando `ScoreRow`.
- [x] Guardar una puntuación desde el modal de fin de partida, en `rocas` o en cualquiera de los otros 7 juegos, inserta una fila real en `scores`.
- [x] `/juego/[id]` muestra hasta 10 puntuaciones reales del juego, ordenadas de mayor a menor, obtenidas de Supabase.
- [x] Un juego sin puntuaciones guardadas muestra "AÚN NO HAY PUNTUACIONES" en vez de una tabla vacía o de datos mock.
- [x] `/salon-de-la-fama` muestra hasta 12 puntuaciones reales por pestaña de juego, y se actualiza al cambiar de pestaña.
- [x] El podio de `/salon-de-la-fama` oculta los puestos sin datos cuando hay menos de 3 puntuaciones reales para el juego activo.
- [x] Con sesión iniciada, la fila "TU MEJOR MARCA" solo aparece si existe al menos una puntuación guardada con un nombre que coincide (sin distinguir mayúsculas) con el nombre de sesión, para el juego activo.
- [x] Si el `insert` en Supabase falla al guardar una puntuación, el modal muestra un mensaje de error en vez de marcar la puntuación como guardada.
- [x] `lib/games.ts`, la tabla `games` y el motor de `rocas` no cambian en este spec.
- [x] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** identidad de jugador = nombre libre en cada fila de `scores`, sin Supabase Auth real — decidido explícitamente; consistente con que SPEC 03 dejó Auth real fuera de alcance, y con el input de nombre que ya existía en el modal de fin de partida.
- **Sí:** los 8 juegos pueden guardar puntuaciones reales, incluidos los 7 que aún usan la simulación falsa — decidido explícitamente; el leaderboard refleja lo que el jugador guardó, aunque el motor detrás siga siendo mock hasta que cada uno tenga su spec de motor real (ver SPEC 04).
- **Sí:** `INSERT` público con `CHECK` constraints básicos (`score >= 0`, nombre 1–10 caracteres) en vez de sin restricciones — decidido explícitamente; barato de añadir y evita basura obvia, sin pretender ser anti-cheat.
- **Sí:** `saveScore` escribe solo en Supabase, eliminando `av:scores:v1` de `localStorage` — decidido explícitamente; SPEC 01 ya había decidido no leerlo nunca para leaderboards, así que mantenerlo sería una fuente muerta.
- **No:** migrar `av:scores:v1` existente a la tabla nueva — decidido explícitamente; vive por navegador/dispositivo, no es accesible desde una migración SQL de servidor, y son datos de prueba sin valor real.
- **No:** sembrar `scores` con datos de ejemplo — decidido explícitamente; la tabla arranca vacía y se llena con partidas reales, evitando mezclar datos falsos permanentes en una tabla que se supone real.
- **Sí:** mostrar "AÚN NO HAY PUNTUACIONES" en vez de rellenar con `seededScores` cuando un juego no tiene puntuaciones reales — decidido explícitamente; rellenar con mock contradice la idea de que el leaderboard ya es real.
- **Sí:** el podio oculta los puestos sin datos en vez de mostrar un placeholder "—" — decidido explícitamente.
- **Sí:** "TU MEJOR MARCA" se calcula buscando la mejor puntuación cuyo `name` coincide con el de sesión, y se oculta si no hay coincidencia, en vez de mantener el heurístico actual (`rows[5]?.score - 2400`) — decidido explícitamente; ese heurístico ya no tiene sentido con datos reales.
- **Sí:** el Salón de la Fama consulta Supabase desde el cliente (`lib/supabase/client.ts`) al cambiar de pestaña, en vez de convertir la pestaña en un query param con re-fetch en el servidor — decidido explícitamente; mantiene el toggle de pestañas instantáneo sin entrar en el historial de navegación, y la tabla `scores` ya tiene `SELECT` público.
- **Sí:** "GUARDAR PUNTUACIÓN" espera (`await`) el `insert` real y solo confirma en caso de éxito, mostrando un error simple si falla — a diferencia de la escritura síncrona a `localStorage` de antes, un `insert` de red puede fallar, y mostrar "guardado" sin que la fila exista realmente desincronizaría lo que el jugador ve del leaderboard real.

## Risks

| Riesgo                                                                                                                     | Mitigación                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INSERT` público sin autenticación permite a cualquiera guardar puntuaciones falsas o con nombre suplantado                | Aceptado para este spec, igual que la falta de Auth real ya aceptada en SPEC 03; un spec futuro de Auth real podría cerrar esta puerta exigiendo sesión para escribir.          |
| El Salón de la Fama consulta Supabase directamente desde el navegador con la clave pública                                 | Aceptado: `scores` solo tiene `SELECT`/`INSERT` públicos por diseño de este spec, sin datos sensibles; es el mismo nivel de exposición que cualquier tabla pública en Supabase. |
| Dos consultas independientes en el Salón de la Fama (top 12 + mejor marca del usuario) pueden llegar en momentos distintos | Aceptado: cada una actualiza su propia parte de la UI de forma independiente, sin un loading unificado más allá del descrito en el paso 7 del plan.                             |

## What is **not** in this spec

- Supabase Auth real o cualquier identidad de jugador más allá de un nombre libre.
- Migración de `av:scores:v1` existente en `localStorage`.
- Anti-abuso o anti-cheat más allá de los `CHECK` constraints básicos.
- El ticker "Actividad en Vivo" y "Top Jugadores · Hoy" de la Home.
- `best`/`plays` calculados dinámicamente a partir de `scores`.

Cada uno de estos, si se implementa, va en su propio spec.
