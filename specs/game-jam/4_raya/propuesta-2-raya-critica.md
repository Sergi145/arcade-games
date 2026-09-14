> **Estado del game jam:** Descartada el 2026-09-14 — se eligió "Raya Veloz" (specs/12-raya-veloz.md) en su lugar.

# SPEC (game-jam) — RAYA CRÍTICA

> **Status:** Draft
> **Depends on:** Ninguno
> **Date:** 2026-09-14
> **Objective:** Añadir "RAYA CRÍTICA", un puzzle de cuatro en raya donde el jugador recibe tableros ya semi-llenos y debe forzar tantas líneas propias como pueda con un número limitado de fichas y un cronómetro que se agota, encadenando bonificaciones cuando una jugada desencadena varias líneas por efecto de gravedad.

## Por qué existe este spec

Los 4 motores reales actuales (ROCAS, CAÍDA, BLOQUE BUSTER, SERPENTINA) son reflejos/refactors de mecánicas de arcade clásicas de reacción o de piezas cayendo. Ninguno usa el campo `lives` del contrato `RealGameState` con un significado real más allá de "0 fijo" (CAÍDA, BLOQUE BUSTER) o "vidas por colisión" (ROCAS). RAYA CRÍTICA es una propuesta de la categoría PUZZLE con una mecánica distinta a las ya implementadas: no hay piezas cayendo en tiempo real ni movimiento continuo, sino **gestión de un recurso finito bajo presión** sobre un tablero que ya no está vacío al empezar. Esto también le da un uso genuino al campo `lives` (número de tableros/intentos disponibles) sin inventar un campo nuevo en `RealGameState`.

Esta es la propuesta 2 de 3 generadas en paralelo para el tema "cuatro en raya" (ver `specs/game-jam/2026-09-14-cuatro-en-raya/`); si se elige, se promociona a `specs/NN-raya-critica.md` como Draft pendiente de aprobación humana antes de `/spec-impl`, siguiendo el flujo del agente `game-jam` descrito en `CLAUDE.md`.

## Scope

**In:**

- Motor real nuevo (`lib/raya-critica-engine.ts`) construido desde cero (no porta nada de `references/started-games/`), factoría `createRayaCriticaEngine(canvas, { onUpdate })`.
- Tablero clásico de cuatro en raya, 7 columnas × 6 filas (42 celdas), con gravedad por columna (una ficha siempre cae hasta la celda libre más baja de su columna).
- Generación procedural de tableros **semi-llenos** al inicio de cada intento: mezcla de fichas neutras/grises (obstáculos estáticos, sin IA ni segundo jugador) y huecos, respetando la gravedad (ninguna celda ocupada puede "flotar" sobre un hueco), con una garantía mínima de solvabilidad (ver Decisiones).
- Inventario de **fichas propias limitado** por intento (empieza en 8 en el nivel 1, baja con la dificultad, mínimo 4) que se consume una por una al colocar.
- **Cronómetro por intento** que cuenta atrás en paralelo al inventario de fichas (empieza en 40s en el nivel 1, baja con la dificultad, mínimo 15s); el intento termina en cuanto se agota cualquiera de los dos recursos (fichas o tiempo), lo que ocurra primero.
- Detección de líneas de 4 en raya del color del jugador (horizontal, vertical, diagonal) tras cada ficha colocada; al detectarse, esas fichas se eliminan del tablero y las de encima caen por gravedad (efecto cascada), pudiendo formar nuevas líneas automáticamente sin gastar fichas adicionales — cada eslabón de esa reacción en cadena suma con un multiplicador creciente.
- Bonificación adicional si una sola ficha colocada completa **varias líneas a la vez** (no por cascada, sino en el mismo instante de colocarla).
- Progresión de nivel: cada intento resuelto con al menos 1 línea forzada es un "tablero superado" (nivel += 1, siguiente tablero más difícil); un intento sin ninguna línea forzada resta una vida y repite un tablero nuevo de la misma dificultad.
- Vidas iniciales: 3. `gameOver: true` cuando se agotan.
- Controles de teclado: `←`/`→` mueven el selector de columna, `Espacio` (o `↓`) suelta la ficha en la columna seleccionada. Sin mouse.
- Canvas interno 800×600 (misma convención que ROCAS/CAÍDA/BLOQUE BUSTER) con el tablero centrado y un panel lateral dibujado en el propio canvas mostrando "FICHAS" y "TIEMPO" restantes (el HUD genérico de React solo expone Puntuación/Vidas/Nivel).
- Componente `components/raya-critica-canvas.tsx` calcado del patrón de `components/rocas-canvas.tsx`.
- Registro `"raya-critica": RayaCriticaCanvas` en `components/real-game-registry.tsx`.
- Fila nueva en la tabla `games` (Supabase): `id: "raya-critica"`, `title: "RAYA CRÍTICA"`, `cat: "PUZZLE"`, `color: "yellow"`, `cover: "cover-raya"` (clase CSS nueva en `app/globals.css`, mismo patrón que `.cover-tetro`/`.cover-snake`), `best: 0`, `plays: 0`.

