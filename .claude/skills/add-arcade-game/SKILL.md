---
name: add-arcade-game
description: Añade un juego jugable de verdad a Arcade Vault (motor real + registro + leaderboard), porteando un juego de references/started-games/ o construyéndolo desde cero. Úsalo cuando el usuario pida "añade el juego X", "integra tetris/arkanoid/...", "dale motor real a <juego>" o "conecta este juego al leaderboard".
---

# Añadir un juego a Arcade Vault

Este skill documenta el pipeline concreto de este repo para que un juego pase de
"simulación falsa" o "carpeta suelta en `references/started-games/`" a un juego
jugable de verdad, con su leaderboard en `/juego/<id>` y `/salon-de-la-fama`
funcionando sin tocar nada de esas pantallas.

## Lo que ya es gratis (no lo reconstruyas)

El leaderboard es **genérico por `game_id`** desde SPEC 06/07. En cuanto tu
juego reporte su estado (`score`, `lives`, `level`, `gameOver`) a través del
contrato descrito abajo, lo siguiente funciona sin cambios:

- `lib/session.tsx` → `saveScore()` inserta en `scores` (Supabase) — ya genérico.
- `lib/supabase/scores.ts` → `getTopScores(gameId, limit)` para el Detalle.
- `components/salon-de-la-fama-client.tsx` → top 12, podio, "TU MEJOR MARCA".
- El trigger SQL `bump_game_stats()` (SPEC 07) actualiza `games.best`/`games.plays`
  solo con el `INSERT` en `scores`.
- El HUD de `components/jugar-client.tsx` (puntuación, vidas, nivel, pausa, modal
  de fin de partida, input de nombre con `.slice(0, 10)` que respeta el
  `CHECK (char_length(name) between 1 and 10)` de la tabla `scores`).

**Lo único que construyes por juego nuevo es el motor y su wrapper React.** No
toques `app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx`,
`components/salon-de-la-fama-client.tsx`, `components/game-card.tsx` ni
`lib/session.tsx` a menos que el paso 0 diga lo contrario.

## Paso 0 (verificar siempre, ejecutar una sola vez en el repo): generalizar el tipo de estado del motor

Hoy solo existe un motor real (`rocas`), y el tipado quedó pegado a él:

- `lib/rocas-engine.ts:1` define `RocasEngineState = { score, lives, level, gameOver }`.
- `components/rocas-canvas.tsx:7,18` tipa `RealGameProps.onUpdate` como
  `(state: RocasEngineState) => void` — literalmente importa el tipo de Rocas.
- `components/jugar-client.tsx:7,32` importa `RocasEngineState` directamente
  desde `@/lib/rocas-engine` para tipar `handleGameUpdate`.

Antes de añadir el **segundo** motor real, hace falta desacoplar esto o el
código nuevo no compila sin importar un tipo que no le pertenece. Comprueba
primero si alguien ya lo hizo:

```bash
grep -rn "RocasEngineState" --include=*.ts --include=*.tsx .
```

Si sigue devolviendo los 4 sitios de arriba, generaliza así (cambio puramente
de tipos, cero cambio de comportamiento):

1. En `components/real-game-registry.tsx`, define y exporta el tipo compartido:
   ```ts
   export type RealGameState = {
     score: number;
     lives: number;
     level: number;
     gameOver: boolean;
   };
   ```
2. En `lib/rocas-engine.ts`, deja `RocasEngineState` como alias del tipo
   compartido (para no romper el import interno de `rocas-canvas.tsx` si lo
   sigue usando) o impórtalo directamente desde el registro — lo que genere
   menos churn.
3. En `components/rocas-canvas.tsx`, tipa `RealGameProps.onUpdate` contra
   `RealGameState` en vez de `RocasEngineState`.
4. En `components/jugar-client.tsx`, cambia el import y la firma de
   `handleGameUpdate` a `RealGameState`.
5. Verifica que `rocas` sigue jugándose igual en `/juego/rocas/jugar`
   (`npm run build` + prueba manual) — este paso no debe cambiar nada visible.

A partir de aquí, cualquier motor nuevo implementa `RealGameState` y
`RealGameHandle` (`pause/resume/reset/forceGameOver`, definido en
`components/rocas-canvas.tsx:10-15`) sin depender de Rocas.

