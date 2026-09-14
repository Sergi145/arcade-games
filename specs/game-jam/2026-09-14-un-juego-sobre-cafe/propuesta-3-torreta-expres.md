# SPEC (game-jam) — TORRETA EXPRÉS

> **Status:** Draft
> **Depends on:** Ninguno
> **Date:** 2026-09-14
> **Objective:** Añadir un shooter arcade de oleadas ("TORRETA EXPRÉS") donde el jugador mueve una torreta-máquina de espresso a lo largo del mostrador, dispara granos de café contra plagas y nubes de vapor descontrolado, y esquiva tazas rotas y salpicaduras que caen del techo.

## Por qué existe este spec

Esta propuesta viene de la game jam "un juego sobre café" (2026-09-14), con
categoría (`SHOOTER`) y color (`green`) fijados de antemano y la mecánica
core impuesta: oleadas de esquivar y disparar. El juego no existe hoy en
ninguna forma — ni fila en `games`, ni carpeta en
`references/started-games/` — así que este spec cae en el **Caso B** del
skill `add-arcade-game` (juego totalmente nuevo, requiere migración que
inserte la fila en `games`) y, al no venir de `references/started-games/`,
el motor se escribe desde cero siguiendo la arquitectura de factoría ya
usada por `lib/serpentina-engine.ts` (mismo precedente: sin código fuente
que portar, solo el contrato `create<Nombre>Engine` a seguir).

## Scope

**In:**

- Motor real nuevo (`lib/torreta-expres-engine.ts`) para un shooter de
  oleadas top-down clásico (estilo cañón fijo de Space Invaders/Galaga, no
  nave libre como ROCAS): la torreta se mueve solo en horizontal por el
  mostrador, en la parte inferior del campo de juego.
- Canvas interno fijo en 800×600 (4:3 exacto, mismo criterio que
  ROCAS/CAÍDA/BLOQUE BUSTER/SERPENTINA) — sin distorsión ni letterbox.
- Torreta (máquina de espresso montada sobre ruedas/raíles) en
  `y ≈ 560`, movimiento horizontal con `←`/`→`, velocidad constante,
  acotada a los límites del campo.
- Disparo con `Espacio`: lanza un grano de café (proyectil circular) hacia
  arriba, con una cadencia máxima fija (cooldown ~0.25s) para que no sea
  spameable sin límite — control de teclado simple, sin combos.
- Dos tipos de enemigo, generados en oleadas desde arriba:
  - **Plaga** (bicho del grano — gorgojo/hormiga de cafetal): desciende en
    línea recta o zig-zag suave, 1 impacto para destruirla, 10 puntos.
  - **Vapor descontrolado** (nube de vapor de la máquina): desciende con
    deriva lateral errática (oscilación senoidal), 2 impactos para
    destruirla, 25 puntos.
- Una oleada (nivel `N`) genera `4 + N` plagas y `floor(N / 2)` nubes de
  vapor; al destruir o perder todos los enemigos de la oleada, arranca la
  siguiente automáticamente y sube el nivel.
- Peligros independientes de los enemigos, no disparables: **tazas rotas** y
  **salpicaduras** caen periódicamente desde posiciones `x` aleatorias en la
  parte superior, a velocidad constante — el jugador los esquiva moviendo la
  torreta; son la mitad "esquivar" de la mecánica core, separada de la mitad
  "disparar" (los enemigos).
- Vidas: el jugador empieza con 3. Se pierde una vida al colisionar con una
  taza rota o salpicadura, o si un enemigo llega a la línea del mostrador sin
  ser destruido. Partida termina (`gameOver: true`) al llegar a 0 vidas.
- Puntuación: suma fija por tipo de enemigo destruido (10 plaga / 25 vapor);
  los peligros que caen no dan ni quitan puntos, solo cuestan una vida si
  impactan.
