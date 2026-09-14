# SPEC 13 — Controles táctiles en SERPENTINA (infraestructura táctil compartida)

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 10, SPEC 11
> **Date:** 2026-09-14
> **Objective:** Añadir un D-pad táctil que permite jugar a SERPENTINA sin teclado en dispositivos con pantalla táctil, despachando eventos de teclado sintéticos hacia el motor existente sin modificarlo, sobre una infraestructura compartida (`TouchControls`) pensada para que futuros specs solo tengan que registrar su propio juego.

## Por qué existe este spec

SPEC 11 dejó explícitamente fuera de alcance los "controles táctiles o de ratón para jugar en móvil": el bisel CRT ya se adapta al alto y ancho disponibles, pero los 5 motores reales (`lib/rocas-engine.ts`, `lib/caida-engine.ts`, `lib/bloque-buster-engine.ts`, `lib/serpentina-engine.ts`, `lib/raya-veloz-engine.ts`) solo escuchan teclado (`window.addEventListener("keydown"/"keyup", ...)`), así que en un móvil o tablet sin teclado físico ningún juego con motor real es jugable. Se verificó leyendo el código de `lib/rocas-engine.ts`, `lib/bloque-buster-engine.ts` y `lib/serpentina-engine.ts` que los tres usan `e.code` sobre `window` con un modelo de estado por booleano (`keys[code]`) o de "recién pulsado" (`justPressed`) — esto permite resolver el problema con un overlay táctil que despacha `KeyboardEvent` sintéticos con el mismo `code`, sin tocar ningún motor. Este spec construye esa infraestructura compartida y la aplica a un único juego (SERPENTINA, el motor más simple: solo direcciones, un único listener `keydown`, sin `keyup`) como prueba de concepto; los otros 4 quedan para specs futuros que solo necesiten añadir su propia entrada al registro.

## Scope

**In:**

- Componente nuevo `components/touch-controls.tsx` que expone:
  - Tipo `TouchControlsLayout` (qué flechas del D-pad mostrar y, opcionalmente, botones de acción con su `code` y etiqueta).
  - Registro `TOUCH_CONTROLS_LAYOUTS: Partial<Record<string, TouchControlsLayout>>`, con una única entrada para `serpentina` (`up`, `down`, `left`, `right`, sin `actions`) — mismo patrón que `REAL_GAMES`/`SKIN_ENABLED_GAMES` en `components/real-game-registry.tsx`.
  - Hook `useIsTouchDevice()` que usa `window.matchMedia("(pointer: coarse)")`, con listener de cambios (`change`), para detectar dispositivos cuyo puntero principal es táctil.
  - Componente `TouchControls({ layout })` que renderiza el D-pad (y los botones de acción si el layout los define) usando Pointer Events: `pointerdown` despacha `window.dispatchEvent(new KeyboardEvent("keydown", { code }))`, y `pointerup`/`pointercancel`/`pointerleave` despachan el `keyup` equivalente — así un dedo que se arrastra fuera del botón no deja ningún `code` "pulsado" colgado. Cada botón usa `touchAction: "none"` y `preventDefault()` en `pointerdown` para evitar scroll/zoom accidental.
- Integración en `components/jugar-client.tsx`: cuando `useIsTouchDevice()` es cierto y `TOUCH_CONTROLS_LAYOUTS[game.id]` existe, se renderiza `<TouchControls>` en una franja fija por debajo de `.crt` (fuera del bisel, no superpuesta al canvas).
- El cálculo de alto disponible ya existente (`recalc`, SPEC 11) se amplía para restar también el alto medido (`getBoundingClientRect`) de esa franja de controles táctiles cuando está presente, antes de derivar `crtMaxWidth` — mismo criterio de "medir, no adivinar" que ya usa SPEC 11 para el chrome del bisel.
- Mientras el juego está en pausa o ha terminado (`paused || over`), los botones de la franja quedan visualmente atenuados y dejan de despachar eventos, pero la franja **no desaparece del layout** — su alto reservado no cambia, para que el bisel no crezca ni encoja al pausar.
- Clases CSS nuevas en `app/globals.css` (`.touch-controls`, `.touch-dpad`, `.touch-btn`, `.touch-actions`) en la línea visual neón existente (reutilizando variables como `--cyan`, `--ink-dim`, `--line`).
- Solo se registra `serpentina` en `TOUCH_CONTROLS_LAYOUTS` en este spec.

**Out of scope (para futuros specs):**