## Paso 1: decide la identidad del juego

Consulta el catálogo real (vive en Supabase, no en `lib/games.ts` desde SPEC 05):

```sql
select id, title, cat, cover, color from games order by id;
```

y compáralo con `REAL_GAMES` en `components/real-game-registry.tsx` para ver
qué slugs ya existen pero siguen con la simulación falsa de
`components/jugar-client.tsx:39-47` (intervalo que suma puntos random cuando
`REAL_GAMES[game.id]` no existe).

Catálogo actual (8 filas fijas, `id` = slug usado en la URL `/juego/<id>` y en
`scores.game_id`):

| id                                                            | title         | motor real hoy                                                            |
| ------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------- |
| `rocas`                                                       | ROCAS         | sí (`lib/rocas-engine.ts`)                                                |
| `bloque-buster`                                               | BLOQUE BUSTER | no — candidato natural para portar `references/started-games/04-arkanoid` |
| `caida`                                                       | CAÍDA         | no — candidato natural para portar `references/started-games/03-tetris`   |
| `duelo-pixel`, `gloton`, `invasores`, `ranaria`, `serpentina` | —             | no                                                                        |

**Caso A — el juego ya tiene fila en `games`:** reutiliza ese `id`/`title`/
`cover`/`color` tal cual; no toques la tabla `games`.

**Caso B — juego totalmente nuevo, sin fila en `games`:** necesitas una
migración (`mcp__supabase__apply_migration`) que inserte una fila nueva con el
mismo shape que sembró SPEC 05/07 (`id, title, short, long, cat, cover, color,
best, plays`, con `best=0, plays=0` — el trigger de SPEC 07 los actualizará
solo). Elige:

- `id`: slug kebab-case, en el mismo tono castizo/arcade que los existentes
  (ROCAS, CAÍDA, GLOTÓN…), no el nombre en inglés de la carpeta de referencia.
- `cat`: uno de `ARCADE | PUZZLE | SHOOTER | VERSUS` (`lib/games.ts:1`).
- `color`: uno de `cyan | magenta | yellow | green` (`lib/games.ts:2`).
- `cover`: una clase CSS nueva `cover-<algo>`. Añádela en `app/globals.css`
  junto a las existentes (busca `.cover-bricks`, `.cover-tetro`, `.cover-snake`
  a partir de la línea ~404) — mismo patrón: `.cover-bg` es la base común,
  cada `.cover-X` pone su propio `background`/gradiente/`::after`.

## Paso 2: si viene de `references/started-games/`, léelo entero primero

Cada carpeta (`02-asteroids`, `03-tetris`, `04-arkanoid`, y las que se añadan)
es un juego HTML5 Canvas standalone sin build (`index.html` + `game.js` [+
`style.css`, `levels.js`, `assets/`]) con su propio `CLAUDE.md` explicando la
arquitectura interna — léelo, es la referencia más rápida para entender el
estado del juego antes de portarlo. `lib/rocas-engine.ts` **es literalmente el
port** de `references/started-games/02-asteroids/game.js` a este patrón — úsalo
como ejemplo de referencia end-to-end, no solo como plantilla abstracta.

## Paso 3: portar/crear el motor en `lib/<slug>-engine.ts`

Sigue el patrón exacto de `lib/rocas-engine.ts`:

- Función factoría `create<Nombre>Engine(canvas: HTMLCanvasElement, callbacks: { onUpdate: (state: RealGameState) => void }): <Nombre>EngineHandle`.
- El handle expone `pause()`, `resume()`, `reset()`, `forceGameOver()`, `destroy()`.
- Loop con `requestAnimationFrame`, `dt` capado a 0.05s (evita spiral-of-death
  al perder el foco de la pestaña) — ver `lib/rocas-engine.ts:545`.
- Input por teclado con el patrón `keys`/`justPressed`/`pressed(code)` si el
  juego lo necesita — regístralo en el `addEventListener` dentro de la
  factoría y límpialo en `destroy()` (nunca lo dejes global/fuera de la
  factoría, o dos partidas seguidas duplican listeners).
- `callbacks.onUpdate(state)` se llama cada frame con el estado completo
  (`score`, `lives`, `level`, `gameOver`) — es la única vía de comunicación
  hacia React; no toques el DOM directamente.

