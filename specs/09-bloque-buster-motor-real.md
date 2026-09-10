# SPEC 09 — Motor real de Arkanoid en "BLOQUE BUSTER"

> **Status:** Implemented
> **Depends on:** SPEC 04, SPEC 08
> **Date:** 2026-09-10
> **Objective:** Portar el motor real de Arkanoid (`references/started-games/04-arkanoid/game.js`) a TypeScript e integrarlo en `/juego/bloque-buster/jugar`, reemplazando la simulación falsa de ese juego por gameplay real, siguiendo el mismo patrón de motor/registro ya usado por ROCAS (SPEC 04) y CAÍDA (SPEC 08).

## Por qué existe este spec

`bloque-buster` ya tiene fila real en la tabla `games` (`title: "BLOQUE BUSTER"`, `cat: ARCADE`, `cover: cover-bricks`, `color: cyan`) y aparece explícitamente en el catálogo del skill `add-arcade-game` como "candidato natural" para portar `references/started-games/04-arkanoid`. El tipo de estado compartido (`RealGameState` en `components/real-game-registry.tsx`) y el registro extensible `REAL_GAMES` ya existen desde SPEC 08, así que este spec no repite el paso 0 (ya hecho) y va directo a portar el tercer motor real.

## Scope

**In:**

- Motor real de Arkanoid portado a TypeScript (`lib/bloque-buster-engine.ts`), con paridad de mecánicas frente a `references/started-games/04-arkanoid/game.js`: paleta controlada por teclado (velocidad 400px/s), pelota con rebote en paredes izquierda/derecha/superior y en la paleta, 10×6 bloques por nivel con las 5 disposiciones de `levels.js` (rectángulo completo, pirámide, tablero de ajedrez, con huecos, marco+cruz), multiplicador de velocidad de pelota por nivel (`1.00, 1.10, 1.21, 1.33, 1.46`), 3 vidas, 10 puntos por bloque, avance automático de nivel al vaciar el tablero, y pérdida de vida al caer la pelota por debajo de la paleta.
- Canvas interno fijo en 800×600 (coincide exactamente con la resolución nativa del original — sin distorsión ni letterbox necesario, a diferencia de CAÍDA).
- Bloques, paleta y pelota dibujados con primitivas de canvas (rectángulos/círculos de color), no con el spritesheet PNG del original — mismo criterio que ROCAS y CAÍDA (motores sin dependencias de imagen), evitando cargar/servir `assets/spritesheet-breakout.png`.
- Efecto de explosión al romper un bloque simplificado a un flash de partículas (estilo `Particle` de ROCAS) en vez de la animación de 4 frames por sprite del original.
- El motor reporta a React vía `callbacks.onUpdate({ score, lives, level, gameOver })` cada frame. Completar el nivel 5 (ganar el juego) se reporta como `gameOver: true` con la puntuación final acumulada — el contrato genérico no distingue "victoria" de "fin de partida", igual que ya decidió el patrón de motores anteriores no introducir estados nuevos fuera de `RealGameState`.
- Controles de teclado únicamente: `←`/`→` mueven la paleta. Sin control por ratón (el original mueve la paleta con `mousemove` y selecciona nivel con `click` sobre botones dibujados en el overlay de pausa) — se elimina, igual que se descartó explícitamente el control táctil/ratón en SPEC 04 y SPEC 08.
- Sin sonido: se elimina `bounceSound`/`breakSound` (`Audio()` + assets `.mp3`) del original — ningún motor real existente reproduce audio hoy, y añadirlo aquí introduciría una asimetría con ROCAS/CAÍDA sin que el skill lo pida.
- Sin overlay de pausa ni selector de nivel dibujado en el canvas (el original permite saltar a cualquiera de los 5 niveles mientras está en pausa, vía clic) — la pausa es responsabilidad exclusiva del botón PAUSA/REANUDAR de React (`pause()`/`resume()` del handle), igual que ROCAS y CAÍDA. No hay tecla `P`/`Escape` de pausa dentro del motor.
- El motor expone el mismo contrato `RealGameHandle` que ROCAS/CAÍDA: `pause()`, `resume()`, `reset()`, `forceGameOver()`, `destroy()`.
- Componente cliente `components/bloque-buster-canvas.tsx`, calcado del patrón de `components/rocas-canvas.tsx` / `components/caida-canvas.tsx`.
- Registro: se añade `"bloque-buster": BloqueBusterCanvas` a `REAL_GAMES` en `components/real-game-registry.tsx`.

**Out of scope (para specs futuros):**