- El motor reporta a React vía `callbacks.onUpdate({ score, lives, level,
gameOver })` cada frame, usando el tipo genérico `RealGameState` ya
  exportado por `components/real-game-registry.tsx` (paso 0 del skill ya
  satisfecho: los 4 motores reales existentes ya usan este tipo compartido,
  no hace falta ningún refactor previo).
- El motor expone el contrato estándar `pause()`, `resume()`, `reset()`,
  `forceGameOver()`, `destroy()`.
- `components/torreta-expres-canvas.tsx`, calcado del patrón de
  `components/rocas-canvas.tsx` (mismo `useEffect` de montaje/desmontaje,
  mismo `useImperativeHandle`, mismo `onUpdateRef`).
- Registro: se añade `"torreta-expres": TorretaExpresCanvas` a `REAL_GAMES`
  en `components/real-game-registry.tsx`.
- Fila nueva en la tabla `games` (Caso B): `id = "torreta-expres"`,
  `title = "TORRETA EXPRÉS"`, `cat = "SHOOTER"`, `color = "green"`,
  `cover = "cover-espresso"`, `short`/`long` con copy en español tono
  arcade, `best = 0`, `plays = 0` (el trigger de SPEC 07 los mantiene desde
  ahí).
- Clase CSS nueva `.cover-espresso` en `app/globals.css`, junto a
  `.cover-bricks`/`.cover-tetro`/`.cover-snake` existentes, siguiendo el
  mismo patrón (`.cover-bg` como base + `background`/gradiente/`::after`
  propios, paleta verde neón).
- Todos los enemigos, peligros y la torreta se dibujan con primitivas de
  canvas (círculos, arcos, degradados) — sin assets de imagen, igual que
  ROCAS/CAÍDA/BLOQUE BUSTER (no hay ningún sprite de café proporcionado para
  esta game jam, a diferencia del caso de SERPENTINA).

**Out of scope (para specs futuros):**

- Rotación libre de la torreta o disparo en ángulo — solo movimiento
  horizontal y disparo vertical fijo, como Space Invaders/Galaga.
- Power-ups, combos, multiplicadores de puntuación, o distintos tipos de
  grano de café con efectos especiales.
- Jefes de fin de oleada o pantalla de victoria — el juego es de oleadas
  infinitas con dificultad creciente, sin condición de "ganar", igual que el
  resto del catálogo (se juega para maximizar puntuación).
- Sonido y controles táctiles/de ratón.
- Sprites o imágenes de café/plagas/vapor — se decide explícitamente dibujar
  todo con primitivas de canvas (ver Decisiones).
- Cambios al HUD genérico de React (`components/jugar-client.tsx`), a
  `app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx` ni a
  `components/salon-de-la-fama-client.tsx` — el leaderboard genérico ya
  funciona en cuanto el motor reporta `RealGameState`.
- Cualquier mecánica de las otras dos propuestas de esta misma game jam.

## Data model

Este spec no introduce tablas ni columnas nuevas: reutiliza tal cual el
esquema ya sembrado por SPEC 05 (`games`) y SPEC 06/07 (`scores` +
trigger `bump_game_stats()`), y el tipo compartido `RealGameState` (`score,
lives, level, gameOver`) ya exportado por
`components/real-game-registry.tsx`. Como `torreta-expres` es un juego
completamente nuevo (no existe fila hoy), sí hace falta **una fila nueva**
en `games` con el mismo shape que las 8 filas existentes — no un cambio de
esquema:

```sql
-- Migración (Caso B del skill add-arcade-game)
insert into games (id, title, short, long, cat, cover, color, best, plays)
values (
  'torreta-expres',
  'TORRETA EXPRÉS',
  'Defiende el mostrador de plagas y vapor descontrolado.',
  'Mueve la torreta-máquina de espresso, dispara granos de café contra
   plagas y nubes de vapor, y esquiva tazas rotas y salpicaduras en oleadas
   cada vez más rápidas.',
  'SHOOTER',
  'cover-espresso',
  'green',
  0,
  0
);
```

