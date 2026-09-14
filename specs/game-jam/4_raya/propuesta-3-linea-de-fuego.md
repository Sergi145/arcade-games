> **Estado del game jam:** Descartada el 2026-09-14 — se eligió "Raya Veloz" (specs/12-raya-veloz.md) en su lugar.

# SPEC (game-jam) — LÍNEA DE FUEGO

> **Status:** Draft
> **Depends on:** Ninguno
> **Date:** 2026-09-14
> **Objective:** Añadir un shooter de oleadas ("LÍNEA DE FUEGO") donde el jugador mueve un cañón bajo una grilla vertical tipo cuatro en raya, dispara fichas de color para alinear cuatro y sumar puntos, y esquiva o destruye rocas y naves que caen en oleadas buscando bloquear columnas o desalinear las fichas ya colocadas.

## Por qué existe este spec

Esta propuesta viene de la game jam "cuatro en raya" (2026-09-14), con
categoría (`SHOOTER`) y color (`cyan`) fijados de antemano y la mecánica
core impuesta: disparar/esquivar por oleadas contra una grilla vertical de
cuatro en raya. El juego no existe hoy en ninguna forma — ni fila en
`games`, ni carpeta en `references/started-games/` — así que este spec cae
en el **Caso B** del skill `add-arcade-game` (juego totalmente nuevo,
requiere migración que inserte la fila en `games`) y, al no venir de
`references/started-games/`, el motor se escribe desde cero siguiendo la
arquitectura de factoría ya usada por `lib/serpentina-engine.ts` (mismo
precedente: sin código fuente que portar, solo el contrato
`create<Nombre>Engine` a seguir).

## Scope

**In:**

- Motor real nuevo (`lib/linea-de-fuego-engine.ts`) para un shooter de
  oleadas top-down: un cañón se mueve en horizontal por la parte inferior
  del campo de juego, bajo una grilla de cuatro en raya que ocupa la mitad
  superior del canvas.
- Canvas interno fijo en 800×600 (4:3 exacto, mismo criterio que
  ROCAS/CAÍDA/BLOQUE BUSTER/SERPENTINA) — sin distorsión ni letterbox.
- Grilla de 7 columnas × 6 filas (proporción clásica de Conecta 4), celdas
  de 70×60px, centrada horizontalmente entre `x=155` y `x=645`, entre
  `y=50` (fila superior, fila 0) e `y=410` (fila inferior, fila 5, la más
  cercana al cañón). Los centros de columna (`x = 190, 260, 330, 400, 470,
540, 610`) son los mismos 7 carriles que usan el cañón y los obstáculos.
- Cañón en `y ≈ 560`, movimiento horizontal continuo con `←`/`→`, acotado a
  los límites del campo, sin rotación.
- El cañón siempre muestra su **ficha actual** (un color de
  `{cian, magenta, amarillo}`, elegido al azar al iniciar y tras cada
  disparo) — el jugador siempre sabe qué color va a lanzar antes de
  disparar.
- Disparo con `Espacio` (cooldown ~0.3s, evita el spam): lanza la ficha
  actual hacia arriba por el carril más cercano a la posición del cañón en
  ese instante. Si el disparo impacta una roca o un desalineador en pleno
  vuelo, lo destruye (disparo consumido, sin colocar ficha esa vez). Si no
  impacta nada, la ficha sigue subiendo hasta la celda vacía más baja de la
  columna objetivo y queda fija en la grilla con su color — la misma regla
  de gravedad estilo Conecta 4 se aplica también a las rocas que caen desde
  arriba (ver Decisiones): toda pieza, entre por abajo (disparo) o por
  arriba (roca), se asienta en la celda vacía más baja de su columna.
- Detección de línea de 4 fichas del mismo color (horizontal, vertical o
  cualquiera de las dos diagonales) tras cada colocación: cada línea
  encontrada suma 100 puntos y limpia esas 4 celdas; varias líneas
  formadas por una misma colocación se suman todas (combo). Tras limpiar,
  las piezas de esa columna que quedaban por encima de las celdas
  vaciadas caen para compactar la pila (rocas incluidas: no se eliminan
  por líneas de color, pero sí se desplazan hacia abajo si algo por debajo
  de ellas se limpia).
