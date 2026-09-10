# SPEC 10 — Motor real de Snake en "SERPENTINA"

> **Status:** Implemented
> **Depends on:** SPEC 04, SPEC 08, SPEC 09
> **Date:** 2026-09-10
> **Objective:** Construir desde cero el motor real de Snake (`lib/serpentina-engine.ts`), usando únicamente los sprites de fruta de `references/source-assets/snake-assets/`, e integrarlo en `/juego/serpentina/jugar` siguiendo el mismo patrón motor/registro de ROCAS, CAÍDA y BLOQUE BUSTER.

## Por qué existe este spec

`serpentina` ya tiene fila real en la tabla `games` (`title: "SERPENTINA"`, `cat: ARCADE`, `cover: cover-snake`, `color: green`) y el paso 0 del skill `add-arcade-game` (tipo `RealGameState` genérico) ya está hecho desde SPEC 08. A diferencia de CAÍDA y BLOQUE BUSTER, este juego **no viene de `references/started-games/`** — no existe ningún `game.js` de Snake en el repo, solo `references/source-assets/snake-assets/fruits.png` (spritesheet de 22 frutas, fondo transparente, obtenido de spriters-resource) y `sprites.js` (atlas de coordenadas de recorte). El motor se escribe desde cero siguiendo la arquitectura de factoría ya establecida, usando el atlas de frutas como único asset visual.

## Scope

**In:**

- Motor real de Snake portado a TypeScript (`lib/serpentina-engine.ts`), con mecánica clásica: movimiento por rejilla (no por píxeles sueltos), la serpiente avanza una celda por "tick", gira con las flechas del teclado sin permitir un giro de 180° directo sobre sí misma, come fruta para crecer una celda y sumar puntos, y muere al chocar con una pared o con su propio cuerpo.
- Canvas interno fijo en 800×600 con rejilla de 40×30 celdas de 20px — encaja el 4:3 del bisel CRT sin distorsión ni letterbox.
- Velocidad inicial de 8 celdas/segundo. Cada 5 frutas comidas sube el nivel y la velocidad aumenta (`+0.75` celdas/s por nivel, sin tope explícito salvo el propio límite de `requestAnimationFrame`).
- Fruta dibujada con los sprites reales de `fruits.png` (recorte aleatorio entre las 22 frutas del atlas de `sprites.js`, portado a una constante TypeScript dentro del motor) en vez de con primitivas de canvas — único motor real que usa una imagen, ya que es el único asset proporcionado para este juego. La imagen se sirve desde `public/snake-assets/fruits.png` (copiada de `references/source-assets/snake-assets/fruits.png`).
- Serpiente dibujada con primitivas de canvas (rectángulos redondeados en tonos verdes, cabeza visualmente diferenciada del cuerpo) — no hay sprite de serpiente en los assets proporcionados.
- 10 puntos fijos por fruta, independientemente de qué fruta le toque (el atlas no trae datos de puntuación por fruta).
- Sin concepto de vidas: cualquier colisión termina la partida al instante; se reporta `lives: 0` siempre (el HUD ya muestra "—" para `lives=0`).
- El motor reporta a React vía `callbacks.onUpdate({ score, lives: 0, level, gameOver })` cada frame.
- Controles de teclado únicamente: `↑`/`↓`/`←`/`→` cambian de dirección (con `preventDefault`); una entrada que revertiría la dirección actual 180° se ignora.
- Sin sonido, sin control táctil/ratón — mismo criterio que ROCAS/CAÍDA/BLOQUE BUSTER.
- El motor expone el mismo contrato `RealGameHandle`: `pause()`, `resume()`, `reset()`, `forceGameOver()`, `destroy()`.
- Componente cliente `components/serpentina-canvas.tsx`, calcado del patrón de `components/rocas-canvas.tsx`.
- Registro: se añade `"serpentina": SerpentinaCanvas` a `REAL_GAMES` en `components/real-game-registry.tsx`.

**Out of scope (para specs futuros):**

