# SPEC 04 — Motor real de Asteroids en "ROCAS"

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-09-09
> **Objective:** Portar el motor real de Asteroids (`references/started-games/02-asteroids/game.js`) a TypeScript e integrarlo en `/juego/rocas/jugar`, reemplazando la simulación falsa de ese juego por gameplay real, con el HUD y el modal de fin de partida de React sincronizados al estado del motor.

## Por qué existe este spec

SPEC 01 migró las 5 pantallas visuales del MVP con datos mock, dejando explícitamente fuera de alcance "la mecánica real de cualquiera de los 8 juegos": el Reproductor (`app/juego/[id]/jugar/page.tsx`) simula una partida con una puntuación que sube sola cada 220ms y sprites CSS estáticos. El juego `rocas` en `lib/games.ts` ("Pulveriza asteroides en gravedad cero... nave triangular... divide rocas en fragmentos cada vez más pequeños") ya tiene un motor real y completo construido aparte, en `references/started-games/02-asteroids/`. Este spec conecta ese motor real con la plataforma, siendo el primer juego de los 8 en dejar de ser una simulación falsa.

## Scope

**In:**

- Motor real de Asteroids portado a TypeScript (`lib/rocas-engine.ts`), con paridad de mecánicas frente a `references/started-games/02-asteroids/game.js`: nave con rotación/propulsor/inercia, disparo, asteroides que se dividen (grande → mediano → pequeño), wraparound toroidal, partículas de explosión, 3 vidas con invencibilidad temporal parpadeante al reaparecer, niveles progresivos, y el power-up de disparo triple existente en el motor de referencia.
- El motor expone una factory `createRocasEngine(canvas, callbacks)` sin efectos secundarios a nivel de módulo (todo el estado — teclas, nave, asteroides, etc. — vive dentro del cierre de la instancia), con controles `pause()`, `resume()`, `reset()`, `forceGameOver()`, `destroy()`, y reporta `{ score, lives, level, gameOver }` a React en cada frame vía `callbacks.onUpdate`.
- Se elimina del motor el HUD y el overlay de "GAME OVER" que dibuja sobre el propio canvas en el original, así como el reinicio automático al pulsar Espacio en el estado `gameover` — el HUD y el reinicio pasan a ser responsabilidad exclusiva de React.
- Componente cliente `components/rocas-canvas.tsx`: monta el `<canvas>`, instancia el motor en un `useEffect`, limpia con `destroy()` al desmontar, y expone sus controles y último estado reportado al componente padre.
- Registro extensible `components/real-game-registry.tsx`: mapa `{ rocas: RocasCanvas }` que la página del Reproductor usa para decidir si renderiza un juego real o la simulación falsa existente. Deja el patrón listo para que futuros specs añadan más juegos reales sin volver a tocar la página.
- Modificación de `app/juego/[id]/jugar/page.tsx`: cuando `game.id` está en el registro, renderiza el componente real dentro de `.crt-screen` en lugar de `.game-arena`, sincroniza el HUD (Puntuación/Vidas/Nivel) con el estado del motor en vez del `setInterval` falso, y conecta los botones PAUSA/REANUDAR, FIN, SALIR y "JUGAR DE NUEVO" a los controles del motor.
- Ajuste de CSS en `app/globals.css` para que el `<canvas>` llene `.crt-screen` (`width: 100%; height: 100%`), preservando la proporción 4:3 ya usada por ambos.

**Out of scope (para specs futuros):**

- Mecánica real de los otros 7 juegos (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) — cada uno se aborda en su propio spec cuando exista un motor real que portar, usando el mismo registro extensible.
- Controles táctiles/móviles para `rocas` — el motor original solo soporta teclado (`←` `→` `↑` `Espacio`); la etiqueta "TÁCTIL" en la página de Detalle es texto genérico ya existente para los 8 juegos, no una promesa funcional de este spec.
- Persistencia real de puntuaciones en Supabase — `saveScore` sigue escribiendo en `localStorage` vía `lib/session.tsx`, sin cambios. SPEC 03 conectó Supabase solo como infraestructura de plomería, sin migrar sesión ni puntuaciones.
- Leaderboard real en la página de Detalle (`app/juego/[id]/page.tsx`) o en el Salón de la Fama — ambos siguen usando `seededScores` (datos mock deterministas).
- Cambios a los metadatos del juego `rocas` en `lib/games.ts` (título, descripción, portada, dificultad, contadores de partidas).
- Sonido, efectos hápticos, o accesibilidad más allá de lo heredado del motor original.

## Data model

No se introduce persistencia nueva ni tablas de Supabase. Se introducen tipos TypeScript para la interfaz pública del motor:

```ts
// lib/rocas-engine.ts
export type RocasEngineState = {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
};

export type RocasEngineCallbacks = {
  onUpdate: (state: RocasEngineState) => void;
};

export type RocasEngineHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  destroy: () => void;
};

export function createRocasEngine(
  canvas: HTMLCanvasElement,
  callbacks: RocasEngineCallbacks,
): RocasEngineHandle;
```