El motor mantiene internamente su propio estado, que **no se persiste ni se
expone fuera del motor** (solo se traduce a `RealGameState` en cada
`onUpdate`); se ilustra aquí solo para dejar clara la implementación:

```ts
// lib/torreta-expres-engine.ts — estado interno, no exportado como tal

type Turret = { x: number; y: number; width: number };
type Projectile = { x: number; y: number; vy: number };
type PestEnemy = {
  kind: "plaga";
  x: number;
  y: number;
  vy: number;
  driftPhase: number;
  hp: 1;
};
type SteamEnemy = {
  kind: "vapor";
  x: number;
  y: number;
  vy: number;
  driftPhase: number;
  hp: 2;
};
type Hazard = {
  kind: "taza" | "salpicadura";
  x: number;
  y: number;
  vy: number;
};

type TorretaExpresState = {
  turret: Turret;
  projectiles: Projectile[];
  enemies: (PestEnemy | SteamEnemy)[];
  hazards: Hazard[];
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
};

// Contrato público, igual al de los otros motores
export type TorretaExpresEngineCallbacks = {
  onUpdate: (state: RealGameState) => void;
};

export type TorretaExpresEngineHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  destroy: () => void;
};

export function createTorretaExpresEngine(
  canvas: HTMLCanvasElement,
  callbacks: TorretaExpresEngineCallbacks,
): TorretaExpresEngineHandle;
```

```ts
// components/real-game-registry.tsx
export const REAL_GAMES: Record<string, ComponentType<RealGameProps>> = {
  rocas: RocasCanvas,
  caida: CaidaCanvas,
  "bloque-buster": BloqueBusterCanvas,
  serpentina: SerpentinaCanvas,
  "torreta-expres": TorretaExpresCanvas,
};
```

Conventions:

- Coordenadas: origen top-left, canvas interno 800×600.
- Velocidades en píxeles/segundo (el motor usa `dt` real, no
  píxeles/frame).
- `enemies` y `hazards` son arrays mutables que el bucle recorre cada frame
  para mover, colisionar y purgar (fuera de pantalla o destruidos).

## Implementation plan

1. **Identidad del juego (Paso 1 del skill, Caso B):** aplicar la migración
   de arriba con `mcp__supabase__apply_migration` para insertar la fila
   `torreta-expres` en `games`. Añadir la clase `.cover-espresso` en
   `app/globals.css` junto a las demás `.cover-*`, siguiendo el mismo
   patrón (`.cover-bg` base + degradado/`::after` propio en paleta verde).
   Verificación: `select * from games where id = 'torreta-expres'` devuelve
   la fila; `/biblioteca` muestra la tarjeta nueva con su portada aunque
   todavía use la simulación falsa al jugar.
2. **Paso 2 omitido:** este juego no viene de `references/started-games/`
   (no hay ningún `game.js` de shooter de café en el repo) — se construye
   desde cero, mismo precedente que `lib/serpentina-engine.ts` (SPEC 10).
3. **Motor (Paso 3):** crear `lib/torreta-expres-engine.ts` con
   `createTorretaExpresEngine(canvas, { onUpdate })`: estado inicial
   (torreta centrada, arrays vacíos, `score=0, lives=3, level=1,
gameOver=false`), bucle `requestAnimationFrame` con `dt` capado a 0.05s,
   listeners de teclado (`←`/`→` mueven la torreta, `Espacio` dispara con
   cooldown) registrados dentro de la factoría y limpiados en `destroy()`.
   Implementar movimiento de plagas (línea recta/zig-zag), nubes de vapor
   (deriva senoidal), proyectiles, generación de oleada según nivel,
   colisión proyectil↔enemigo (resta `hp`, suma puntos y elimina enemigo si
   `hp` llega a 0), colisión torreta↔peligro y enemigo-llega-al-mostrador
   (resta 1 vida, dispara `gameOver` en 0), avance de nivel al vaciar la
   oleada, dibujo con primitivas de canvas (torreta, granos, plagas, vapor,
   tazas/salpicaduras) y `callbacks.onUpdate(state)` cada frame. Implementar
   `pause`/`resume`/`reset`/`forceGameOver`/`destroy`. Verificación: el
   archivo compila sin errores de tipos, aún no se usa desde ningún
   componente.