- Mecánica real de los 4 juegos restantes (`gloton`, `invasores`, `ranaria`, `duelo-pixel`).
- Wrap-around en los bordes (se descarta explícitamente — ver Decisiones).
- Vidas múltiples o cualquier variante no clásica de Snake.
- Puntuación distinta por tipo de fruta, combos, power-ups u obstáculos.
- Sonido y controles táctiles/de ratón.
- Cambios a los metadatos del juego `serpentina` en la tabla `games` — ya tiene fila real y no se toca.
- Cambios al HUD genérico de React (`components/jugar-client.tsx`).
- Persistencia de puntuaciones — sigue usando `useSession().saveScore` (Supabase, SPEC 06) sin cambios.

## Data model

No se introduce persistencia nueva ni cambios de tipos (ya generalizados desde SPEC 08). Se añade el motor y el asset de imagen:

```ts
// lib/serpentina-engine.ts
export type SerpentinaEngineCallbacks = {
  onUpdate: (state: RealGameState) => void;
};

export type SerpentinaEngineHandle = {
  pause: () => void;
  resume: () => void;
  reset: () => void;
  forceGameOver: () => void;
  destroy: () => void;
};

export function createSerpentinaEngine(
  canvas: HTMLCanvasElement,
  callbacks: SerpentinaEngineCallbacks,
): SerpentinaEngineHandle;

// Atlas de frutas portado desde references/source-assets/snake-assets/sprites.js
const FRUIT_ATLAS: { x: number; y: number; w: number; h: number }[] = [
  { x: 34, y: 136, w: 110, h: 160 }, // banana
  { x: 186, y: 136, w: 150, h: 160 }, // orange
  // ... 22 entradas en total, mismas coordenadas que sprites.js
];
```

```ts
// components/real-game-registry.tsx
export const REAL_GAMES: Record<string, ComponentType<RealGameProps>> = {
  rocas: RocasCanvas,
  caida: CaidaCanvas,
  "bloque-buster": BloqueBusterCanvas,
  serpentina: SerpentinaCanvas,
};
```

Asset nuevo: `public/snake-assets/fruits.png` (copia directa de
`references/source-assets/snake-assets/fruits.png`, sin recomprimir).

Conventions:

- Rejilla: origen top-left, celda `(0,0)` a `(39,29)`, cada celda 20×20px.
- La serpiente se representa como un array de celdas `{ x, y }` (coordenadas de
  rejilla, no de píxeles); `snake[0]` es la cabeza.

## Implementation plan