**Out of scope (para specs futuros):**

- Cualquier forma de oponente real (IA o segundo jugador) que coloque fichas activamente — esto es PUZZLE en solitario, no VERSUS; las fichas neutras del tablero inicial son obstáculos estáticos, nunca un rival que juega.
- Controles táctiles/móviles o soporte de mouse/click directo sobre columnas.
- Persistencia de progreso entre sesiones (niveles guardados, reanudar partida) — cada partida empieza desde el nivel 1 con 3 vidas, igual que los demás motores reales.
- Sonido/música.
- Dificultad configurable por el jugador (velocidad, tamaño de tablero) — la progresión de dificultad es automática y fija por nivel.
- Animaciones de partículas o efectos visuales avanzados más allá de resaltar la columna seleccionada y las líneas que se limpian.
- Modo diario/semanal o semillas compartibles de tablero.
- Cambios a `components/jugar-client.tsx`, `app/juego/[id]/page.tsx`, `components/salon-de-la-fama-client.tsx` o `lib/session.tsx` — el juego se integra solo vía `REAL_GAMES`.

## Data model

Este spec no introduce persistencia nueva: reutiliza la fila de `games` en Supabase (mismo shape sembrado por SPEC 05/07) y el tipo `RealGameState` ya generalizado en `components/real-game-registry.tsx` desde SPEC 08:

```ts
// components/real-game-registry.tsx (sin cambios de forma, solo una entrada nueva)
export type RealGameState = {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
};

export const REAL_GAMES: Record<string, ComponentType<RealGameProps>> = {
  rocas: RocasCanvas,
  caida: CaidaCanvas,
  "bloque-buster": BloqueBusterCanvas,
  serpentina: SerpentinaCanvas,
  "raya-critica": RayaCriticaCanvas,
};
```

Mapeo de `RealGameState` para este juego:

- `score`: puntos acumulados por líneas forzadas + bonos de cascada/multi-línea, a través de toda la partida (todos los tableros).
- `lives`: intentos restantes (empieza en 3; se resta 1 cada vez que un intento termina sin forzar ninguna línea).
- `level`: número de tablero actual (empieza en 1; sube 1 cada vez que un intento se resuelve con ≥1 línea forzada).
- `gameOver`: `true` cuando `lives` llega a 0.

Estado interno del motor (no expuesto a React, solo para ilustrar la forma que necesita el generador de tableros y el bucle de cascada):