- Controles táctiles para ROCAS, CAÍDA, BLOQUE BUSTER o RAYA VELOZ — cada uno es un spec futuro que solo añade su entrada a `TOUCH_CONTROLS_LAYOUTS` (con sus propios botones de acción: disparo/empuje en ROCAS, rotar/caída rápida en CAÍDA, etc.) gracias a la infraestructura creada aquí.
- Gestos de swipe sobre el canvas como alternativa al D-pad — se decidió D-pad + botones por su predictibilidad (ver Decisiones).
- Cambios a cualquier `lib/*-engine.ts` — el mecanismo es 100% eventos de teclado sintéticos sobre `window`, ningún motor se modifica.
- Restringir o sugerir orientación landscape en móvil — SPEC 11 ya adapta el bisel a cualquier orientación; no se añade ningún aviso de "gira el teléfono".
- Un toggle manual para mostrar/ocultar los controles táctiles siempre (en cualquier dispositivo) — la detección es automática vía `pointer: coarse`.
- Un tamaño mínimo (`min-height`) por debajo del cual se fuerce scroll en vez de seguir encogiendo el bisel — mismo riesgo aceptado ya documentado en SPEC 11, no se agrava ni se resuelve aquí.
- Persistencia de ninguna preferencia relacionada con controles táctiles.

## Data model

No se introduce persistencia (ni Supabase ni localStorage). Se introduce un tipo y un registro en memoria, mismo patrón que `REAL_GAMES`:

```ts
// components/touch-controls.tsx
export type TouchControlsLayout = {
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
  actions?: { code: string; label: string }[]; // vacío/ausente en SERPENTINA
};

export const TOUCH_CONTROLS_LAYOUTS: Partial<
  Record<string, TouchControlsLayout>
> = {
  serpentina: { up: true, down: true, left: true, right: true },
};
```

## Implementation plan