1. Copiar `references/source-assets/snake-assets/fruits.png` a `public/snake-assets/fruits.png`. Crear `lib/serpentina-engine.ts` con el atlas de 22 frutas portado a una constante TypeScript (mismas coordenadas que `sprites.js`), las constantes de rejilla (`W=800`, `H=600`, `CELL=20`, `COLS=40`, `ROWS=30`), el estado inicial (serpiente de 3 celdas en el centro moviéndose a la derecha, dirección, fruta actual, score, nivel, `gameOver`) y un bucle de render vacío. Verificación: el archivo compila sin errores de tipos, aún no se usa desde ningún componente.
2. Implementar el bucle de juego basado en tick de rejilla (no en desplazamiento por píxeles): la serpiente avanza una celda cada `1000 / velocidadActual` ms; el cambio de dirección por teclado se aplica en el siguiente tick y se ignora si revierte la dirección actual 180°; detección de colisión con pared o con el propio cuerpo (excluyendo la cola que se libera ese mismo tick) dispara `gameOver`; al ocupar la celda de la fruta, la serpiente crece una celda, suma 10 puntos, y se genera una fruta nueva en una celda libre aleatoria con un sprite aleatorio del atlas; cada 5 frutas comidas sube el nivel y la velocidad (`+0.75` celdas/s). Cargar `fruits.png` de forma asíncrona (`new Image()` + `onload`) antes de dibujar ninguna fruta con sprite (mientras no ha cargado, dibujar un cuadrado de color de relleno). Invocar `callbacks.onUpdate({ score, lives: 0, level, gameOver })` cada frame con `dt` capado a 0.05s igual que ROCAS. Verificación: tipos correctos, build sigue pasando.
3. Implementar el dibujo: fondo con rejilla sutil, serpiente como rectángulos redondeados verdes (cabeza en un tono más claro/distinto al cuerpo), fruta dibujada con `ctx.drawImage` recortando el atlas sobre el spritesheet cargado, centrada en su celda. Implementar `pause()`/`resume()` (deja de avanzar el tick pero sigue dibujando el último fotograma), `reset()` (reinicia serpiente, dirección, fruta, score, nivel) y `destroy()` (cancela el frame pendiente y remueve los listeners de teclado de esa instancia). Verificación: build sigue pasando.
4. Crear `components/serpentina-canvas.tsx` calcado de `components/rocas-canvas.tsx`: mismo `useEffect` de montaje/desmontaje, mismo `useImperativeHandle`, mismo `onUpdateRef`; solo cambia el import a `createSerpentinaEngine`. Verificación: se importa sin errores de tipos, aún no conectado al registro.
5. Añadir `serpentina: SerpentinaCanvas` a `REAL_GAMES` en `components/real-game-registry.tsx`.
6. `npm run lint` y `npm run build`, y probar manualmente en `/juego/serpentina/jugar`: moverse con las 4 flechas, confirmar que no se puede girar 180° directamente, comer varias frutas (sprite aleatorio distinto cada vez, la serpiente crece, +10 puntos cada una), subir de nivel cada 5 frutas con velocidad visiblemente mayor, chocar con una pared y con el propio cuerpo (ambos disparan game over), PAUSA/REANUDAR, FIN, guardar puntuación con nombre, "JUGAR DE NUEVO", y confirmar que `/juego/serpentina` y `/salon-de-la-fama` muestran esa puntuación real. Confirmar también que `/juego/rocas/jugar`, `/juego/caida/jugar` y `/juego/bloque-buster/jugar` siguen funcionando igual. Verificación: los criterios de aceptación siguientes se cumplen y ambos comandos terminan sin errores.

## Acceptance criteria