```ts
// components/real-game-registry.tsx
export type RealGameProps = {
  onUpdate: (state: RocasEngineState) => void;
  // ref/callback para exponer pause/resume/reset/forceGameOver al padre
};

export const REAL_GAMES: Record<string, React.ComponentType<RealGameProps>>;
```

El guardado de puntuaciones sigue usando `SavedScore` (`lib/session.tsx`), sin cambios.

## Implementation plan

1. Crear `lib/rocas-engine.ts`: portar las clases del motor de referencia (`Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`) a TypeScript dentro de la factory `createRocasEngine(canvas, callbacks)`, sustituyendo el estado global del original (`keys`, `justPressed`, `ship`, `bullets`, etc.) por variables del cierre de cada instancia, sin ejecutar nada hasta que se llame la factory. Verificación: el archivo compila sin errores de tipos (aún no se usa desde ningún componente).
2. Dentro del motor: eliminar `drawHUD`/`drawOverlay` y el reinicio por Espacio en estado `gameover`; invocar `callbacks.onUpdate({ score, lives, level, gameOver })` en cada frame del loop; implementar `pause()`/`resume()` (saltar `update(dt)` sin dejar de dibujar el último fotograma), `reset()` (equivalente a `initGame()`), `forceGameOver()` (transición directa a `gameOver: true` con el score actual, sin animación de explosión), y `destroy()` (cancela el frame pendiente y remueve los listeners de teclado de esa instancia). Verificación: tipos concretos para `RocasEngineCallbacks`/`RocasEngineHandle`, build sigue pasando.
3. Crear `components/rocas-canvas.tsx` (client component): renderiza un `<canvas>` dentro de un contenedor que ocupe `.crt-screen`, instancia `createRocasEngine` en `useEffect` al montar, llama `destroy()` en el cleanup, y expone `pause/resume/reset/forceGameOver` junto con el último `RocasEngineState` recibido al componente padre. Verificación: se importa sin errores de tipos; aún no está conectado a la página.
4. Crear `components/real-game-registry.tsx` con `REAL_GAMES = { rocas: RocasCanvas }`. Verificación: compila e importa `RocasCanvas` correctamente.
5. Modificar `app/juego/[id]/jugar/page.tsx`: si `REAL_GAMES[game.id]` existe, renderizar ese componente dentro de `.crt-screen` en lugar de `.game-arena`, y usar `RocasEngineState` (vía `onUpdate`) para pilotar `score`/`lives`/`level`/`over` en lugar del `setInterval` falso — que se conserva sin cambios para los juegos que no están en el registro. Conectar PAUSA/REANUDAR, FIN, SALIR y "JUGAR DE NUEVO" a `pause()/resume()/forceGameOver()/reset()` cuando el juego activo es real. Verificación: `/juego/rocas/jugar` muestra el canvas real dentro del bisel CRT; `/juego/bloque-buster/jugar` sigue mostrando la simulación falsa sin cambios visibles.
6. Añadir a `app/globals.css` la regla de tamaño del canvas dentro de `.crt-screen` (`width: 100%; height: 100%; display: block`). Verificación: el canvas llena el bisel CRT sin desbordarlo ni dejar bandas, en distintos anchos de viewport.
7. Ejecutar `npm run lint` y `npm run build`, y jugar manualmente una partida completa en `/juego/rocas/jugar`: mover/rotar/propulsar, disparar, subir de nivel, perder las 3 vidas, ver el modal de fin de partida, guardar puntuación, pulsar "JUGAR DE NUEVO", probar PAUSA/REANUDAR y FIN, y confirmar que otro juego (p. ej. `/juego/serpentina/jugar`) sigue mostrando la simulación falsa intacta. Verificación: los criterios de aceptación siguientes se cumplen y ambos comandos terminan sin errores.

## Acceptance criteria

