# Sugerencias de juegos — Arcade Vault

Registro vivo de recomendaciones del agente `@game-planner` para el próximo
juego a añadir al catálogo. Se actualiza cada vez que el agente propone algo
nuevo; no se borra el historial, solo se mueven las entradas de sección según
su estado.

Leyenda de estado: `Pendiente` (aún no se decide) → `Aprobada` (se decide
construirla) → `Implementada` (ya tiene motor real y está en
`references/implemented_games.md`) / `Descartada` (se decide no hacerla, con
motivo).

## Pendientes

### [2026-09-14] INVASORES — SHOOTER / green

**Recomendación principal**: darle motor real a `invasores` (ya existe en el
catálogo de Supabase, categoría `SHOOTER`, color `green`, sin engine — hoy usa
la simulación falsa del Player). Un clon tipo Space Invaders encaja de forma
natural: oleada de enemigos, nave que dispara, estado reducible a
`{ score, lives, level, gameOver }`, controles de solo teclado
(izquierda/derecha + disparo). No hay fuente en `references/started-games/`
para portar, pero es viable construirlo desde cero siguiendo el precedente de
`serpentina` (SPEC 10) y reutilizando patrones de colisión/disparo ya
resueltos en `lib/rocas-engine.ts`. Refuerza `SHOOTER` (pasaría de 2 a 3
juegos) sin saturar más `ARCADE`, que ya tiene 4 de los 8 juegos del catálogo
(`bloque-buster`, `serpentina`, `gloton`, `ranaria`).

**Alternativas consideradas**:

- `RANARIA` (ARCADE, green) — mecánica de cruce por carriles, feasible, pero
  ARCADE es la categoría más saturada del catálogo (4/8); no ayuda al balance.
- `GLOTÓN` (ARCADE, yellow) — tipo Pac-Man; motor viable pero más complejo
  (IA de fantasmas, grid de pellets) que Invasores para el mismo beneficio de
  categoría (ARCADE, ya saturada).
- `DUELO PIXEL` (VERSUS, cyan) — único juego en la categoría VERSUS (mayor
  hueco real), pero de mayor riesgo: un juego de versus/lucha no encaja de
  forma nativa en el modelo de `scores` (una sola puntuación numérica por
  partida, leaderboard pensado para runs en solitario). Se deja pendiente de
  una evaluación aparte antes de comprometerse.

**Riesgos**: ninguno bloqueante para Invasores; es el candidato de menor
fricción técnica. El riesgo real está en `duelo-pixel` (arriba) si se retoma
más adelante.

**Siguiente paso**: no hace falta spec nueva — es un port/build de motor real
dentro del patrón ya cubierto por SPEC 04/08/09/10. Se puede invocar el skill
`add-arcade-game` directamente cuando se decida construirlo.

## Aprobadas / en construcción

_(sin entradas todavía)_

## Implementadas

_(sin entradas todavía)_

## Descartadas

_(sin entradas todavía)_