- [x] `/juego/serpentina/jugar` renderiza el canvas del motor real dentro del bisel CRT: serpiente y fruta dibujadas dentro de una rejilla de 40×30 celdas de 20px (800×600).
- [x] El canvas interno es 800×600 y escala por CSS al bisel CRT sin distorsión (proporción 4:3 exacta).
- [x] El HUD de React (Puntuación, Nivel) refleja en tiempo real el estado del motor; Vidas muestra "—" (`lives=0`) siempre.
- [x] La serpiente se mueve con `↑`/`↓`/`←`/`→`; una pulsación que revertiría la dirección actual 180° no tiene efecto.
- [x] Comer una fruta hace crecer la serpiente una celda, suma exactamente 10 puntos, y la fruta se dibuja con un sprite real (aleatorio) recortado de `fruits.png`, no con una figura geométrica.
- [ ] Cada 5 frutas comidas sube el nivel mostrado en el HUD y la velocidad de la serpiente aumenta de forma perceptible. _(implementado — `fruitsEaten % FRUITS_PER_LEVEL` — pero no verificado en vivo en esta sesión; solo se comió 1 fruta antes de terminar la partida)_
- [x] Chocar con cualquier pared del tablero termina la partida (`gameOver: true`).
- [ ] Chocar con el propio cuerpo termina la partida (`gameOver: true`). _(implementado con la misma comprobación que la colisión con pared — no se forzó en vivo en esta sesión: con una serpiente de longitud 3 no es posible autocolisionar en un bucle de prueba corto)_
- [x] El botón PAUSA detiene el movimiento manteniendo el último fotograma visible bajo el overlay "EN PAUSA" de React; REANUDAR continúa exactamente donde quedó.
- [x] El botón FIN dispara el modal de fin de partida con la puntuación acumulada, sin reiniciar el motor.
- [x] Guardar puntuación desde el modal invoca `useSession().saveScore` igual que en los demás juegos, sin cambios en `lib/session.tsx`.
- [x] "JUGAR DE NUEVO" reinicia por completo el motor (serpiente, fruta, nivel 1, score) vía `reset()`, sin recargar la página.
- [x] SALIR navega a `/juego/serpentina` y desmonta el motor limpiamente, sin listeners de teclado ni `requestAnimationFrame` colgando.
- [x] `/juego/serpentina` y `/salon-de-la-fama` (pestaña SERPENTINA) muestran puntuaciones reales guardadas, con el trigger `bump_game_stats()` de SPEC 07 actualizando `games.best`/`games.plays`.
- [x] Los 4 juegos restantes sin motor real siguen mostrando la simulación falsa sin cambios.
- [x] La tabla `games`, la fila de `serpentina` y `lib/games.ts` no cambian.
- [x] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** sin vidas — cualquier colisión termina la partida al instante, se reporta `lives: 0` siempre. Decidido con el usuario: es el comportamiento clásico de Snake (incluido el Google Snake original de donde salen los sprites) y el HUD ya soporta `lives=0` mostrando "—".
- **Sí:** nivel = velocidad progresiva cada 5 frutas comidas. Decidido con el usuario: da al campo "Nivel" del HUD un significado real en un juego que no tiene niveles discretos como CAÍDA o BLOQUE BUSTER.
- **Sí:** pared mata (sin wrap-around). Decidido con el usuario: coincide con el Google Snake original de donde salen los sprites de fruta.
- **Sí:** rejilla 40×30 a 20px/celda, canvas 800×600, velocidad inicial 8 celdas/s. Decidido con el usuario: encaja el 4:3 del bisel CRT sin distorsión ni letterbox, igual criterio que ROCAS/BLOQUE BUSTER.
- **Sí:** dibujar la fruta con los sprites reales de `fruits.png` — único asset proporcionado para este juego; a diferencia de ROCAS/CAÍDA/BLOQUE BUSTER (sin dependencias de imagen), aquí sí hay un asset visual concreto que el usuario quiere aprovechar. La serpiente se dibuja con primitivas porque no hay sprite de serpiente en los assets.
- **Sí:** 10 puntos fijos por fruta, sin distinción por tipo — el atlas no trae datos de puntuación por fruta y no se decidió una tabla de valores distinta.
- **Sí:** fruta aleatoria del pool de 22 en cada spawn, permitiendo repeticiones consecutivas — mantiene el motor simple sin necesidad de llevar un historial de "última fruta mostrada".
- **No:** wrap-around en los bordes — descartado explícitamente en favor de "pared mata" (ver arriba).
- **No:** vidas múltiples — descartado explícitamente en favor de "sin vidas" (ver arriba).
- **No:** sonido, control por ratón/táctil — mismos motivos que SPEC 04/08/09: ningún motor real existente los usa.
- **No:** cambios a metadatos de `serpentina` en la tabla `games`, a `lib/games.ts`, o al HUD genérico de React — este spec solo reemplaza la simulación de partida por el motor real.

## Risks

| Riesgo                                                                                                                   | Mitigación                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fruits.png` tarda en cargar (o falla) justo cuando el motor arranca y necesita dibujar la fruta                         | El motor no coloca fruta con sprite hasta que `Image.onload` dispara; mientras tanto dibuja un cuadrado de color de relleno en la celda de la fruta, nunca deja la partida sin fruta visible. |
| Las 22 frutas del atlas tienen proporciones distintas (ancho 110–170px, alto fijo 160px)                                 | Se escalan manteniendo aspect ratio dentro de la celda de 20px con un pequeño margen, en vez de estirarlas a un cuadrado exacto.                                                              |
| Movimiento por rejilla con teclado puede sentirse "a saltos" comparado con los motores por píxeles (ROCAS/BLOQUE BUSTER) | Aceptado: es la mecánica clásica de Snake, no un defecto — el propio Google Snake de referencia también mueve por rejilla.                                                                    |

## What is **not** in this spec

- Mecánica real de los 4 juegos restantes del catálogo.
- Wrap-around en los bordes y vidas múltiples.
- Puntuación variable por tipo de fruta, combos, power-ups u obstáculos.
- Sonido y controles táctiles/de ratón.
- Cambios a los metadatos del juego `serpentina` en la tabla `games` o en `lib/games.ts`.

Cada uno de estos, si se implementa, va en su propio spec.