- Obstáculos en oleadas, generados desde arriba (`y=-20`) en un carril
  aleatorio, cayendo en línea recta:
  - **Roca**: si llega a la celda vacía más baja de su columna antes de
    ser destruida, se asienta ahí como bloque gris permanente (no cuenta
    como color, nunca se limpia por línea, solo se elimina si se dispara
    mientras cae). Si su columna ya está llena (6 piezas), la roca no se
    detiene en la grilla: sigue cayendo hasta el cañón como amenaza
    directa. Destruirla en vuelo suma 15 puntos.
  - **Desalineador**: nave pequeña que desciende con oscilación lateral
    (zig-zag suave) por su carril durante todo el trayecto, sin detenerse
    en la grilla. Al cruzar la fila de una celda ocupada por una ficha de
    color en su columna, tiene una probabilidad de recolorear esa ficha a
    otro color al azar (desalinea líneas casi completas). Si llega a la
    fila del cañón (`y≈560`) y coincide con la posición del cañón,
    colisiona y resta 1 vida; si el jugador ya movió el cañón fuera de ese
    carril, el desalineador se pierde sin coste. Destruirlo en vuelo suma
    25 puntos. Empieza a aparecer desde el nivel 2 (el nivel 1 solo tiene
    rocas, para introducir la mecánica de la grilla primero).
- Oleadas: la oleada del nivel `N` genera `5 + N*2` obstáculos (mezcla
  ~70% roca / ~30% desalineador desde el nivel 2); intervalo de aparición y
  velocidad de caída aumentan con el nivel. Al resolverse todos los
  obstáculos de la oleada (destruidos, asentados en la grilla, o pasados
  de largo), el nivel sube en 1 y arranca la siguiente oleada,
  automáticamente y más difícil.
- Vidas: el jugador empieza con 3, pierde 1 al colisionar con una roca
  desbordada o un desalineador no destruido en la fila del cañón.
- Fin de partida (`gameOver: true`) por cualquiera de dos condiciones
  independientes: llegar a 0 vidas, o que las 7 columnas de la grilla
  estén simultáneamente llenas (sin espacio para ninguna pieza más,
  "desbordamiento" estilo top-out de Tetris).
- El motor reporta a React vía `callbacks.onUpdate({ score, lives, level,
gameOver })` cada frame, usando el tipo genérico `RealGameState` ya
  exportado por `components/real-game-registry.tsx` (paso 0 del skill ya
  satisfecho: los 4 motores reales existentes ya usan este tipo
  compartido, no hace falta ningún refactor previo).
- El motor expone el contrato estándar `pause()`, `resume()`, `reset()`,
  `forceGameOver()`, `destroy()`.
- `components/linea-de-fuego-canvas.tsx`, calcado del patrón de
  `components/rocas-canvas.tsx` (mismo `useEffect` de montaje/desmontaje,
  mismo `useImperativeHandle`, mismo `onUpdateRef`).
- Registro: se añade `"linea-de-fuego": LineaDeFuegoCanvas` a `REAL_GAMES`
  en `components/real-game-registry.tsx`.
- Fila nueva en la tabla `games` (Caso B): `id = "linea-de-fuego"`,
  `title = "LÍNEA DE FUEGO"`, `cat = "SHOOTER"`, `color = "cyan"`,
  `cover = "cover-conecta"`, `short`/`long` con copy en español tono
  arcade, `best = 0`, `plays = 0` (el trigger de SPEC 07 los mantiene
  desde ahí).
- Clase CSS nueva `.cover-conecta` en `app/globals.css`, junto a
  `.cover-bricks`/`.cover-tetro`/`.cover-snake` existentes, siguiendo el
  mismo patrón (`.cover-bg` como base + degradado/`::after` propio en
  paleta cian, reutilizando `var(--cyan)`/`var(--magenta)`/`var(--yellow)`
  para insinuar la grilla de fichas de colores).
- Todo se dibuja con primitivas de canvas (rejilla, fichas circulares,
  rocas, naves, cañón) — sin assets de imagen, igual que
  ROCAS/CAÍDA/BLOQUE BUSTER (no hay ningún sprite provisto para esta game
  jam, a diferencia del caso de SERPENTINA).

**Out of scope (para specs futuros):**