- Mecánica real de los 5 juegos restantes (`serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Controles táctiles/de ratón, y el selector de nivel por clic del original.
- Sonido (`bounceSound`/`breakSound`) y el spritesheet de imágenes del original.
- Cambios a los metadatos del juego `bloque-buster` en la tabla `games` (título, descripción, portada, color) — ya tiene fila real y no se toca.
- Cambios al HUD genérico de React (`components/jugar-client.tsx`) para distinguir "victoria" de "game over", o para añadir un slot dedicado a power-ups u otros datos — no aplica aquí; el original de Arkanoid tampoco tiene power-ups.
- Persistencia de puntuaciones — sigue usando `useSession().saveScore` (Supabase, SPEC 06) sin cambios.

## Data model

No se introduce persistencia nueva ni cambios de tipos (ya generalizados desde SPEC 08). Solo se añade el motor:

```ts
// lib/bloque-buster-engine.ts
export type BloqueBusterEngineCallbacks = {
  onUpdate: (state: RealGameState) => void;
};

export type BloqueBusterEngineHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  destroy: () => void;
};

export function createBloqueBusterEngine(
  canvas: HTMLCanvasElement,
  callbacks: BloqueBusterEngineCallbacks,
): BloqueBusterEngineHandle;
```

```ts
// components/real-game-registry.tsx
export const REAL_GAMES: Record<string, ComponentType<RealGameProps>> = {
  rocas: RocasCanvas,
  caida: CaidaCanvas,
  "bloque-buster": BloqueBusterCanvas,
};
```

## Implementation plan

1. Crear `lib/bloque-buster-engine.ts`: portar constantes (`PADDLE_SPEED`, dimensiones de bloque, orígenes), las 5 disposiciones de nivel de `levels.js` (generadas programáticamente igual que el original), el estado (paleta, pelota, bloques, vidas, score, nivel, `gameOver`) y el bucle de colisiones (paredes, paleta, bloques con "un bloque por frame") a una factory `createBloqueBusterEngine(canvas, callbacks)` con todo el estado en el cierre de la instancia. Verificación: el archivo compila sin errores de tipos, aún no se usa desde ningún componente.
2. Dentro del motor: sustituir el dibujo por sprite (`drawSprite`) por primitivas de canvas — bloques como rectángulos de color redondeados, paleta como rectángulo, pelota como círculo — y añadir un efecto de partículas simple al romper un bloque en vez de la animación de 4 frames. Eliminar `mousemove`/`click` y el overlay de pausa con selector de nivel; mover la paleta solo con `ArrowLeft`/`ArrowRight` (`preventDefault` en ambas). Eliminar `Audio()`/sonidos. Invocar `callbacks.onUpdate({ score, lives, level, gameOver })` cada frame, con `gameOver: true` tanto al perder la última vida como al completar el nivel 5. Implementar `pause()`/`resume()` (deja de avanzar `update(dt)` pero sigue dibujando el último fotograma), `reset()` (equivalente a `initPaddle()+loadLevel(1)+score=0+lives=3` del original) y `destroy()` (cancela el frame pendiente y remueve los listeners de teclado de esa instancia). Verificación: tipos concretos, build sigue pasando.
3. Crear `components/bloque-buster-canvas.tsx` calcado de `components/rocas-canvas.tsx`/`components/caida-canvas.tsx`: mismo `useEffect` de montaje/desmontaje, mismo `useImperativeHandle`, mismo `onUpdateRef`; solo cambia el import a `createBloqueBusterEngine`. Verificación: se importa sin errores de tipos, aún no conectado al registro.
4. Añadir `"bloque-buster": BloqueBusterCanvas` a `REAL_GAMES` en `components/real-game-registry.tsx`. Verificación: compila e importa correctamente.
5. `npm run lint` y `npm run build`, y probar manualmente en `/juego/bloque-buster/jugar`: mover la paleta con flechas, rebotar la pelota en paredes/paleta/bloques, romper un tablero completo y avanzar de nivel (velocidad de pelota más alta), perder las 3 vidas y ver el modal de fin de partida, completar el nivel 5 y confirmar que también dispara el modal de fin de partida con la puntuación final, PAUSA/REANUDAR, FIN, guardar puntuación con nombre, "JUGAR DE NUEVO", y confirmar que `/juego/bloque-buster` y `/salon-de-la-fama` muestran esa puntuación real. Confirmar también que `/juego/rocas/jugar` y `/juego/caida/jugar` siguen funcionando igual. Verificación: los criterios de aceptación siguientes se cumplen y ambos comandos terminan sin errores.

## Acceptance criteria

- [x] `/juego/bloque-buster/jugar` renderiza el canvas del motor real dentro del bisel CRT: paleta, pelota y hasta 60 bloques por nivel dibujados con primitivas de canvas (sin spritesheet).
- [x] El canvas interno es 800×600 y escala por CSS al bisel CRT sin distorsión (proporción 4:3 exacta, igual que el original).
- [x] El HUD de React (Puntuación, Vidas, Nivel) refleja en tiempo real el estado del motor.
- [x] Mover la paleta solo responde a `←`/`→`; no hay control por ratón ni clic dentro del canvas.
- [x] La pelota rebota en paredes izquierda/derecha/superior y en la paleta; al caer por debajo de la paleta se pierde una vida y la pelota se reposiciona sin reiniciar el nivel.
- [x] Romper un bloque suma 10 puntos, dispara un efecto de partículas breve, y solo permite romper un bloque por frame (igual que el original).
- [x] Vaciar los bloques de un nivel (1–4) carga el siguiente con su disposición y multiplicador de velocidad de pelota correspondiente (`1.00, 1.10, 1.21, 1.33, 1.46`).
- [x] Vaciar los bloques del nivel 5 dispara el modal de fin de partida (`gameOver: true`) con la puntuación final acumulada, igual que perder la última vida.
- [x] El botón PAUSA detiene el movimiento y el input manteniendo el último fotograma visible bajo el overlay "EN PAUSA" de React; REANUDAR continúa exactamente donde quedó. No existe overlay de pausa ni selector de nivel dentro del canvas.
- [x] El botón FIN dispara el modal de fin de partida con la puntuación acumulada, sin reiniciar el motor.
- [x] Guardar puntuación desde el modal invoca `useSession().saveScore` igual que en los demás juegos, sin cambios en `lib/session.tsx`.
- [x] "JUGAR DE NUEVO" reinicia por completo el motor (paleta, pelota, nivel 1, score, vidas) vía `reset()`, sin recargar la página.
- [x] SALIR navega a `/juego/bloque-buster` y desmonta el motor limpiamente, sin listeners de teclado ni `requestAnimationFrame` colgando.
- [x] `/juego/bloque-buster` y `/salon-de-la-fama` (pestaña BLOQUE BUSTER) muestran puntuaciones reales guardadas, con el trigger `bump_game_stats()` de SPEC 07 actualizando `games.best`/`games.plays`.
- [x] Los 5 juegos restantes sin motor real siguen mostrando la simulación falsa sin cambios.
- [x] La tabla `games`, la fila de `bloque-buster` y `lib/games.ts` no cambian.
- [x] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** dibujar bloques/paleta/pelota con primitivas de canvas en vez de cargar el spritesheet PNG del original — decidido por consistencia con ROCAS y CAÍDA (ningún motor real existente depende de imágenes); evita añadir carga asíncrona de assets y lógica de "esperar a que cargue el spritesheet antes de arrancar el loop".
- **Sí:** eliminar sonido (`bounceSound`/`breakSound`) — decidido por consistencia; ningún motor real existente reproduce audio y el skill no lo pide.
- **Sí:** eliminar control por ratón y el selector de nivel por clic del overlay de pausa del original — decidido por consistencia con la exclusión explícita de controles táctiles/ratón en SPEC 04 y SPEC 08; la pausa/reanudación es responsabilidad exclusiva de React.
- **Sí:** completar el nivel 5 ("ganar") se reporta como `gameOver: true` — decidido porque `RealGameState` no tiene un estado de "victoria" y el HUD genérico no lo necesita; el jugador ve el modal de fin de partida normal con su puntuación final, igual que si hubiera perdido.
- **Sí:** simplificar la animación de explosión de 4 frames por sprite a un efecto de partículas breve — decidido para mantener algo de refuerzo visual al romper bloques sin depender de imágenes; mismo patrón que la clase `Particle` de ROCAS.
- **No:** canvas interno distinto de 800×600 — no aplica, el original ya es 800×600 nativo (4:3 exacto), sin necesidad de letterbox ni redecidir resolución como en CAÍDA.
- **No:** persistencia distinta a `useSession().saveScore`, cambios a metadatos de `bloque-buster` en la tabla `games`, o cambios al HUD genérico de React — mismos motivos que SPEC 04/08: este spec solo reemplaza la simulación de partida por el motor real.

## Risks

| Riesgo                                                                                                                                                                | Mitigación                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El rebote de bloque del original es simplista (`ball.vy = -ball.vy` sin distinguir cara superior/lateral del bloque), lo que puede sentirse "raro" en ciertos ángulos | Aceptado: se porta tal cual para mantener paridad de mecánicas con el original, sin "arreglar" comportamiento que el propio juego de referencia ya tenía.                                           |
| Sustituir sprites por rectángulos de color cambia la identidad visual del juego frente al original                                                                    | Aceptado explícitamente (ver Decisions); se usa una paleta de colores reconocible (rojo/amarillo/cian/magenta/rosa/verde/gris) que respeta los mismos nombres de color que `levels.js`.             |
| Sin selector de nivel por clic, probar los 5 niveles manualmente requiere jugar de corrido                                                                            | Aceptado: es una herramienta de depuración del juego original, no una mecánica de producción; se puede usar `forceGameOver()`/`reset()` o pruebas ad-hoc en desarrollo si hace falta iterar rápido. |

## What is **not** in this spec

- Mecánica real de los 5 juegos restantes del catálogo.
- Controles táctiles/de ratón y el selector de nivel por clic.
- Sonido y el spritesheet de imágenes del original.
- Cambios a los metadatos del juego `bloque-buster` en la tabla `games` o en `lib/games.ts`.
- Distinción entre "victoria" (nivel 5 completado) y "game over" (vidas agotadas) en el HUD genérico de React.

Cada uno de estos, si se implementa, va en su propio spec.
