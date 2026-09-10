# SPEC 07 — Mejor global y número de partidas en vivo

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-09-10
> **Objective:** Hacer que `games.best` y `games.plays` se actualicen automáticamente a partir de las puntuaciones reales guardadas en `scores`, en vez de quedarse fijos en los valores mock sembrados por SPEC 05.

## Por qué existe este spec

SPEC 05 sembró `games.best`/`games.plays` con valores mock estáticos y dejó explícito que calcularlos dinámicamente desde `scores` era "una idea para un spec futuro". SPEC 06 ya escribe puntuaciones reales en `scores` en los 8 juegos, pero `games.best`/`games.plays` nunca se tocan después de esa siembra — hoy `rocas` tiene una puntuación real de 210 pero sigue mostrando "Mejor global: 41.200" y "Partidas: 15.6K", ambos mock. Este spec cierra ese hueco.

## Scope

**In:**

- Migración SQL que altera `games.plays` de `text` a `integer`, resetea `best=0`/`plays=0` en los 8 juegos, recalcula ambos valores a partir de las filas que ya existan hoy en `scores` (hoy solo `rocas` tiene una, con `score=210`), y crea una función + trigger `AFTER INSERT ON scores` que actualiza `games.best = GREATEST(games.best, NEW.score)` y `games.plays = games.plays + 1` para el `game_id` correspondiente.
- `lib/games.ts`: el tipo `Game.plays` cambia de `string` a `number`.
- `app/juego/[id]/page.tsx`: el stat-strip muestra `game.plays.toLocaleString("es-ES")` en vez de `game.plays` directo.

**Out of scope (para specs futuros):**

- Cambiar cómo se guarda una puntuación (`saveScore` en `lib/session.tsx`) — sigue igual; solo se añade el trigger en la base de datos que reacciona a esos inserts.
- Contar "partidas" que no terminan en una puntuación guardada (ej. abrir el reproductor y cerrarlo sin guardar) — `plays` sigue siendo un proxy de "puntuaciones guardadas", igual que ya lo era como número mock sin relación con partidas reales.
- El Salón de la Fama (`components/salon-de-la-fama-client.tsx`) — ya calcula su propio top real y "tu mejor marca" directamente desde `scores` desde SPEC 06; no lee `games.best`/`games.plays` y no se toca en este spec.
- `components/game-card.tsx` — no necesita cambios de código: ya renderiza `game.best.toLocaleString(...)`, que seguía siendo `number`; solo el dato subyacente en `games` cambia.
- Cualquier UI de administración para editar `best`/`plays` a mano.
- Manejar `UPDATE`/`DELETE` sobre `scores` en el trigger — hoy esas operaciones no existen (SPEC 06 solo habilita `SELECT`/`INSERT`).

## Data model

```sql
alter table games alter column plays type integer using 0;

update games set best = 0, plays = 0;

update games g
set best = s.best_score,
    plays = s.play_count
from (
  select game_id, max(score) as best_score, count(*) as play_count
  from scores
  group by game_id
) s
where g.id = s.game_id;

create or replace function bump_game_stats()
returns trigger as $$
begin
  update games
  set best = greatest(best, new.score),
      plays = plays + 1
  where id = new.game_id;
  return new;
end;
$$ language plpgsql;

create trigger scores_after_insert
after insert on scores
for each row execute function bump_game_stats();
```

`Game.plays` (en `lib/games.ts`) cambia de `string` a `number`; el resto del tipo no cambia:

```ts
export type Game = {
  // ...
  best: number;
  plays: number; // antes: string (ej. "15.6K")
};
```

## Implementation plan

1. Aplicar la migración SQL de la sección anterior vía `mcp__supabase__apply_migration`: altera `games.plays` a `integer`, resetea `best`/`plays` a 0, recalcula ambos desde las filas reales existentes en `scores`, y crea la función y el trigger. Verificación: `mcp__supabase__execute_sql` muestra `games.plays` como `integer`, `rocas` con `best=210` y `plays=1`, y el resto de los 7 juegos con `best=0` y `plays=0`.
2. Actualizar `Game.plays: string` → `Game.plays: number` en `lib/games.ts`. Verificación: el build falla temporalmente en el único sitio que asumía que `plays` era string (se resuelve en el paso siguiente).
3. Actualizar `app/juego/[id]/page.tsx` para renderizar `game.plays.toLocaleString("es-ES")` en vez de `game.plays` directo. Verificación: el build compila.
4. Probar manualmente: guardar una puntuación en `/juego/rocas/jugar` que supere 210, recargar `/juego/rocas` y comprobar que "Mejor global" y "Partidas" suben; recargar `/` y `/biblioteca` y comprobar que la card de `rocas` muestra el nuevo "MEJOR PUNTUACIÓN". Guardar una puntuación en un juego que estaba en `best=0`/`plays=0` (ej. `serpentina`) y comprobar que pasa a `best`=esa puntuación, `plays=1`.
5. Ejecutar `npm run lint` y `npm run build`. Verificación: ambos terminan sin errores.

