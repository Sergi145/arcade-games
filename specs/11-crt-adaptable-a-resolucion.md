# SPEC 11 — CRT del Reproductor adaptable a la resolución de pantalla

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 04, SPEC 08, SPEC 09, SPEC 10
> **Date:** 2026-09-10
> **Objective:** Hacer que el bisel CRT del Reproductor (`components/jugar-client.tsx`) calcule su tamaño máximo teniendo en cuenta tanto el ancho como el alto realmente disponibles en el viewport, para que deje de recortarse verticalmente en ventanas de escritorio de poca altura, sin tocar la resolución interna ni la lógica de ningún motor de juego.

## Por qué existe este spec

El Reproductor (`components/jugar-client.tsx`, creado en SPEC 01) envuelve el juego en un bisel `.crt` / `.crt-screen` cuyo ancho está limitado por `.av-player { max-width: 1100px }` y cuya proporción interna es `aspect-ratio: 4/3` (definida en `app/globals.css`). Ese cálculo solo considera el ancho disponible: el alto del bisel se deriva siempre de `4/3 × ancho`, sin comprobar nunca si ese alto cabe en la ventana. Los 4 motores reales (ROCAS de SPEC 04, CAÍDA de SPEC 08, BLOQUE BUSTER de SPEC 09, SERPENTINA de SPEC 10) usan canvas internos fijos de 800×600 y controles exclusivamente de teclado, así que cuando el bisel resultante es más alto que el viewport, la parte inferior del área de juego (y la barra `.crt-bottom`) queda fuera de la pantalla sin ninguna forma de verla mientras se juega — no hay controles táctiles ni forma de hacer scroll y jugar a la vez. Se verificó en vivo con el navegador: en una ventana de escritorio de 1024×600, el canvas de ROCAS se corta antes de la mitad inferior del juego.

## Scope

**In:**

- `components/jugar-client.tsx` mide en tiempo real, mediante `ResizeObserver` (sobre el contenedor del Reproductor y/o `window`), el alto disponible real para el bisel `.crt`: el alto del viewport menos la posición vertical en la que empieza `.crt` y un margen inferior de respiro, y el "chrome" propio del bisel (padding del marco + barra `.crt-bottom` + su margen), medido comparando el alto real de `.crt` frente al de `.crt-screen` una vez montado.
- Con ese alto disponible y el ancho disponible (el mismo contenedor, ya limitado por el `max-width: 1100px` existente de `.av-player`), se calcula el ancho máximo que el bisel puede ocupar sin que su alto proyectado (a 4:3) exceda el alto disponible, y se aplica como estilo inline (`maxWidth`) sobre el div `.crt`.
- El recálculo se repite en cada evento de redimensionado de ventana (vía `ResizeObserver`), de forma que cambiar el tamaño de la ventana con el juego abierto ajusta el bisel en vivo, sin recargar la página.
- El arreglo vive enteramente en la pantalla compartida del Reproductor (`components/jugar-client.tsx` y, si hace falta, ajustes menores en `app/globals.css`), por lo que beneficia por igual a los 4 juegos con motor real y a los juegos que aún muestran la simulación falsa de SPEC 01 (mismo componente, mismo `.crt`).
- El límite de ancho existente de 1100px se conserva como uno de los dos límites que combina el cálculo (junto con el nuevo límite derivado del alto): en pantallas grandes el bisel no crece más de lo que ya crecía hoy.

**Out of scope (para specs futuros):**

- Cambios a la resolución interna de los canvas (`canvas.width`/`canvas.height`, fijos en 800×600) o a la lógica de cualquier `lib/*-engine.ts` — el problema es de layout del contenedor, no de escalado de gameplay.
- Controles táctiles o de ratón para jugar en móvil — sigue sin ser parte de ningún motor real (decidido en SPEC 04/08/09/10).
- Nitidez del canvas en pantallas de alta densidad (`devicePixelRatio`) — no es el problema reportado en este spec (se investigó y se descartó como causa; el bisel sí se ve nítido, solo se recorta verticalmente).
- Un tamaño mínimo (`min-height`) por debajo del cual se fuerce scroll en vez de seguir encogiendo el bisel — ver Decisiones.
- Aprovechar más espacio horizontal en monitores muy grandes/ultra-wide subiendo el límite de 1100px — no reportado como problema, se mantiene el límite actual.

## Data model

No se introduce persistencia ni tipos nuevos. Es un cambio de layout dentro de `components/jugar-client.tsx` (estado local de React para el tamaño calculado) y, si hace falta, de `app/globals.css`.

## Implementation plan

