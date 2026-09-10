# SPEC 08 — Motor real de Tetris en "CAÍDA"

> **Status:** Implemented
> **Depends on:** SPEC 04
> **Date:** 2026-09-10
> **Objective:** Portar el motor real de Tetris (`references/started-games/03-tetris/game.js`) a TypeScript e integrarlo en `/juego/caida/jugar`, reemplazando la simulación falsa de ese juego por gameplay real, generalizando primero el tipo de estado compartido para que deje de estar acoplado a ROCAS.

## Por qué existe este spec

SPEC 04 conectó el primer motor real (Asteroids → ROCAS) dejando explícitamente fuera de alcance "la mecánica real de los otros 7 juegos", entre ellos `caida`, y dejó listo el registro extensible `REAL_GAMES` para que un spec futuro añada el siguiente sin volver a tocar la página del Reproductor. `caida` ya tiene fila real en la tabla `games` (`title: "CAÍDA"`, `cat: PUZZLE`, `cover: cover-tetro`, `color: magenta`) y un motor de referencia completo en `references/started-games/03-tetris/`. Este spec es el segundo juego en dejar de ser una simulación falsa, y de paso resuelve una deuda de tipos: hoy `RocasEngineState` está importado directamente por `rocas-canvas.tsx` y `jugar-client.tsx`, acoplando el HUD genérico de React al motor de ROCAS específicamente.

## Scope

**In:**

- Refactor previo de tipos (sin cambio de comportamiento): `RealGameState` se define y exporta desde `components/real-game-registry.tsx`; `lib/rocas-engine.ts` reexporta `RocasEngineState` como alias de `RealGameState`; `components/rocas-canvas.tsx` y `components/jugar-client.tsx` pasan a tipar contra `RealGameState` en vez de `RocasEngineState`. Verificado sin cambiar el comportamiento de `/juego/rocas/jugar`.
- Motor real de Tetris portado a TypeScript (`lib/caida-engine.ts`), con paridad de mecánicas frente a `references/started-games/03-tetris/game.js`: tablero 10×20, las 8 piezas del original (incluida la "N"/tuerca gris), rotación con wall-kicks `[0,-1,1,-2,2]`, soft drop (+1/fila) y hard drop (+2/celda), pieza fantasma (ghost) semitransparente, limpieza de líneas con `LINE_SCORES = [0,100,300,500,800] × nivel`, velocidad de caída `max(100, 1000 - (nivel-1)×90)` ms, y nivel derivado como `floor(líneas/10)+1`.
- El motor reporta a React vía `callbacks.onUpdate({ score, lives: 0, level, gameOver })` cada frame — `lives` siempre `0` (Tetris no tiene vidas; el HUD genérico ya renderiza `"—"` cuando `lives=0`).
- Canvas interno fijo en 800×600 (igual convención que ROCAS): tablero 10×20 dibujado centrado en la mitad izquierda/central, y un panel lateral dibujado dentro del mismo canvas (no HTML/CSS aparte) con "SIGUIENTE" (preview 4×4 de la próxima pieza) y "LÍNEAS" (contador), ya que el HUD genérico de React (`components/jugar-client.tsx`) solo expone Puntuación/Vidas/Nivel y este spec no lo modifica.
- Controles de teclado: `←`/`→` mover, `↑` o `X` rotar (con wall-kick), `↓` soft drop, `Espacio` hard drop (con `preventDefault` para las 4 teclas, evitando scroll de página). Sin tecla `P` de pausa dentro del motor — la pausa es responsabilidad exclusiva del botón PAUSA/REANUDAR de React, vía `pause()/resume()` del handle, igual que en ROCAS.
- El motor expone el mismo contrato `RealGameHandle` que ROCAS: `pause()`, `resume()`, `reset()`, `forceGameOver()`, `destroy()` — sin HUD ni overlays de pausa/game-over dibujados en el canvas (los del original se eliminan; React ya los renderiza).
- Componente cliente `components/caida-canvas.tsx`, calcado del patrón de `components/rocas-canvas.tsx`.
- Registro: se añade `"caida": CaidaCanvas` a `REAL_GAMES` en `components/real-game-registry.tsx`.

**Out of scope (para specs futuros):**