- Modo dos jugadores o versus real (aunque la categoría "cuatro en raya"
  evoca lo clásico de 2 jugadores, esta propuesta es de un jugador contra
  las oleadas, categoría `SHOOTER` impuesta por el encargo, no `VERSUS`).
- Selección manual del color de la ficha, cola de "siguientes" fichas
  (preview tipo Tetris), o power-ups de cualquier tipo.
- Multiplicador de combo más allá de sumar 100 puntos por cada línea
  encontrada en una misma colocación.
- Jefes de fin de oleada o pantalla de victoria — oleadas infinitas con
  dificultad creciente, sin condición de "ganar", igual que el resto del
  catálogo.
- Sonido y controles táctiles/de ratón.
- Sprites o imágenes para fichas/rocas/naves — se decide explícitamente
  dibujar todo con primitivas de canvas (ver Decisiones).
- Cambios al HUD genérico de React (`components/jugar-client.tsx`), a
  `app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx` ni a
  `components/salon-de-la-fama-client.tsx` — el leaderboard genérico ya
  funciona en cuanto el motor reporta `RealGameState`.
- Cualquier mecánica de las otras dos propuestas de esta misma game jam.

## Data model

Este spec no introduce persistencia nueva: reutiliza tal cual el esquema ya
sembrado por SPEC 05 (`games`) y SPEC 06/07 (`scores` + trigger
`bump_game_stats()`), y el tipo compartido `RealGameState` (`score, lives,
level, gameOver`) ya exportado por `components/real-game-registry.tsx`.
Como `linea-de-fuego` es un juego completamente nuevo (no existe fila
hoy), sí hace falta **una fila nueva** en `games` con el mismo shape que
las 8 filas existentes — no un cambio de esquema:

```sql
-- Migración (Caso B del skill add-arcade-game)
insert into games (id, title, short, long, cat, cover, color, best, plays)
values (
  'linea-de-fuego',
  'LÍNEA DE FUEGO',
  'Dispara fichas de color, esquiva oleadas y alinea cuatro para explotar la grilla.',
  'Mueve el cañón bajo una grilla vertical tipo cuatro en raya, dispara
   fichas de color para completar líneas de 4 y suma puntos, mientras
   esquivas o destruyes rocas y naves que caen en oleadas cada vez más
   rápidas buscando bloquear tus columnas o desalinear tus fichas.',
  'SHOOTER',
  'cover-conecta',
  'cyan',
  0,
  0
);
```

El motor mantiene internamente su propio estado, que **no se persiste ni
se expone fuera del motor** (solo se traduce a `RealGameState` en cada
`onUpdate`); se ilustra aquí solo para dejar clara la implementación:

```ts
// lib/linea-de-fuego-engine.ts — estado interno, no exportado como tal

type Ficha = "cian" | "magenta" | "amarillo";
type GridCell = { kind: "ficha"; color: Ficha } | { kind: "roca" } | null;

type Cannon = { x: number; nextColor: Ficha; cooldown: number };
type Shot = { x: number; y: number; color: Ficha; col: number };
type FallingRoca = { x: number; y: number; col: number; vy: number };
type Desalineador = {
  x: number;
  y: number;
  col: number;
  vy: number;
  phase: number;
};

type LineaDeFuegoState = {
  // grid[col][row] — 7 columnas × 6 filas; row 0 = fila superior,
  // row 5 = fila junto al cañón.
  grid: GridCell[][];
  cannon: Cannon;
  shots: Shot[];
  rocas: FallingRoca[];
  desalineadores: Desalineador[];
  waveRemaining: number;
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
};

// Contrato público, igual al de los otros motores
export type LineaDeFuegoEngineCallbacks = {
  onUpdate: (state: RealGameState) => void;
};

export type LineaDeFuegoEngineHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  destroy: () => void;
};

export function createLineaDeFuegoEngine(
  canvas: HTMLCanvasElement,
  callbacks: LineaDeFuegoEngineCallbacks,
): LineaDeFuegoEngineHandle;
```

```ts
// components/real-game-registry.tsx
export const REAL_GAMES: Record<string, ComponentType<RealGameProps>> = {
  rocas: RocasCanvas,
  caida: CaidaCanvas,
  "bloque-buster": BloqueBusterCanvas,
  serpentina: SerpentinaCanvas,
  "linea-de-fuego": LineaDeFuegoCanvas,
};
```