1. Crear `components/touch-controls.tsx`: tipo `TouchControlsLayout`, registro `TOUCH_CONTROLS_LAYOUTS` (solo `serpentina`), hook `useIsTouchDevice()` (`matchMedia("(pointer: coarse)")` con listener de `change`), y componente `TouchControls({ layout })` que renderiza el D-pad con Pointer Events (`pointerdown` → `keydown` sintético, `pointerup`/`pointercancel`/`pointerleave` → `keyup` sintético), usando los mismos `code` que `lib/serpentina-engine.ts` ya escucha (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`). Verificación: el archivo compila sin errores de tipos; aún no se usa desde ningún componente.
2. Añadir las clases `.touch-controls`, `.touch-dpad`, `.touch-btn`, `.touch-actions` en `app/globals.css`, siguiendo la paleta neón existente. Verificación: no hay regresión visual todavía (sin consumidor); se revisa junto al paso 3.
3. Integrar en `components/jugar-client.tsx`: usar `useIsTouchDevice()` y `TOUCH_CONTROLS_LAYOUTS[game.id]`; si ambos aplican, renderizar `<TouchControls layout={...}>` en una franja fija justo debajo de `.crt`. Los botones quedan atenuados y no interactivos mientras `paused || over`, sin quitar la franja del layout. Verificación manual con emulación táctil de DevTools en `/juego/serpentina/jugar`: el D-pad aparece bajo el bisel; alternar PAUSA no cambia el tamaño del bisel.
4. Ampliar el `useEffect` de `recalc` (SPEC 11) en `components/jugar-client.tsx` para restar también el alto medido de la franja de controles táctiles (nueva ref + `getBoundingClientRect`) del alto disponible, antes de derivar `crtMaxWidth`. Verificación: en viewports móviles emulados (390×844 portrait y ~800×390 landscape), el bisel completo (incluida `.crt-bottom`) y la franja de controles táctiles caben a la vez sin recorte ni scroll de página.
5. Prueba manual completa: tocar cada flecha del D-pad mueve la serpiente en la dirección correcta; soltar el dedo fuera del botón no deja ningún `code` "pulsado" colgado; en escritorio con ratón (`pointer: fine`) la franja no aparece y el layout es idéntico al actual; ningún otro juego del catálogo muestra franja táctil. Ejecutar `npm run lint` y `npm run build`. Verificación: los criterios de aceptación siguientes se cumplen y ambos comandos terminan sin errores.

## Acceptance criteria

- [ ] En un dispositivo o emulación con `pointer: coarse`, `/juego/serpentina/jugar` muestra una franja fija con un D-pad de 4 flechas debajo del bisel `.crt`.
- [ ] En escritorio con ratón (`pointer: fine`), la franja de controles táctiles no se renderiza y el layout de `/juego/serpentina/jugar` es idéntico al actual (sin regresión de SPEC 11).
- [ ] Tocar cada flecha del D-pad cambia la dirección de la serpiente igual que la tecla de flecha física correspondiente, sin necesidad de teclado.
- [ ] Arrastrar el dedo fuera de un botón pulsado (`pointercancel`/`pointerleave`) despacha el `keyup` sintético igualmente, sin dejar ningún botón "pulsado" de forma colgada.
- [ ] Pulsar PAUSA o llegar a game over deja los botones del D-pad visualmente atenuados y no interactivos, sin que el bisel `.crt` cambie de tamaño respecto a como estaba jugando.
- [ ] En viewports móviles emulados de 390×844 (portrait) y ~800×390 (landscape), el bisel completo (`.crt`, incluida `.crt-bottom`) y la franja de controles táctiles son visibles a la vez, sin recorte vertical ni scroll de página.
- [ ] Ningún otro juego del catálogo (`rocas`, `caida`, `bloque-buster`, `raya-veloz`, ni los que aún usan la simulación falsa) muestra franja de controles táctiles — `TOUCH_CONTROLS_LAYOUTS` solo tiene entrada para `serpentina`.
- [ ] El teclado físico sigue funcionando igual que hoy en los 5 juegos con motor real — ningún `lib/*-engine.ts` cambia.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** eventos de teclado sintéticos (`KeyboardEvent` con el mismo `code` que cada motor ya escucha) en vez de una API de input nueva por motor — confirmado leyendo `lib/rocas-engine.ts`, `lib/bloque-buster-engine.ts` y `lib/serpentina-engine.ts`: los tres leen `e.code` sobre `window` con un modelo de estado booleano o de "recién pulsado". Cero cambios en los 5 `lib/*-engine.ts`.
- **Sí:** Pointer Events (`pointerdown/up/cancel/leave`) en vez de Touch Events (`touchstart/touchend`) — una sola API cubre táctil/ratón/lápiz, y `pointerleave` resuelve de forma nativa el caso de arrastrar el dedo fuera del botón.
- **Sí:** infraestructura compartida (`TouchControlsLayout`, `TOUCH_CONTROLS_LAYOUTS`, componente `TouchControls`) aunque solo se registre SERPENTINA — mismo patrón que `REAL_GAMES`/`SKIN_ENABLED_GAMES`: specs futuros solo añaden una entrada al registro.
- **Sí:** SERPENTINA como juego de prueba — motor más simple (solo direcciones, un único listener `keydown`, sin `keyup`), confirmado en el código; valida el mecanismo antes de extenderlo a motores con estado mantenido (empuje de ROCAS, paleta de BLOQUE BUSTER).
- **Sí:** franja fija debajo del bisel (no overlay flotante sobre el canvas), con su alto reservado en el cálculo de SPEC 11 — decidido con el usuario: layout estable y predecible, los botones nunca tapan el juego.
- **Sí:** los botones se atenúan y dejan de responder durante pausa/game over pero sin quitar su espacio reservado — evita que el bisel cambie de tamaño en cada pausa, lo cual sería una regresión de estabilidad visual respecto a SPEC 11.
- **Sí:** sin restricción de orientación — SPEC 11 ya adapta el bisel al alto disponible en cualquier orientación; forzar o sugerir landscape es fricción no pedida.
- **No:** gestos de swipe sobre el canvas — se prefirió D-pad + botones por su predictibilidad; puede añadirse después si hace falta.
- **No:** dar controles táctiles a ROCAS, CAÍDA, BLOQUE BUSTER o RAYA VELOZ en este spec — cada uno va en su propio spec futuro, reutilizando la infraestructura de este.
- **No:** detección por ancho de viewport en vez de `pointer: coarse` — un ratón en una ventana estrecha no debe ver controles táctiles que no necesita.
- **No:** toggle manual para mostrar/ocultar los controles siempre — no se pidió, y añadiría UI permanente incluso en desktop.

## Risks

| Riesgo                                                                                                                                                               | Mitigación                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dispositivos híbridos (portátil con pantalla táctil + ratón) pueden cambiar de tipo de puntero en caliente y `matchMedia` leído solo una vez quedaría desactualizado | `useIsTouchDevice()` añade un listener de `change` sobre el `MediaQueryList`, no solo una lectura al montar.                                          |
| Reservar altura fija para la franja de controles reduce aún más el alto disponible para el bisel en pantallas ya muy bajas                                           | Mismo riesgo ya aceptado y documentado en SPEC 11 (sin `min-height` forzado); no se agrava con una mitigación nueva en este spec, se hereda tal cual. |

## What is **not** in this spec

- Controles táctiles para ROCAS, CAÍDA, BLOQUE BUSTER o RAYA VELOZ.
- Gestos de swipe sobre el canvas.
- Cambios a cualquier `lib/*-engine.ts`.
- Restricción o sugerencia de orientación landscape en móvil.
- Un toggle manual para mostrar/ocultar los controles táctiles siempre.
- Un tamaño mínimo forzado con scroll para pantallas extremadamente bajas.
- Persistencia de preferencias de controles táctiles.

Cada uno de estos, si se implementa, va en su propio spec.