Adaptaciones casi seguras al portar desde `references/started-games/`:

- **Quita todo lo que escriba en el DOM del juego original** (`#score`,
  `#next-canvas`, overlays de pausa/game over, `document.getElementById(...)`)
  — ese HUD ya existe en `components/jugar-client.tsx` y se alimenta de
  `onUpdate`. El motor portado solo dibuja el campo de juego en el único
  `<canvas>` que le pasa React.
- **Vidas/nivel que no existan en el juego original**: mapea con sentido. Si
  no hay vidas (p.ej. Tetris), repórtalas como `0` — el HUD ya lo maneja
  (`components/jugar-client.tsx:93`: `"♥ ".repeat(lives).trim() || "—"`
  muestra "—" con `lives=0`). Si no hay nivel, usa `1` fijo o derívalo como
  ya hace el propio juego (Tetris trae su propio `level = floor(lines/10)+1`,
  reutilízalo tal cual).
- **Tamaño del canvas y el marco CRT**: `.crt-screen canvas` en
  `app/globals.css:636-641` fuerza `width:100%; height:100%` dentro de un
  contenedor `aspect-ratio: 4/3`. Rocas usa 800×600 (4:3 exacto) y por eso se
  ve sin distorsión. Un juego portado con resolución nativa distinta (p.ej.
  Tetris a 300×600, vertical) se **estirará y deformará** si usas esa
  resolución interna tal cual. Antes de portarlo, decide: o rediseñas el
  campo de juego para que quepa centrado/con letterbox dentro de un canvas
  interno de 800×600 (recomendado, mismo criterio que Rocas), o aceptas la
  distorsión explícitamente y lo mencionas al usuario — no lo hagas en
  silencio.

## Paso 4: envolver el motor en `components/<slug>-canvas.tsx`

Copia el patrón de `components/rocas-canvas.tsx` casi al carácter: mismo
`useEffect` de montaje/desmontaje que crea el engine sobre el `<canvas>` y lo
destruye al desmontar, mismo `useImperativeHandle` reexponiendo
`pause/resume/reset/forceGameOver`, mismo `onUpdateRef` para no recrear el
engine cuando cambia la referencia de `onUpdate`. Solo cambia el import del
motor (`create<Nombre>Engine`) y el tipo de estado (`RealGameState`, del
paso 0).

## Paso 5: registrar el juego

Una línea en `components/real-game-registry.tsx`:

```ts
export const REAL_GAMES: Record<string, ComponentType<RealGameProps>> = {
  rocas: RocasCanvas,
  "<slug>": <Nombre>Canvas,
};
```

Con eso, `components/jugar-client.tsx:14` (`REAL_GAMES[game.id]`) ya elige el
motor real en vez de la simulación falsa, sin más cambios en esa pantalla.

## Paso 6: verificar

1. `npm run lint` y `npm run build` — deben terminar sin errores.
2. Manual en `/juego/<slug>/jugar`: jugar de verdad (no la barra de progreso
   falsa), pausar/reanudar, terminar partida, guardar puntuación con un
   nombre, confirmar que el modal marca "PUNTUACIÓN GUARDADA_" (o el error si
   Supabase falla).
3. `/juego/<slug>` debe mostrar esa puntuación real en vez de "AÚN NO HAY
   PUNTUACIONES".
4. `/salon-de-la-fama`, pestaña del juego, debe mostrar la misma puntuación en
   el top/podio, y "TU MEJOR MARCA" si hay sesión iniciada con ese nombre.
5. Confirmar el trigger de SPEC 07 con SQL directo si hace falta depurar:
   ```sql
   select id, best, plays from games where id = '<slug>';
   select * from scores where game_id = '<slug>' order by created_at desc limit 5;
   ```

## Si el juego no viene de `references/started-games/`

Mismo pipeline, saltando el paso 2: escribe `lib/<slug>-engine.ts` desde cero
siguiendo la misma arquitectura de factoría (paso 3) en vez de portar un
`game.js` existente. Todo lo demás (paso 0, 1, 4, 5, 6) es idéntico.

## Diseño / copy