## Acceptance criteria

- [ ] `games.plays` es `integer` en Supabase (ya no `text`).
- [ ] Tras la migración, los 7 juegos sin puntuaciones reales muestran `best=0` y `plays=0`; `rocas` muestra `best=210` y `plays=1` (su única puntuación real existente antes de este spec).
- [ ] Guardar una puntuación nueva desde el modal de fin de partida incrementa `games.plays` en 1 para ese juego, vía el trigger de base de datos, sin que `lib/session.tsx` lo haga explícitamente.
- [ ] Guardar una puntuación mayor que el `games.best` actual de ese juego lo actualiza a la puntuación nueva; guardar una puntuación menor no lo reduce.
- [ ] El stat-strip de `/juego/[id]` ("Partidas" y "Mejor global") refleja los valores reales de `games` tras recargar la página.
- [ ] El badge "MEJOR PUNTUACIÓN" de `GameCard`, en Home y en Biblioteca, refleja el `best` real tras recargar la página.
- [ ] `Game.plays` es `number` en `lib/games.ts`.
- [ ] `/salon-de-la-fama` no cambia de comportamiento (sigue calculando sus propios datos desde `scores`, no desde `games`).
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** mantener `best`/`plays` como columnas en `games`, actualizadas por un trigger `AFTER INSERT ON scores`, en vez de calcularlas en cada lectura desde `lib/supabase/games.ts` — decidido explícitamente; `getGames()`/`getGame()` no cambian, y Home/Biblioteca no pagan una query de agregación extra en cada carga.
- **Sí:** resetear `best=0`/`plays=0` en los 8 juegos como parte de la migración, y recalcularlos después a partir de las filas que ya existan en `scores` — decidido explícitamente; sin el reset, el mock sembrado en SPEC 05 (ej. `best=41200` en `rocas`) nunca sería superado por datos reales y parecería "real" para siempre; sin el recálculo posterior, se perdería la única puntuación real que ya existe (`rocas`=210).
- **Sí:** `games.plays` pasa de `text` a `integer`, formateado solo en la UI si hace falta — decidido explícitamente; el trigger queda en un simple `plays = plays + 1` sin parsear ni reformatear un string tipo "15.6K" en SQL.
- **Sí:** el trigger usa `GREATEST(games.best, NEW.score)` en vez de recalcular el máximo desde cero en cada insert — decidido explícitamente; `scores` solo permite `INSERT` (sin `UPDATE`/`DELETE`, per SPEC 06), así que el máximo acumulado nunca necesita recalcularse desde el histórico completo.
- **Sí:** GameCard (Home y Biblioteca) y el stat-strip del Detalle pasan a mostrar los valores reales; el Salón de la Fama no se toca — decidido explícitamente; ya calcula sus propios datos reales desde `scores` desde SPEC 06 y no depende de `games.best`/`games.plays`.
- **No:** contar "partidas" que no terminan en una puntuación guardada — decidido explícitamente; no existe hoy ningún tracking de sesiones de juego sin guardar, así que `plays` sigue siendo un proxy de "puntuaciones guardadas", igual que ya lo era como número mock sin relación con partidas reales.
- **No:** UI de administración para editar `best`/`plays` a mano — fuera de alcance, no hay ningún flujo de admin en el producto.

## Risks

| Riesgo                                                                                                                                                                                     | Mitigación                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Un trigger en base de datos es lógica de negocio invisible desde el código de la app — alguien que lea solo `lib/session.tsx` no verá que guardar una puntuación también actualiza `games` | Documentado explícitamente en este spec; el trigger vive en la migración SQL, versionada igual que cualquier otro cambio de esquema. |
| Si en el futuro se permiten `UPDATE`/`DELETE` sobre `scores` (hoy prohibidos por RLS, SPEC 06), el trigger actual no los reflejaría — solo suma en `INSERT`                                | Aceptado para este spec; si se abre esa puerta, ese spec futuro deberá ampliar el trigger para manejar `UPDATE`/`DELETE` también.    |

## What is **not** in this spec

- Cambios a `saveScore` en `lib/session.tsx` ni al flujo de guardado de puntuaciones.
- Tracking de partidas que no terminan en una puntuación guardada.
- Cambios al Salón de la Fama.
- UI de administración para editar `best`/`plays`.
- Manejo de `UPDATE`/`DELETE` sobre `scores` en el trigger.

Cada uno de estos, si se implementa, va en su propio spec.