- Mecánica real de los 6 juegos restantes (`bloque-buster`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Controles táctiles/móviles — el motor de referencia solo soporta teclado, igual que se decidió para ROCAS en SPEC 04.
- Cambios a los metadatos del juego `caida` en la tabla `games` (título, descripción, portada, color) — ya tiene fila real y no se toca.
- Cambios al HUD genérico de React (`components/jugar-client.tsx`) para añadir un slot dedicado a "líneas" o "siguiente pieza" — se resuelven dibujándolos dentro del propio canvas del motor, sin tocar esa pantalla.
- El toggle de tema claro/oscuro del `index.html` de referencia — el sitio ya tiene su propio tema, no se porta.
- Persistencia de puntuaciones — sigue usando `useSession().saveScore` (Supabase, SPEC 06) sin cambios.

## Data model

No se introduce persistencia nueva. Se generaliza el tipo de estado del motor y se añade el motor de Tetris:

```ts
// components/real-game-registry.tsx
export type RealGameState = {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
};

export const REAL_GAMES: Record<string, ComponentType<RealGameProps>> = {
  rocas: RocasCanvas,
  caida: CaidaCanvas,
};
```

```ts
// lib/caida-engine.ts
export type CaidaEngineCallbacks = {
  onUpdate: (state: RealGameState) => void;
};

export type CaidaEngineHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  destroy: () => void;
};

export function createCaidaEngine(
  canvas: HTMLCanvasElement,
  callbacks: CaidaEngineCallbacks,
): CaidaEngineHandle;
```

## Implementation plan

1. Generalizar el tipo de estado: definir y exportar `RealGameState` en `components/real-game-registry.tsx`; en `lib/rocas-engine.ts`, cambiar `RocasEngineState` para que sea un alias (`export type RocasEngineState = RealGameState`); actualizar `components/rocas-canvas.tsx` y `components/jugar-client.tsx` para importar y tipar contra `RealGameState`. Verificación: `npm run build` pasa y `/juego/rocas/jugar` se comporta exactamente igual que antes (paso 0 del skill `add-arcade-game`).
2. Crear `lib/caida-engine.ts`: portar el tablero, las 8 piezas, rotación con wall-kicks, colisión, `clearLines`, ghost piece, soft/hard drop y la progresión de velocidad/nivel del original a una factory `createCaidaEngine(canvas, callbacks)` con todo el estado en el cierre de la instancia (sin variables de módulo compartidas). Verificación: el archivo compila sin errores de tipos, aún no se usa desde ningún componente.
3. Dentro del motor: eliminar cualquier acceso al DOM del original (`#score`, `#lines`, `#level`, `#next-canvas`, `#overlay`, `theme-toggle`) y dibujar en su lugar, sobre el mismo `<canvas>` de 800×600, el tablero centrado más un panel lateral con "SIGUIENTE" (preview 4×4) y "LÍNEAS" en el estilo pixel/neón del sitio (`var(--cyan)`/`var(--magenta)`, fuente monospace). Invocar `callbacks.onUpdate({ score, lives: 0, level, gameOver })` cada frame. Implementar `pause()`/`resume()` (deja de avanzar `update(dt)` pero sigue dibujando el último fotograma), `reset()` (equivalente a `init()` del original), `forceGameOver()` (transición directa a `gameOver: true` con el score actual) y `destroy()` (cancela el frame pendiente y remueve los listeners de teclado de esa instancia). Verificación: tipos concretos, build sigue pasando.
4. Crear `components/caida-canvas.tsx` calcado de `components/rocas-canvas.tsx`: mismo `useEffect` de montaje/desmontaje, mismo `useImperativeHandle`, mismo `onUpdateRef`; solo cambia el import a `createCaidaEngine`. Verificación: se importa sin errores de tipos, aún no conectado al registro.
5. Añadir `caida: CaidaCanvas` a `REAL_GAMES` en `components/real-game-registry.tsx`. Verificación: compila e importa correctamente.
6. `npm run lint` y `npm run build`, y probar manualmente en `/juego/caida/jugar`: mover/rotar (con wall-kick)/soft drop/hard drop, ver el preview de la siguiente pieza y el contador de líneas actualizarse, subir de nivel cada 10 líneas, topar el tablero y ver el modal de fin de partida, PAUSA/REANUDAR, FIN, guardar puntuación con nombre, "JUGAR DE NUEVO", y confirmar que `/juego/caida` y `/salon-de-la-fama` muestran esa puntuación real. Confirmar también que `/juego/rocas/jugar` sigue funcionando igual tras el refactor de tipos del paso 1, y que los 6 juegos restantes siguen con la simulación falsa intacta. Verificación: los criterios de aceptación siguientes se cumplen y ambos comandos terminan sin errores.

## Acceptance criteria

- [x] `RealGameState` vive en `components/real-game-registry.tsx`; `RocasEngineState` es un alias del mismo tipo; `rocas-canvas.tsx` y `jugar-client.tsx` ya no importan un tipo específico de ROCAS.
- [x] `/juego/rocas/jugar` funciona exactamente igual que antes de este spec (el refactor de tipos no cambia comportamiento).
- [x] `/juego/caida/jugar` renderiza el canvas del motor real dentro del bisel CRT: tablero 10×20 centrado, panel lateral con "SIGUIENTE" (preview de pieza) y "LÍNEAS", pieza fantasma, y las 8 piezas del original incluida la "N".
- [x] El canvas interno es 800×600 y escala por CSS al bisel CRT sin distorsión (proporción 4:3 preservada), igual que ROCAS.
- [x] El HUD de React (Puntuación, Nivel) refleja en tiempo real el estado del motor; "Vidas" muestra `"—"` de forma constante (motor reporta `lives: 0`).
- [x] Rotar cerca de un borde o de otras piezas aplica wall-kicks `[0,-1,1,-2,2]` igual que el original.
- [x] La velocidad de caída aumenta y el nivel sube cada 10 líneas, siguiendo `max(100, 1000-(nivel-1)×90)` ms.
- [x] El botón PAUSA detiene la caída y el input manteniendo el último fotograma visible bajo el overlay "EN PAUSA" de React; REANUDAR continúa exactamente donde quedó. No existe tecla `P` de pausa dentro del motor.
- [x] El botón FIN dispara el modal de fin de partida con la puntuación acumulada, sin reiniciar el motor.
- [x] Al topar una pieza nueva contra el tablero lleno (game over natural del original), aparece el modal de fin de partida con la puntuación final real.
- [x] Guardar puntuación desde el modal invoca `useSession().saveScore` igual que en los demás juegos, sin cambios en `lib/session.tsx`.
- [x] "JUGAR DE NUEVO" reinicia por completo el motor (tablero, score, líneas, nivel) vía `reset()`, sin recargar la página.
- [x] SALIR navega a `/juego/caida` y desmonta el motor limpiamente, sin listeners de teclado ni `requestAnimationFrame` colgando.
- [x] `/juego/caida` y `/salon-de-la-fama` (pestaña CAÍDA) muestran puntuaciones reales guardadas, con el trigger `bump_game_stats()` de SPEC 07 actualizando `games.best`/`games.plays` para `caida`.
- [x] Los 6 juegos restantes sin motor real siguen mostrando la simulación falsa sin cambios.
- [x] La tabla `games`, la fila de `caida` y `lib/games.ts` no cambian.
- [x] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** generalizar `RocasEngineState` → `RealGameState` antes de portar el segundo motor — decidido explícitamente (paso 0 del skill `add-arcade-game`); evita que el código nuevo tenga que importar un tipo llamado "Rocas" para tipar un motor de Tetris.
- **Sí:** canvas interno 800×600 con tablero centrado y panel lateral (SIGUIENTE + LÍNEAS) dibujado dentro del propio canvas, en vez de estirar la resolución vertical original (300×600) a 4:3 — decidido explícitamente en la fase de preguntas; evita distorsionar los bloques y reutiliza la misma convención de resolución que ROCAS.
- **Sí:** mantener el contador de LÍNEAS y el preview de SIGUIENTE pieza, dibujados en canvas — decidido explícitamente; mismo criterio de paridad de mecánicas que SPEC 04 ("sin recortar mecánicas"), sin tocar el HUD genérico de React.
- **Sí:** `lives` se reporta siempre como `0` (Tetris no tiene concepto de vidas) — decidido explícitamente; el HUD genérico ya soporta este caso mostrando `"—"`.
- **Sí:** nivel reutilizado tal cual del original (`floor(líneas/10)+1`) — decidido explícitamente, mismo criterio que indica el skill para juegos que ya traen su propio cálculo de nivel.
- **Sí:** sin tecla `P` de pausa dentro del motor, solo el botón PAUSA/REANUDAR de React — decidido explícitamente en la fase de preguntas; consistente con ROCAS y con la decisión de SPEC 04 de evitar dos rutas de control desincronizadas (mismo motivo usado allí para desactivar el reinicio automático por Espacio).
- **No:** controles táctiles/móviles, cambios a metadatos de `caida` en la tabla `games`, cambios al HUD genérico de React, o persistencia distinta a `useSession().saveScore` — mismos motivos que SPEC 04: este spec solo reemplaza la simulación de partida por el motor real.

## Risks

| Riesgo                                                                                                                                                                                    | Mitigación                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El panel lateral (SIGUIENTE + LÍNEAS) dibujado en canvas duplica visualmente parte de lo que ya hace el HUD de React (Puntuación/Nivel), pudiendo verse inconsistente en tipografía/color | Aceptado para este spec: se usa el mismo lenguaje visual (pixel/neón, `var(--cyan)`/`var(--magenta)`) del resto del sitio; unificar ambos paneles en un único sistema de HUD queda para un spec futuro si se decide dar a cada motor un slot de HUD extensible. |
| El refactor de tipos del paso 1 (`RocasEngineState` → alias de `RealGameState`) podría introducir una regresión silenciosa en ROCAS si algún import se rompe sin que TypeScript lo marque | Mitigado verificando manualmente `/juego/rocas/jugar` de punta a punta tras el refactor, antes de escribir una sola línea del motor de Tetris (paso 1 del plan de implementación).                                                                              |
| Escalar el canvas 800×600 por CSS puede verse borroso en pantallas retina, igual que ya es el caso aceptado para ROCAS en SPEC 04                                                         | Aceptado, mismo riesgo ya asumido y sin mitigar en SPEC 04; no se introduce nada nuevo aquí.                                                                                                                                                                    |

## What is **not** in this spec

- Mecánica real de los 6 juegos restantes del catálogo.
- Controles táctiles/móviles.
- Cambios a los metadatos del juego `caida` en la tabla `games` o en `lib/games.ts`.
- Un slot dedicado en el HUD genérico de React para "líneas" o "siguiente pieza".

Cada uno de estos, si se implementa, va en su propio spec.