4. **Wrapper de React (Paso 4):** crear `components/torreta-expres-canvas.tsx`
   calcado de `components/rocas-canvas.tsx` (mismo `useEffect` de
   montaje/desmontaje que crea y destruye el engine, mismo
   `useImperativeHandle` reexponiendo `pause/resume/reset/forceGameOver`,
   mismo `onUpdateRef`); solo cambia el import a
   `createTorretaExpresEngine` y el tipo `RealGameState`. Verificación: se
   importa sin errores de tipos, aún no conectado al registro.
5. **Registro (Paso 5):** añadir `"torreta-expres": TorretaExpresCanvas` a
   `REAL_GAMES` en `components/real-game-registry.tsx`. Con esto,
   `components/jugar-client.tsx` ya elige el motor real en vez de la
   simulación falsa para `/juego/torreta-expres/jugar`, sin más cambios en
   esa pantalla.
6. **Verificación (Paso 6):** `npm run lint` y `npm run build` sin errores.
   Prueba manual en `/juego/torreta-expres/jugar`: mover la torreta con
   `←`/`→`, disparar con `Espacio` y confirmar el cooldown, destruir varias
   plagas (10 pts, 1 impacto) y una nube de vapor (25 pts, 2 impactos),
   dejar que una taza/salpicadura impacte la torreta (pierde 1 vida) y que
   un enemigo llegue al mostrador sin ser destruido (pierde 1 vida), limpiar
   una oleada completa y confirmar que sube el nivel y la siguiente oleada
   es más difícil, llegar a 0 vidas y confirmar el modal de fin de partida,
   PAUSA/REANUDAR, guardar puntuación con nombre, "JUGAR DE NUEVO", SALIR.
   Confirmar que `/juego/torreta-expres` y la pestaña correspondiente de
   `/salon-de-la-fama` muestran la puntuación real guardada, y que
   `games.best`/`games.plays` se actualizan vía el trigger de SPEC 07.
   Confirmar que ROCAS/CAÍDA/BLOQUE BUSTER/SERPENTINA siguen funcionando
   igual.

## Acceptance criteria

- [ ] `/juego/torreta-expres/jugar` renderiza el canvas del motor real
      (torreta, granos de café, plagas, vapor, tazas/salpicaduras) dentro
      del bisel CRT, sin la barra de progreso falsa.
- [ ] El canvas interno es 800×600 y escala por CSS al bisel CRT sin
      distorsión (proporción 4:3 exacta).
- [ ] `←`/`→` mueven la torreta horizontalmente dentro de los límites del
      campo; `Espacio` dispara un grano de café hacia arriba respetando el
      cooldown (no se puede disparar sin límite manteniendo pulsado).
- [ ] Destruir una plaga suma exactamente 10 puntos con 1 impacto; destruir
      una nube de vapor suma exactamente 25 puntos y requiere 2 impactos.
- [ ] Una taza rota o salpicadura que impacta la torreta resta exactamente
      1 vida; un enemigo que llega a la línea del mostrador sin ser
      destruido también resta 1 vida.
- [ ] Al destruir/perder todos los enemigos de una oleada, arranca la
      siguiente automáticamente y el nivel mostrado en el HUD sube en 1.
- [ ] La partida termina (`gameOver: true`, modal de fin de partida) al
      llegar a 0 vidas.
- [ ] El HUD de React (Puntuación, Vidas, Nivel) refleja en tiempo real el
      estado reportado por `onUpdate`.
- [ ] PAUSA detiene el movimiento manteniendo el último fotograma visible;
      REANUDAR continúa exactamente donde quedó.