Para cualquier UI nueva que toques (HUD extra, textos de la portada, etc.),
sigue el tono ya establecido: español, mayúsculas tipo arcade retro
(`"AÚN NO HAY PUNTUACIONES"`, `"GUARDAR PUNTUACIÓN"`), fuentes `pixel`/`mono`
ya definidas en `app/globals.css`. Si necesitas diseñar algo visual más allá
de reutilizar los componentes existentes, usa el skill `frontend-design` de
este mismo repo (`.claude/skills/frontend-design/`), tal como indica
`CLAUDE.md` ("Usa siempre /frontend-design para diseñar frontend").

## Spec-driven design

`CLAUDE.md` señala que el proyecto pretende usar `/spec` y `/spec-impl`
(specs en `specs/NN-slug.md`, ver `specs/06-leaderboard-real.md` como
plantilla real de nivel de detalle) pero que esos skills no están instalados
en la raíz del repo. Verifica primero si ya se instalaron:

```bash
ls .claude/skills | grep -E "^spec"
```

(Nota: existe una copia de `spec`/`spec-impl` dentro de `app/.claude/skills/`
y `app/.agents/skills/`, aparentemente instalada por error en esa subcarpeta
en vez de en la raíz del repo — no se descubre desde ahí al ejecutar Claude
Code desde la raíz. No la muevas ni la borres sin que el usuario lo pida
explícitamente; si el usuario quiere `/spec` funcionando, es una tarea aparte
de instalarlo correctamente en la raíz.)

**Antes de escribir el archivo de spec, lee siempre como referencia** —
tanto si vas a invocar `/spec` de verdad como si vas a redactar la spec a
mano porque el skill no está en la raíz:

1. `app/.claude/skills/spec/SKILL.md` (es la copia real que existe hoy en el
   repo; si en el futuro aparece una instalada en `.claude/skills/spec/`,
   usa esa) — define las 4 fases del método (entender contexto → preguntas
   de aclaración en bloques de 3-5 → escribir sección por sección o de un
   tirón si ya no falta nada → guardar el archivo), qué preguntar en la fase
   de aclaración (alcance, datos, integración, persistencia, UX/estados,
   riesgos, decisiones ya cerradas) y las reglas duras (nunca escribir
   código en esta fase, nunca asumir una decisión que el usuario no
   confirmó, nunca marcar el estado como `Approved` automáticamente).
2. `app/.claude/skills/spec/template.md` — es la plantilla de secciones que
   `SKILL.md` cita explícitamente como referencia ("Read `template.md` ...
   Lean on it at every step"): cabecera con estado/dependencias/fecha/
   objetivo en una frase, Alcance (In / Out of scope, ambos obligatorios),
   Modelo de datos (o decir explícitamente que no hay), Plan de
   implementación (pasos numerados, cada uno dejando el sistema funcional),
   Criterios de aceptación (checklist booleano, nada de "que funcione
   bien"), Decisiones (con el porqué) y, opcional, Riesgos — cierra siempre
   con "Qué NO incluye este spec".

No copies esas plantillas literalmente: úsalas para calcar la forma y el
nivel de detalle, igual que ya hacen `specs/05-tabla-juegos-supabase.md`,
`specs/06-leaderboard-real.md` y `specs/07-estadisticas-reales-juegos.md` (léelas
también — son el ejemplo concreto de cómo ese formato ya se aplicó a este
mismo repo, incluido el idioma español y el nombre de las secciones).

Aplicado a un juego nuevo, la fase de preguntas de `/spec` debería resolver
como mínimo: qué `id`/slug tendrá el juego y si ya existe fila en `games`
(paso 1 de este skill), si viene de `references/started-games/` o se hace
desde cero (paso 2), si hace falta el refactor de tipos del paso 0, cómo se
van a mapear vidas/nivel si el juego original no los tiene, y cómo resolver
el aspect ratio 4:3 del `.crt-screen` si el juego es nativamente vertical.

Si `/spec` y `/spec-impl` están disponibles en la raíz, invócalos y deja que
el flujo guiado redacte `specs/NN-<slug-del-juego>.md`. Si no están
disponibles ahí, redacta tú mismo el archivo siguiendo el mismo `SKILL.md`/
`template.md` leídos arriba: no te saltes la fase de preguntas de
aclaración solo porque no hay comando — sigue pidiéndole al usuario lo que
falte antes de escribir la spec. En cualquier caso, mantén la misma
disciplina de verificación por paso que ya usan los pasos 0-6 de este
skill.