```ts
// lib/raya-critica-engine.ts (forma ilustrativa, no persistida)
type Cell = "empty" | "player" | "neutral";

type BoardState = {
  grid: Cell[][]; // 6 filas x 7 columnas, grid[0] = fila inferior
  fichasRestantes: number;
  tiempoRestanteMs: number;
  cadenaActual: number; // eslabón de cascada en curso, 0 si no hay cascada activa
};

type RunState = {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
  board: BoardState;
  selectedColumn: number; // 0-6, columna resaltada por el selector
};
```

## Implementation plan

1. **Identidad del juego (Paso 1 del skill `add-arcade-game`).** Confirmar que `raya-critica` no existe en `games` (Caso B: juego nuevo). Preparar la migración con `mcp__supabase__apply_migration` para insertar la fila (`id: "raya-critica"`, `title: "RAYA CRÍTICA"`, `short`/`long` en español tono arcade, `cat: "PUZZLE"`, `color: "yellow"`, `cover: "cover-raya"`, `best: 0`, `plays: 0`). Añadir la clase `.cover-raya` en `app/globals.css` junto a `.cover-tetro`/`.cover-snake` (mismo patrón: `.cover-bg` base + gradiente/`::after` propio, en tono amarillo). El sistema sigue funcional: el catálogo muestra la portada nueva con la simulación falsa todavía activa.
2. **Motor: tablero y generación procedural (`lib/raya-critica-engine.ts`, parte 1).** Implementar la factoría `createRayaCriticaEngine(canvas, { onUpdate })` con el estado del Data model, la rejilla 7×6, la función de generación de tablero semi-lleno con garantía de solvabilidad (ver Decisiones) parametrizada por nivel (fichas iniciales, tiempo inicial, % de relleno neutro), y el dibujado estático del tablero + panel lateral "FICHAS"/"TIEMPO" en el canvas 800×600. Verificación: el archivo compila sin errores de tipos; aún no se usa desde ningún componente.
3. **Motor: input, caída con gravedad y detección de líneas (parte 2).** Añadir el bucle `requestAnimationFrame` con `dt` capado a 0.05s, los listeners de teclado (`←`/`→`/`Espacio`/`↓`) registrados y limpiados dentro de la factoría, la lógica de soltar ficha (cae a la celda libre más baja de la columna seleccionada, resta 1 ficha), la detección de líneas de 4 en raya del color del jugador en las 4 direcciones, y el conteo regresivo del cronómetro cada frame. Verificación: en consola/manualmente se puede colocar una ficha y ver el tablero actualizarse; el archivo sigue sin conectarse a React.
4. **Motor: cascada, bonificaciones y progresión (parte 3).** Implementar el bucle de resolución de cascada (limpiar línea → aplicar gravedad a las columnas afectadas → volver a comprobar líneas → repetir mientras aparezcan nuevas, multiplicando la puntuación por el eslabón de cadena), el bono de multi-línea simultánea, y el cierre de intento (fichas=0 o tiempo=0): si se forzó ≥1 línea, `level += 1` y nuevo tablero más difícil; si no, `lives -= 1` y nuevo tablero de la misma dificultad, o `gameOver: true` si `lives` llega a 0. Exponer `pause()` (congela el cronómetro y el input, sigue dibujando el último fotograma), `resume()`, `reset()` (vuelve a nivel 1, 3 vidas, score 0), `forceGameOver()` y `destroy()` (cancela el frame pendiente y quita los listeners). Verificación: tipos concretos, build sigue pasando, el motor es jugable desde un arnés de prueba manual (por ejemplo un `console.log` temporal de `onUpdate`) aunque todavía no está montado en una página real.
5. **Componente cliente (`components/raya-critica-canvas.tsx`, Paso 4 del skill).** Calcar `components/rocas-canvas.tsx`: mismo `useEffect` de montaje/desmontaje que crea y destruye el engine sobre el `<canvas>`, mismo `useImperativeHandle` reexponiendo `pause/resume/reset/forceGameOver`, mismo `onUpdateRef`. Solo cambia el import a `createRayaCriticaEngine` y el tipado a `RealGameState`. Verificación: se importa sin errores de tipos, aún no conectado al registro.
6. **Registro (Paso 5 del skill).** Añadir `"raya-critica": RayaCriticaCanvas` a `REAL_GAMES` en `components/real-game-registry.tsx`. Verificación: compila e importa correctamente; `/juego/raya-critica/jugar` ya renderiza el motor real en vez de la simulación falsa.
7. **Verificación final (Paso 6 del skill).** `npm run lint` y `npm run build` sin errores. Manual en `/juego/raya-critica/jugar`: mover el selector, soltar fichas, forzar una línea y ver la puntuación subir, provocar una cascada de al menos 2 eslabones y ver el multiplicador aplicado, agotar las fichas sin forzar ninguna línea y ver que resta una vida y aparece un tablero nuevo, agotar el cronómetro y comprobar el mismo efecto, perder las 3 vidas y ver el modal de fin de partida, guardar la puntuación con un nombre, y confirmar que `/juego/raya-critica` y `/salon-de-la-fama` (pestaña RAYA CRÍTICA) muestran esa puntuación real.