- [ ] `/juego/rocas/jugar` renderiza el canvas del motor real dentro del bisel CRT, con nave, asteroides, disparo, wraparound toroidal, partículas de explosión y power-up de disparo triple, igual que en `references/started-games/02-asteroids`.
- [ ] El canvas escala por CSS para llenar `.crt-screen` en distintos anchos de viewport, sin distorsión de aspecto (proporción 4:3 preservada).
- [ ] El HUD de React (Puntuación, Vidas, Nivel) refleja en tiempo real el estado del motor mientras se juega `rocas`, no el `setInterval` falso.
- [ ] El HUD y el overlay de "GAME OVER" que el motor original dibuja dentro del canvas ya no aparecen — solo el HUD y el modal de React.
- [ ] El botón PAUSA detiene el movimiento y la física (nave, asteroides, balas, partículas) manteniendo el último fotograma visible bajo el overlay "EN PAUSA"; REANUDAR continúa exactamente donde quedó.
- [ ] El botón FIN dispara el modal de fin de partida con la puntuación acumulada hasta ese momento, sin reiniciar el motor.
- [ ] Al perder las 3 vidas jugando normalmente, aparece el modal de fin de partida con la puntuación final real del motor.
- [ ] Guardar puntuación desde el modal invoca `useSession().saveScore` igual que en los demás juegos, sin cambios en `lib/session.tsx`.
- [ ] "JUGAR DE NUEVO" reinicia por completo el motor (nave, asteroides, vidas, nivel, puntuación) vía `reset()`, sin recargar la página.
- [ ] Pulsar Espacio en la pantalla de fin de partida ya NO reinicia el motor automáticamente — solo el botón "JUGAR DE NUEVO" lo hace.
- [ ] SALIR navega a `/juego/rocas` y desmonta el motor limpiamente, sin listeners de teclado ni `requestAnimationFrame` colgando tras salir.
- [ ] Los otros 7 juegos siguen mostrando la simulación falsa sin ningún cambio de comportamiento.
- [ ] `lib/games.ts`, `lib/scores.ts` y `app/juego/[id]/page.tsx` (Detalle) no cambian.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** registro extensible `REAL_GAMES` por id, en vez de un condicional hardcodeado solo para `rocas` — decidido explícitamente en la fase de preguntas; deja el patrón listo para que futuros specs añadan más juegos reales sin volver a tocar la página del Reproductor.
- **Sí:** el motor reporta su estado a React vía callback por frame, y se elimina el HUD/overlay dibujados dentro del canvas — decidido explícitamente; evita duplicar UI entre el motor y React.
- **Sí:** canvas interno fijo en 800×600 (coordenadas del motor sin cambios), escalado por CSS al contenedor `.crt-screen` — decidido explícitamente; ambos ya son 4:3, así que no hace falta reescribir física ni spawns del motor para que sea responsive.
- **Sí:** portar `game.js` a TypeScript en `lib/rocas-engine.ts`, en vez de copiarlo tal cual a `public/` y cargarlo con `<script>` — decidido explícitamente; consistente con el resto del repo, tipado y bajo el mismo lint.
- **Sí:** el botón FIN fuerza un game-over instantáneo con la puntuación actual, sin animación de explosión de nave — decidido explícitamente en la fase de preguntas.
- **Sí:** se desactiva el reinicio automático por Espacio del motor en estado `gameover`; solo el botón "JUGAR DE NUEVO" de React reinicia, vía `reset()` — decidido explícitamente, evita dos rutas de reinicio desincronizadas.
- **Sí:** se mantiene el power-up de disparo triple tal cual existe en el motor de referencia — decidido explícitamente; paridad completa con el juego "ya realizado", sin recortar mecánicas.
- **No:** controles táctiles/móviles — decidido explícitamente como fuera de alcance; el motor de referencia solo soporta teclado, y añadirlos ahora ampliaría el alcance más allá de portar el motor existente.
- **No:** cambios a `lib/games.ts` (metadatos del juego `rocas`), al leaderboard seedeado del Detalle, o a la persistencia de puntuaciones (`lib/session.tsx`/Supabase) — este spec solo reemplaza la simulación de partida por el motor real, sin tocar datos ni backend.

## Risks

| Riesgo                                                                                                                                                 | Mitigación                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Strict Mode (dev) monta/desmonta efectos dos veces; si `destroy()` no limpia bien podría duplicar `requestAnimationFrame` o listeners de teclado | El motor encapsula todo su estado (incluidos los listeners) dentro del cierre de `createRocasEngine`, sin variables a nivel de módulo compartidas entre instancias; `destroy()` cancela el frame pendiente y remueve explícitamente los listeners de esa instancia antes de que el efecto pueda volver a montar. |
| Escalar el canvas 800×600 por CSS puede verse ligeramente borroso en pantallas de alta densidad (retina)                                               | Aceptado para este spec: el motor dibuja formas vectoriales simples (líneas, no bitmaps), por lo que el escalado CSS degrada mínimamente; ajustar `devicePixelRatio` queda para un spec futuro si se nota en uso real.                                                                                           |
| `onUpdate` disparando un re-render de React en cada frame (~60/s) podría impactar rendimiento                                                          | Aceptado para este spec, con un único juego real activo; si se detecta jank al añadir más juegos reales al registro, limitar la frecuencia de sync (solo cuando cambian `score`/`lives`/`level`/`gameOver`) queda para un spec futuro.                                                                           |

## What is **not** in this spec

- Mecánica real de los otros 7 juegos del catálogo.
- Controles táctiles/móviles.
- Persistencia real de puntuaciones en Supabase, o cualquier leaderboard no-mock.
- Cambios a los metadatos del juego `rocas` en `lib/games.ts`.

Cada uno de estos, si se implementa, va en su propio spec.