Conventions:

- Coordenadas: origen top-left, canvas interno 800×600.
- Velocidades en píxeles/segundo (el motor usa `dt` real, capado a 0.05s).
- `grid` es una matriz mutable columna-mayor; `shots`, `rocas` y
  `desalineadores` son arrays mutables que el bucle recorre cada frame
  para mover, colisionar y purgar (fuera de pantalla, asentados o
  destruidos).

## Implementation plan

1. **Identidad del juego (Paso 1 del skill, Caso B):** aplicar la
   migración de arriba con `mcp__supabase__apply_migration` para insertar
   la fila `linea-de-fuego` en `games`. Añadir la clase `.cover-conecta`
   en `app/globals.css` junto a las demás `.cover-*`, siguiendo el mismo
   patrón (`.cover-bg` base + degradado/`::after` propio en paleta cian
   con acentos magenta/amarillo). Verificación: `select * from games
where id = 'linea-de-fuego'` devuelve la fila; `/biblioteca` muestra la
   tarjeta nueva con su portada aunque todavía use la simulación falsa al
   jugar.
2. **Paso 2 omitido:** este juego no viene de `references/started-games/`
   (no hay ningún `game.js` de cuatro en raya en el repo) — se construye
   desde cero, mismo precedente que `lib/serpentina-engine.ts` (SPEC 10).
3. **Motor (Paso 3):** crear `lib/linea-de-fuego-engine.ts` con
   `createLineaDeFuegoEngine(canvas, { onUpdate })`: estado inicial
   (grilla 7×6 vacía, cañón centrado con color inicial al azar, arrays
   vacíos, `score=0, lives=3, level=1, gameOver=false`), bucle
   `requestAnimationFrame` con `dt` capado a 0.05s, listeners de teclado
   (`←`/`→` mueven el cañón, `Espacio` dispara con cooldown) registrados
   dentro de la factoría y limpiados en `destroy()`. Implementar: cálculo
   de la celda vacía más baja de una columna (usado tanto por disparos
   como por rocas), movimiento y colisión disparo↔obstáculo (destruye y
   consume el disparo, suma puntos), asentado de disparo sin impacto en
   la grilla, detección de líneas de 4 (horizontal/vertical/diagonales)
   tras cada asentado con limpieza y compactación por gravedad,
   generación de rocas (caída recta, desborde si columna llena) y
   desalineadores (zig-zag, recoloreo probabilístico al cruzar una ficha,
   colisión con el cañón), generación de oleada según nivel y avance
   automático de nivel al vaciarla, condición de derrota por 0 vidas o
   grilla llena, dibujo con primitivas de canvas (grilla, fichas, cañón,
   rocas, naves) y `callbacks.onUpdate(state)` cada frame. Implementar
   `pause`/`resume`/`reset`/`forceGameOver`/`destroy`. Verificación: el
   archivo compila sin errores de tipos, aún no se usa desde ningún
   componente.
4. **Wrapper de React (Paso 4):** crear
   `components/linea-de-fuego-canvas.tsx` calcado de
   `components/rocas-canvas.tsx` (mismo `useEffect` de montaje/desmontaje
   que crea y destruye el engine, mismo `useImperativeHandle`
   reexponiendo `pause/resume/reset/forceGameOver`, mismo `onUpdateRef`);
   solo cambia el import a `createLineaDeFuegoEngine` y el tipo
   `RealGameState`. Verificación: se importa sin errores de tipos, aún no
   conectado al registro.
5. **Registro (Paso 5):** añadir `"linea-de-fuego": LineaDeFuegoCanvas` a
   `REAL_GAMES` en `components/real-game-registry.tsx`. Con esto,
   `components/jugar-client.tsx` ya elige el motor real en vez de la
   simulación falsa para `/juego/linea-de-fuego/jugar`, sin más cambios
   en esa pantalla.