## Acceptance criteria

- [ ] `/juego/raya-critica/jugar` carga el motor real (no la barra de progreso falsa) sin errores en consola.
- [ ] El tablero inicial de cada intento nunca está vacío: siempre trae una mezcla de fichas neutras y huecos respetando la gravedad por columna.
- [ ] Cada tablero generado es forzable: existe al menos una línea de 4 en raya alcanzable con el número de fichas y el tiempo dados en ese intento.
- [ ] Forzar una línea de 4 en raya suma puntos de forma verificable y elimina esas fichas del tablero.
- [ ] Una cascada de 2+ eslabones (una línea limpiada provoca, por gravedad, una segunda línea sin ficha adicional) suma más puntos que una línea aislada del mismo nivel.
- [ ] Completar 2+ líneas con la misma ficha colocada otorga una bonificación adicional respecto a completar solo 1.
- [ ] El inventario de fichas y el cronómetro del intento se muestran en el panel lateral del canvas y ambos disminuyen en tiempo real.
- [ ] Agotar las fichas sin forzar ninguna línea resta exactamente 1 vida y genera un tablero nuevo de la misma dificultad.
- [ ] Agotar el cronómetro sin forzar ninguna línea tiene el mismo efecto que agotar las fichas.
- [ ] Resolver un intento con al menos 1 línea forzada incrementa el nivel en 1 y genera un tablero con más dificultad (menos fichas y/o menos tiempo y/o más relleno inicial).
- [ ] Perder la tercera vida deja `gameOver: true` y dispara el modal de fin de partida de `components/jugar-client.tsx` sin cambios en esa pantalla.
- [ ] Guardar puntuación desde el modal invoca `useSession().saveScore` igual que en los demás juegos.
- [ ] `raya-critica` aparece en `REAL_GAMES` (`components/real-game-registry.tsx`) y en la tabla `games` de Supabase.
- [ ] `/juego/raya-critica` y `/salon-de-la-fama` muestran la puntuación real guardada, con `games.best`/`games.plays` actualizados por el trigger de SPEC 07.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** tablero clásico 7×6 (42 celdas) en vez de un tamaño reducido — es la proporción reconocible de "cuatro en raya" y deja espacio suficiente para que la generación semi-llena tenga variedad real.
- **Sí:** dos recursos de presión independientes (fichas Y cronómetro), tal como pide la restricción de esta propuesta, en vez de fundirlos en uno solo — crea dos formas distintas de fallar un intento (quedarse sin fichas pensando demasiado, o quedarse sin tiempo indeciso), lo que da más textura táctica que un único contador.
- **Sí:** las fichas pre-colocadas del tablero inicial son neutras/estáticas (sin IA ni segundo jugador) — mantiene el juego dentro de PUZZLE; un tablero con un rival que también coloca fichas sería más VERSUS o SHOOTER-adyacente y excede el alcance de esta propuesta.
- **Sí:** generación procedural con garantía mínima de solvabilidad: el generador primero siembra 2-3 "líneas potenciales" (3 fichas propias alineadas con la 4ª celda vacía y alcanzable dentro del presupuesto de fichas del intento) y solo después rellena el resto del tablero al azar con fichas neutras respetando la gravedad. Esto asegura que ningún intento sea matemáticamente imposible, sin necesitar un solver completo (excesivo para un motor de canvas). La semilla aleatoria por intento (nivel + `Math.random()`) da rejugabilidad: dos partidas nunca ven la misma secuencia de tableros.
- **Sí:** dificultad progresiva por fórmula simple y determinista (fichas: `max(4, 8 - floor(nivel/2))`; tiempo: `max(15000, 40000 - (nivel-1)*3000)` ms; % de relleno neutro creciente con el nivel) — fácil de verificar en el checklist de aceptación y consistente con cómo CAÍDA deriva su velocidad de caída por nivel.
- **Sí:** multiplicador de cascada por eslabón (`puntosBase × eslabón`) y bono de multi-línea simultánea aparte — recompensa explícitamente la mecánica pedida ("encadenar bonificaciones si logra varias líneas con las mismas fichas colocadas"), y son dos bonos distintos y verificables por separado en el checklist.
- **Sí:** un intento sin ninguna línea forzada repite tablero de la misma dificultad en vez de bajar de nivel — evita que perder una vida también deshaga progreso de dificultad ya alcanzado, y mantiene la presión sin castigar doblemente.
- **No:** otorgar fichas extra como premio de cascada — se decidió premiar solo con puntuación (y no con más fichas) para que el inventario siga siendo estrictamente finito por intento; complicar el presupuesto de fichas a mitad de intento diluiría la tensión de "recurso bajo presión" que pide esta propuesta.
- **No:** controles de mouse/click sobre columnas — se mantiene el patrón de teclado ya usado por los 4 motores reales existentes, sin introducir un segundo esquema de input.
- **No:** persistencia de nivel/progreso entre partidas — cada partida nueva empieza en nivel 1 con 3 vidas y score 0, igual que ROCAS/CAÍDA/BLOQUE BUSTER/SERPENTINA.

