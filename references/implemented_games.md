# Juegos implementados en Arcade Vault

Catálogo completo tal como está en la tabla `games` de Supabase (8 juegos). `best` y `plays` los mantiene actualizados un trigger en cada inserción en `scores` (ver SPEC 07).

## Con motor real (jugables de verdad)

| Juego (id)                      | Categoría | Motor                         | Controles                                               | Best | Plays |
| ------------------------------- | --------- | ----------------------------- | ------------------------------------------------------- | ---- | ----- |
| ROCAS (`rocas`)                 | SHOOTER   | `lib/rocas-engine.ts`         | ← → rotar, ↑ empuje, Espacio disparar                   | 230  | 4     |
| CAÍDA (`caida`)                 | PUZZLE    | `lib/caida-engine.ts`         | ← → mover, ↓ caída suave, ↑/X rotar, Espacio caída dura | 179  | 2     |
| BLOQUE BUSTER (`bloque-buster`) | ARCADE    | `lib/bloque-buster-engine.ts` | ← → paleta                                              | 590  | 2     |
| SERPENTINA (`serpentina`)       | ARCADE    | `lib/serpentina-engine.ts`    | Flechas de dirección                                    | 1666 | 3     |

Patrón común (ver `add-arcade-game` skill): motor en `lib/<juego>-engine.ts`, canvas en `components/<juego>-canvas.tsx`, registrado en `REAL_GAMES` (`components/real-game-registry.tsx`).

## Pendientes de motor real (usan simulación de puntuación falsa)

| Juego (id)                  | Categoría | Descripción corta                          | Best | Plays |
| --------------------------- | --------- | ------------------------------------------ | ---- | ----- |
| DUELO PIXEL (`duelo-pixel`) | VERSUS    | Dos paletas, una pelota. Reflejos máximos. | 0    | 0     |
| GLOTÓN (`gloton`)           | ARCADE    | Devora puntos y escapa de los fantasmas.   | 0    | 0     |
| INVASORES (`invasores`)     | SHOOTER   | Defiende el planeta de filas alienígenas.  | 0    | 0     |
| RANARIA (`ranaria`)         | ARCADE    | Cruza la autopista de pixeles.             | 0    | 0     |

Estos juegos aún corren la simulación de puntuación falsa en `components/jugar-client.tsx` (no tienen entrada en `REAL_GAMES`).

## Fuente de datos

Datos leídos en vivo de la tabla `games` (proyecto Supabase `ddbbdyjjsvrxzbijprwg`) el 2026-09-14. Para refrescar este archivo, volver a consultar esa tabla.