6. **Verificación (Paso 6):** `npm run lint` y `npm run build` sin
   errores. Prueba manual en `/juego/linea-de-fuego/jugar`: mover el
   cañón con `←`/`→`, disparar con `Espacio` respetando el cooldown,
   completar una línea de 4 (horizontal, vertical y diagonal por
   separado) y confirmar +100 puntos y que esas celdas se vacían y la
   pila se compacta, destruir una roca en vuelo (+15) y un desalineador
   en vuelo (+25), dejar que una roca desbordada o un desalineador
   impacten el cañón (−1 vida cada uno), dejar que un desalineador
   recoloree una ficha ya colocada, llenar las 7 columnas y confirmar
   game over por desbordamiento, y también llegar a 0 vidas y confirmar
   game over por esa vía, limpiar una oleada completa y confirmar que
   sube el nivel y aparece el desalineador a partir del nivel 2, PAUSA/
   REANUDAR, guardar puntuación con nombre, "JUGAR DE NUEVO", SALIR.
   Confirmar que `/juego/linea-de-fuego` y la pestaña correspondiente de
   `/salon-de-la-fama` muestran la puntuación real guardada, y que
   `games.best`/`games.plays` se actualizan vía el trigger de SPEC 07.
   Confirmar que ROCAS/CAÍDA/BLOQUE BUSTER/SERPENTINA siguen funcionando
   igual.

## Acceptance criteria

- [ ] `/juego/linea-de-fuego/jugar` renderiza el canvas del motor real
      (grilla, cañón, fichas, rocas, naves) dentro del bisel CRT, sin la
      barra de progreso falsa.
- [ ] El canvas interno es 800×600 y escala por CSS al bisel CRT sin
      distorsión (proporción 4:3 exacta).
- [ ] `←`/`→` mueven el cañón horizontalmente dentro de los límites del
      campo; `Espacio` dispara la ficha actual respetando el cooldown (no
      se puede disparar sin límite manteniendo pulsado).
- [ ] Completar una línea de 4 fichas del mismo color (horizontal,
      vertical o diagonal) suma exactamente 100 puntos y limpia esas 4
      celdas, compactando el resto de la columna hacia abajo.
- [ ] Un disparo que impacta una roca o un desalineador en vuelo lo
      destruye, suma 15 o 25 puntos respectivamente, y no coloca ninguna
      ficha en la grilla esa vez.
- [ ] Una roca que llega a una columna llena, o un desalineador no
      destruido, resta exactamente 1 vida al colisionar con el cañón.
- [ ] Al menos un desalineador puede recolorear una ficha ya colocada al
      cruzar su columna, de forma verificable en partida.
- [ ] La partida termina (`gameOver: true`, modal de fin de partida) al
      llegar a 0 vidas, o al quedar las 7 columnas simultáneamente llenas.
- [ ] Al resolverse todos los obstáculos de una oleada, arranca la
      siguiente automáticamente y el nivel mostrado en el HUD sube en 1;
      el desalineador solo aparece a partir del nivel 2.
- [ ] El HUD de React (Puntuación, Vidas, Nivel) refleja en tiempo real el
      estado reportado por `onUpdate`.
- [ ] PAUSA detiene el movimiento manteniendo el último fotograma visible;
      REANUDAR continúa exactamente donde quedó.
- [ ] Guardar puntuación desde el modal de fin de partida inserta una fila
      real en `scores` vía `useSession().saveScore`, sin cambios en
      `lib/session.tsx`.
- [ ] "JUGAR DE NUEVO" reinicia por completo el motor vía `reset()`
      (grilla vacía, cañón centrado, score/vidas/nivel iniciales), sin
      recargar la página.
- [ ] `/juego/linea-de-fuego` y `/salon-de-la-fama` (pestaña LÍNEA DE
      FUEGO) muestran puntuaciones reales guardadas, con `games.best` /
      `games.plays` actualizados por el trigger `bump_game_stats()`.
- [ ] `linea-de-fuego` aparece en `REAL_GAMES` en
      `components/real-game-registry.tsx`.
- [ ] Los demás juegos del catálogo sin motor real siguen mostrando la
      simulación falsa sin cambios.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** la misma ficha disparada sirve para dos propósitos (destruir un
  obstáculo en vuelo o colocarse en la grilla) — traduce literalmente la
  mecánica core impuesta ("disparar/esquivar por oleadas" + "lanza fichas
  hacia la grilla") en una única acción con doble uso, en vez de separar
  "disparo de combate" y "lanzamiento de ficha" en dos botones distintos.
- **Sí:** toda pieza (ficha disparada desde abajo o roca caída desde
  arriba) se asienta en la celda vacía más baja de su columna — misma
  regla de gravedad estilo Conecta 4 para ambas direcciones de entrada;
  evita dos sistemas de físicas distintos y hace que "dejar crecer la
  pila" sea un riesgo real (una columna llena deja pasar rocas de largo
  hacia el cañón).