- [ ] Guardar puntuación desde el modal de fin de partida inserta una fila
      real en `scores` vía `useSession().saveScore`, sin cambios en
      `lib/session.tsx`.
- [ ] "JUGAR DE NUEVO" reinicia por completo el motor vía `reset()` (torreta
      centrada, arrays vacíos, score/vidas/nivel iniciales), sin recargar la
      página.
- [ ] `/juego/torreta-expres` y `/salon-de-la-fama` (pestaña TORRETA
      EXPRÉS) muestran puntuaciones reales guardadas, con `games.best` /
      `games.plays` actualizados por el trigger `bump_game_stats()`.
- [ ] `torreta-expres` aparece en `REAL_GAMES` en
      `components/real-game-registry.tsx`.
- [ ] Los demás juegos del catálogo sin motor real siguen mostrando la
      simulación falsa sin cambios.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** torreta con movimiento horizontal fijo (sin rotación libre) —
  coincide con la mecánica core impuesta ("máquina de espresso montada en
  torreta") y con el esquema de control simple ya usado por
  BLOQUE BUSTER (paddle), evitando reinventar el esquema de rotación de
  ROCAS para un juego donde no aporta nada.
- **Sí:** dos tipos de enemigo (plaga / vapor) con distinta dificultad y
  puntuación — traduce literalmente "plagas/vapor descontrolado" del
  encargo en una diferencia jugable real, no solo cosmética.
- **Sí:** peligros que caen (tazas rotas, salpicaduras) como entidad
  separada de los enemigos, no disparable — mantiene la dualidad
  "disparar enemigos" / "esquivar peligros" explícita en vez de fundir
  ambas mecánicas en una sola lista de objetos.
- **Sí:** oleadas infinitas con dificultad creciente, sin pantalla de
  victoria — mismo criterio que el resto del catálogo (partidas cortas que
  terminan por pérdida de vidas, se juega para maximizar puntuación).
- **Sí:** todo dibujado con primitivas de canvas, sin sprites — no hay
  ningún asset de café/plagas/vapor proporcionado para esta game jam (a
  diferencia de SERPENTINA, que sí tenía `fruits.png`); mantiene el motor
  autocontenido y evita depender de un asset que no existe todavía.
- **Sí:** fila nueva en `games` vía migración (Caso B) con `cat=SHOOTER`,
  `color=green` — impuestos por el encargo de esta propuesta concreta.
- **No:** power-ups, combos o tipos especiales de grano — fuera del alcance
  mínimo jugable de esta propuesta; se podrían añadir en un spec futuro si
  se aprueba el juego.
- **No:** jefe de fin de oleada — añadiría una clase de entidad y lógica de
  patrón de ataque que no aporta a validar la mecánica core pedida
  (esquivar + disparar en oleadas).
- **No:** sonido, controles táctiles/de ratón — ningún motor real existente
  en el catálogo los usa hoy.
- **No:** cambios al HUD genérico de React ni a las pantallas de detalle o
  salón de la fama — el leaderboard ya es genérico por `game_id` desde
  SPEC 06/07.

## What is **not** in this spec

- Rotación libre de la torreta, disparo en ángulo, power-ups, combos o
  tipos especiales de grano de café.
- Jefes de fin de oleada o cualquier condición de victoria/final del juego.
- Sonido y controles táctiles/de ratón.
- Sprites o imágenes para plagas/vapor/tazas — se dibuja todo con
  primitivas de canvas.
- Cambios al HUD genérico de React, a `app/juego/[id]/page.tsx`, a
  `app/juego/[id]/jugar/page.tsx` o a `components/salon-de-la-fama-client.tsx`.
- Cambios de esquema en `games` o `scores` más allá de la fila nueva
  insertada para este juego.
- Las otras dos propuestas de esta misma game jam.

Cada uno de estos, si se implementa, va en su propio spec.