1. En `components/jugar-client.tsx`, añadir refs a los divs `.crt` y `.crt-screen`, y un estado `crtMaxWidth: number | undefined`. Añadir un `useEffect` que monte un `ResizeObserver` (observando `window`/el contenedor del Reproductor) y, en cada disparo, mida `crtRef.getBoundingClientRect()` y `crtScreenRef.getBoundingClientRect()` para obtener el "chrome" vertical propio del bisel (alto de `.crt` menos alto de `.crt-screen`), calcule el alto disponible (`window.innerHeight` menos la posición superior de `.crt` menos un margen inferior fijo de respiro), derive el alto máximo utilizable por `.crt-screen`, lo convierta a ancho máximo (`× 4/3`), y actualice `crtMaxWidth` con el menor valor entre ese resultado y el ancho de contenedor disponible (que ya respeta el `max-width: 1100px` existente). Verificación: el valor se puede observar en React DevTools al redimensionar la ventana; aún no se aplica visualmente.
2. Aplicar `crtMaxWidth` como `style={{ maxWidth: crtMaxWidth ? \`${crtMaxWidth}px\` : undefined }}`en el div`.crt`, dejando el CSS existente (`max-width: 1100px`en`.av-player`, `aspect-ratio: 4/3`en`.crt-screen`) como comportamiento por defecto antes de la primera medición (sin parpadeo perceptible: la primera medición ocurre en el mismo ciclo de montaje). Verificación manual en `/juego/rocas/jugar`con la ventana en 1024×600: el bisel completo, incluida la barra`.crt-bottom`, es visible sin necesidad de hacer scroll.
3. Probar manualmente en los 4 juegos con motor real (`rocas`, `caida`, `bloque-buster`, `serpentina`) y en al menos un juego con simulación falsa, en varios tamaños de ventana de escritorio (1024×600, 1920×1080, y una ventana muy baja tipo 1200×450) y en móvil (390×844 portrait y ~800×390 landscape), que el bisel nunca se recorta verticalmente y que redimensionar la ventana en vivo con el juego abierto reajusta el tamaño sin recargar la página. Ejecutar `npm run lint` y `npm run build`. Verificación: los criterios de aceptación siguientes se cumplen y ambos comandos terminan sin errores.

## Acceptance criteria

- [ ] En una ventana de escritorio de 1024×600 en `/juego/rocas/jugar`, el bisel `.crt` completo (incluida la barra `.crt-bottom`) es visible sin necesidad de hacer scroll.
- [ ] El mismo comportamiento se confirma en `/juego/caida/jugar`, `/juego/bloque-buster/jugar` y `/juego/serpentina/jugar`.
- [ ] Un juego sin motor real (simulación falsa de SPEC 01) también respeta el nuevo límite de alto, sin recortarse en la misma ventana de 1024×600.
- [ ] En una ventana de escritorio grande (≥1920×1080), el bisel conserva el tamaño máximo actual (limitado por `max-width: 1100px`), sin regresión respecto al comportamiento previo.
- [ ] En móvil portrait (≈390×844) el layout no cambia visualmente respecto al comportamiento actual (el ancho sigue siendo el límite dominante, no el alto).
- [ ] En móvil landscape o ventanas muy bajas (≈800×390), el bisel se reduce de tamaño (manteniendo proporción 4:3) lo necesario para que no se recorte verticalmente.
- [ ] Redimensionar la ventana del navegador con un juego abierto recalcula el tamaño del bisel en vivo, sin recargar la página.
- [ ] La resolución interna de los canvas (800×600) y el comportamiento de cada motor (`lib/*-engine.ts`) no cambian.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** medir el alto disponible con `ResizeObserver`/JS en `components/jugar-client.tsx`, en vez de CSS con `dvh` y un offset fijo estimado — decidido con el usuario: es más robusto ante cambios de alto del bloque HUD (por ejemplo, si los botones PAUSA/FIN/SALIR envuelven a una segunda línea en pantallas estrechas, un offset fijo en CSS se desajustaría).
- **Sí:** aplicar el arreglo a la pantalla compartida del Reproductor, afectando también a los juegos que aún muestran la simulación falsa — decidido con el usuario: es el mismo componente y el mismo `.crt` para todos los juegos, no se bifurca el layout solo para los 4 con motor real.
- **Sí:** conservar el límite de ancho existente de 1100px como uno de los dos límites del cálculo — no se cambia el tamaño máximo del bisel en pantallas grandes respecto al comportamiento actual, solo se añade el límite de alto que faltaba.
- **No:** no se toca la resolución interna de los canvas ni la lógica de ningún motor — el problema verificado es de layout del contenedor (`.crt`/`.crt-screen`), no de escalado de gameplay ni de nitidez por `devicePixelRatio` (se investigó esa hipótesis primero y se descartó tras confirmar con el usuario que el síntoma real era el recorte vertical, no la falta de nitidez).
- **No:** no se define un `min-height` ni un tamaño mínimo por debajo del cual se fuerce scroll — se deja que el bisel encoja proporcionalmente sin piso explícito; ventanas extremadamente bajas quedan como riesgo aceptado (ver Riesgos).

## Risks

| Riesgo                                                                                                                                                                                    | Mitigación                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ventanas extremadamente bajas (p. ej. <300px de alto) podrían encoger el bisel hasta un tamaño donde el HUD dibujado dentro del propio canvas (panel lateral de CAÍDA) se vuelva ilegible | Aceptado explícitamente (ver Decisiones): no se define un piso mínimo en este spec; es un caso extremo de uso de ventana, no el escenario reportado.                                           |
| Recalcular en cada evento de `ResizeObserver` sin limitar la frecuencia podría causar recálculos excesivos durante un arrastre de redimensionado                                          | El propio `ResizeObserver` del navegador ya agrupa los cambios por frame; si en la implementación se nota coste perceptible, se puede añadir un debounce corto sin cambiar el resultado final. |
| El estilo inline `maxWidth` en `.crt` podría interactuar de forma inesperada con las reglas responsive existentes (`@media (max-width: 720px)`)                                           | Se verifica manualmente cada breakpoint existente como parte del paso 3 del plan de implementación, antes de dar el spec por cumplido.                                                         |

## What is **not** in this spec

- Cambios a la resolución interna de los canvas o a la lógica de cualquier motor real.
- Controles táctiles/de ratón para jugar en móvil.
- Nitidez del canvas en pantallas de alta densidad (`devicePixelRatio`).
- Un tamaño mínimo forzado con scroll para ventanas extremadamente bajas.
- Aumentar el límite de 1100px de ancho máximo en monitores grandes.

Cada uno de estos, si se implementa, va en su propio spec.