- **Sí:** color de la ficha actual asignado al azar (sin cola de
  "siguientes" ni elección manual) — simplifica el control a solo
  apuntar/disparar, consistente con el resto del catálogo (ningún motor
  real existente pide al jugador elegir entre opciones antes de actuar).
- **Sí:** las rocas nunca se eliminan por una línea de color (no tienen
  color) y solo se destruyen si se disparan antes de aterrizar — una vez
  asentadas son permanentes, dando peso real a la decisión de
  interceptarlas o dejarlas pasar.
- **Sí:** el desalineador aparece desde el nivel 2, no desde el inicio —
  da al jugador una oleada de aprendizaje centrada solo en apuntar/
  disparar/alinear antes de introducir la amenaza que además puede
  arruinar una línea casi completa.
- **Sí:** escalado de dificultad por oleadas: `5 + nivel*2` obstáculos por
  oleada, con intervalo de aparición decreciente y velocidad de caída
  creciente por nivel; el nivel avanza solo al resolver toda la oleada
  actual (destruidos, asentados o pasados) — mismo criterio de oleadas
  automáticas ya usado en el resto del catálogo con motor real.
- **Sí:** vidas fijas en 3, perdidas solo por colisión directa con el
  cañón (roca desbordada o desalineador no destruido) — la grilla llena
  es una segunda condición de derrota independiente (desbordamiento
  estilo top-out), para que "no limpiar líneas" tenga una consecuencia
  aparte de perder vidas.
- **Sí:** grilla 7×6 con canvas fijo 800×600 — proporción clásica de
  Conecta 4 que además cabe cómoda en el CRT 4:3 sin letterbox, mismo
  criterio que ROCAS/CAÍDA/BLOQUE BUSTER/SERPENTINA.
- **Sí:** todo dibujado con primitivas de canvas (círculos para fichas,
  rectángulos/degradados para rocas y naves), sin sprites — no hay ningún
  asset provisto para esta game jam (a diferencia de SERPENTINA, que sí
  tenía `fruits.png`); mantiene el motor autocontenido.
- **Sí:** fila nueva en `games` vía migración (Caso B) con `cat=SHOOTER`,
  `color=cyan` — impuestos por el encargo de esta propuesta concreta.
- **No:** modo dos jugadores o versus real — aunque el cuatro en raya es
  clásicamente de 2 jugadores, el encargo fija categoría `SHOOTER` (un
  jugador contra oleadas), no `VERSUS`.
- **No:** cola de "siguientes fichas" ni power-ups — fuera del alcance
  mínimo jugable de esta propuesta; se podría añadir en un spec futuro si
  se aprueba el juego.
- **No:** multiplicador de combo más allá de sumar 100 por línea
  encontrada — mantiene el sistema de puntos legible y verificable sin
  añadir una fórmula extra que decidir.
- **No:** sonido, controles táctiles/de ratón — ningún motor real
  existente en el catálogo los usa hoy.
- **No:** cambios al HUD genérico de React ni a las pantallas de detalle o
  salón de la fama — el leaderboard ya es genérico por `game_id` desde
  SPEC 06/07.

## What is **not** in this spec

- Modo versus/dos jugadores, cola de siguientes fichas, elección manual de
  color, power-ups o multiplicadores de combo.
- Jefes de fin de oleada o cualquier condición de victoria/final del
  juego.
- Sonido y controles táctiles/de ratón.
- Sprites o imágenes para fichas/rocas/naves — se dibuja todo con
  primitivas de canvas.
- Cambios al HUD genérico de React, a `app/juego/[id]/page.tsx`, a
  `app/juego/[id]/jugar/page.tsx` o a
  `components/salon-de-la-fama-client.tsx`.
- Cambios de esquema en `games` o `scores` más allá de la fila nueva
  insertada para este juego.
- Las otras dos propuestas de esta misma game jam.

Cada uno de estos, si se implementa, va en su propio spec.