## Risks

| Riesgo                                                                                                              | Mitigación                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El generador de tableros podría, por un error en la siembra de líneas potenciales, producir un tablero no resoluble | Cubrir la función de generación con una comprobación determinista antes de aceptar el tablero (repetir la siembra si no queda al menos 1 línea alcanzable con las fichas dadas), documentada en el paso 2 del plan. |
| El bucle de resolución de cascada podría entrar en un ciclo largo o costoso en tableros muy llenos en niveles altos | Acotar la cascada a un máximo razonable de eslabones por jugada (p. ej. 10) y limitar el % de relleno neutro máximo por nivel, evitando spirals de cálculo en un frame.                                             |
| Confundir visualmente las fichas neutras/grises con las del jugador en el CRT de baja resolución                    | Usar contraste alto: fichas propias en amarillo neón (`--yellow`) y neutras en un gris apagado claramente distinto, con el mismo lenguaje visual pixel/neón del resto del sitio.                                    |

## What is **not** in this spec

- Un oponente real (IA o segundo jugador) que coloque fichas — sigue siendo un puzzle en solitario.
- Controles táctiles/móviles.
- Persistencia de progreso entre sesiones o dificultad configurable por el jugador.
- Sonido, música o animaciones de partículas avanzadas.
- Modo diario/semanal o semillas de tablero compartibles.
- Cambios a `components/jugar-client.tsx`, `app/juego/[id]/page.tsx`, `components/salon-de-la-fama-client.tsx` o `lib/session.tsx`.

Cada uno de estos, si se implementa, va en su propio spec.
