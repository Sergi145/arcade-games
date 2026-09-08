# SPEC 02 — Página de Inicio (Home)

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-09-08
> **Objective:** Migrar la landing page `home.jsx` del prototipo de referencia (`references/templates/home-about/`) a `app/page.tsx`, convirtiendo la ruta `/` en la nueva página de Inicio y moviendo la Biblioteca actual a `/biblioteca`.

## Por qué existe este spec

SPEC 01 implementó `/` como la Biblioteca porque el prototipo de referencia todavía no se había explorado del todo. El prototipo real (`references/templates/home-about/`) separa Inicio (`home.jsx`) de Biblioteca (grid de juegos) como pantallas distintas, con Inicio como puerta de entrada. Este spec introduce esa landing page, lo que obliga a reubicar la Biblioteca y actualizar los enlaces internos que hoy asumen que "/" es la Biblioteca.

## Scope

**In:**

- Nueva página de Inicio en `app/page.tsx`, migrando fielmente `home.jsx`: hero con siluetas flotantes decorativas, sección "¿Por qué Arcade Vault?" (4 feature cards), preview de juegos (6 primeros de `GAMES` en `mini-card`), sección de stats, "Actividad en Vivo" (ticker de puntuaciones + top 5 jugadores), sección de precios (plan único gratis + FAQ), y CTA final.
- Animación de aparición al hacer scroll (`reveal`/`in` vía `IntersectionObserver`), igual que el template.
- Mover el contenido actual de `app/page.tsx` (Biblioteca) a `app/biblioteca/page.tsx`, sin cambios funcionales.
- Añadir al `app/globals.css` el bloque de estilos "HOME PAGE" de `references/templates/home-about/styles.css` (siluetas, hero, feature cards, mini-rail, stats, sección final, `.reveal`).
- Actualizar `components/nav.tsx`: añadir el enlace "Inicio" (→ `/`) antes de "Biblioteca", y apuntar "Biblioteca" a `/biblioteca`, en escritorio y en el panel móvil, con estados activos correctos.
- Actualizar los enlaces internos que hoy asumen que "/" es la Biblioteca para que apunten a `/biblioteca`: botón "VOLVER AL VAULT" en `app/juego/[id]/page.tsx`, botón "VOLVER A LA BIBLIOTECA" en `app/salon-de-la-fama/page.tsx`, y botón "VOLVER AL VAULT" del modal de fin de partida en `app/juego/[id]/jugar/page.tsx`.
- Botones de la Home enlazan a rutas reales: "EXPLORAR JUEGOS" / "VER TODOS LOS JUEGOS" / CTA final → `/biblioteca`; "CREAR CUENTA" / "EMPEZAR GRATIS" → `/login`; cada `mini-card` → `/juego/[id]`; "VER SALÓN →" → `/salon-de-la-fama`.

**Out of scope (para specs futuros):**

- Página "Acerca de" (`about.jsx`) y su formulario de contacto — pantalla independiente con su propia lógica de estado, se aborda en un spec propio.
- Cualquier dato real detrás del ticker "Actividad en Vivo" o el "Top Jugadores · Hoy" — se copian tal cual del template como arrays estáticos, igual que en el prototipo. No se conectan a `lib/scores.ts` ni a partidas reales.
- Cambios a la lógica de sesión, créditos o autenticación.
- Los redirects de `/login` (login y "jugar como invitado") siguen apuntando a `/`, que ahora es la Home en vez de la Biblioteca — es un cambio de comportamiento implícito y deliberado (ver Decisions), no un ítem de trabajo adicional.

## Data model

No se introduce ningún dato o estructura nueva. La sección "Juegos disponibles ahora" reutiliza `GAMES` de `lib/games.ts` (ya existente, `GAMES.slice(0, 6)`). El ticker de actividad y el top-5 de jugadores son arrays literales embebidos en el componente, copiados de `home.jsx`, sin tipo compartido con `lib/scores.ts`.

## Implementation plan

1. Mover el contenido íntegro de `app/page.tsx` a `app/biblioteca/page.tsx` (mismo componente, sin cambios). Verificación: `/biblioteca` muestra la Biblioteca exactamente igual que antes; `/` sigue existiendo pero temporalmente vacío o roto (se completa en el paso 3).
2. Añadir el bloque de estilos "HOME PAGE" de `references/templates/home-about/styles.css` (siluetas `.home-silos`, `.home-hero`, `.feature-grid`, `.mini-rail`, `.home-stats`, `.activity-grid`/`.ticker`/`.top-list`, `.pricing-grid`/`.price-card`/`.pricing-faq`, `.home-final`, `.reveal`) al final de `app/globals.css`. Verificación: no hay errores de build ni de lint tras el `npm run build`.
3. Crear el nuevo `app/page.tsx` (cliente) migrando `home.jsx`: hook de reveal-on-scroll, `FloatingSilhouettes`, `FeatureIcon`, `MiniCard` como funciones internas del archivo (igual que en el template), y las 6 secciones (hero, why, games preview, stats, actividad en vivo, precios, CTA final), usando `GAMES` de `lib/games.ts` y los arrays estáticos de ticker/top-jugadores copiados del template. Botones usan `next/link`/`useRouter` hacia `/biblioteca`, `/login`, `/juego/[id]` y `/salon-de-la-fama` según corresponda. Verificación: `/` muestra la Home completa con las 7 secciones visibles al hacer scroll.
4. Actualizar `components/nav.tsx`: añadir enlace "Inicio" (→ `/`) antes de "Biblioteca", cambiar el href de "Biblioteca" a `/biblioteca`, y recalcular `isBiblioteca` como `pathname === "/biblioteca" || pathname.startsWith("/juego")` e `isHome` como `pathname === "/"`. Replicar los mismos cambios en el panel móvil. Verificación: en `/` el enlace activo es "Inicio"; en `/biblioteca` o `/juego/[id]` el enlace activo es "Biblioteca".
5. Actualizar los tres botones de "volver" que hoy apuntan a `/` para que apunten a `/biblioteca`: `app/juego/[id]/page.tsx` ("VOLVER AL VAULT"), `app/salon-de-la-fama/page.tsx` ("VOLVER A LA BIBLIOTECA"), `app/juego/[id]/jugar/page.tsx` ("VOLVER AL VAULT" del modal de fin de partida). Verificación: cada botón navega a `/biblioteca`, no a `/`.
6. Ejecutar `npm run lint` y `npm run build`, y recorrer manualmente `/`, `/biblioteca`, la navegación del Nav (escritorio y móvil) y los tres botones de "volver" actualizados.

## Acceptance criteria

- [ ] `/` muestra la página de Inicio: hero con título en 3 líneas y CTAs "EXPLORAR JUEGOS"/"CREAR CUENTA", siluetas flotantes decorativas, sección de 4 feature cards, preview de 6 juegos, sección de stats, "Actividad en Vivo" (ticker + top 5), sección de precios con FAQ, y CTA final.
- [ ] `/biblioteca` muestra el mismo contenido que antes tenía `/` (buscador, chips de categoría, grid de 8 juegos).
- [ ] Las secciones marcadas `reveal` en la Home aparecen con fade-in al hacer scroll hasta ellas.
- [ ] El botón "EXPLORAR JUEGOS" del hero y "VER TODOS LOS JUEGOS →" navegan a `/biblioteca`.
- [ ] El botón "CREAR CUENTA" del hero y "EMPEZAR GRATIS →" de precios navegan a `/login`.
- [ ] Cada `mini-card` de la sección "Juegos disponibles ahora" navega a `/juego/[id]` del juego correspondiente.
- [ ] El botón "VER SALÓN →" navega a `/salon-de-la-fama`.
- [ ] El CTA final ("INSERTAR MONEDA →") navega a `/biblioteca`.
- [ ] En la Nav, el enlace "Inicio" aparece antes que "Biblioteca", y ambos existen en escritorio y en el panel móvil.
- [ ] En `/` el enlace activo de la Nav es "Inicio"; en `/biblioteca` o en `/juego/[id]` el enlace activo es "Biblioteca".
- [ ] El botón "VOLVER AL VAULT" en `/juego/[id]` navega a `/biblioteca`.
- [ ] El botón "VOLVER A LA BIBLIOTECA" en `/salon-de-la-fama` navega a `/biblioteca`.
- [ ] El botón "VOLVER AL VAULT" del modal de fin de partida en `/juego/[id]/jugar` navega a `/biblioteca`.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** Inicio pasa a ocupar `/`, y la Biblioteca se mueve a `/biblioteca`. Es el comportamiento del template (Home como puerta de entrada) y lo idiomático para un sitio con landing propia — decidido explícitamente durante la fase de preguntas.
- **No:** Incluir la página "Acerca de" (`about.jsx`) en este spec, aunque comparte carpeta de referencia (`home-about`) con Home. Son pantallas independientes con lógica propia (formulario de contacto); se aborda en un spec futuro — decidido explícitamente durante la fase de preguntas.
- **Sí:** Copiar literalmente los arrays de "Actividad en Vivo" y "Top Jugadores · Hoy" del template, en vez de derivarlos de `lib/scores.ts`. Son datos decorativos fijos en el propio prototipo, no partidas reales — decidido explícitamente durante la fase de preguntas.
- **Sí:** Actualizar el Nav para incluir "Inicio" junto a "Biblioteca" y "Salón de la Fama" (sin "Acerca de", al quedar fuera de scope) — decidido explícitamente durante la fase de preguntas.
- **Sí:** Los tres botones de "volver" que hoy dependen de que `/` sea la Biblioteca (`VOLVER AL VAULT` en Detalle y en Reproductor, `VOLVER A LA BIBLIOTECA` en Salón de la Fama) se redirigen a `/biblioteca`. Su etiqueta dice explícitamente "vault"/"biblioteca", así que deben seguir aterrizando en el grid de juegos, no en la nueva Home.
- **No:** Cambiar los redirects de `/login` (`router.push("/")` tras iniciar sesión o tras "jugar como invitado"). Se dejan igual, lo que significa que ahora aterrizan en la Home en vez de en la Biblioteca — es un cambio de comportamiento implícito aceptado, no un objetivo de este spec.
- **Sí:** Definir `FloatingSilhouettes`, `FeatureIcon` y `MiniCard` como funciones internas de `app/page.tsx`, igual que en `home.jsx`, en vez de extraerlas a `components/`. Son específicas de esta pantalla y no se reutilizan en ningún otro sitio del proyecto.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Mover la Biblioteca de `/` a `/biblioteca` puede dejar enlaces externos o marcadores rotos | Aceptado: el proyecto está en desarrollo (branch `home-view`), sin usuarios reales todavía. |
| Enlaces olvidados que aún asuman que `/` es la Biblioteca | El paso 5 del plan de implementación lista explícitamente los tres sitios conocidos que lo hacían; se verifica con una pasada manual tras el build. |

## What is **not** in this spec

- La página "Acerca de" y su formulario de contacto (`about.jsx`).
- Cualquier dato real (partidas jugadas, scores) detrás de "Actividad en Vivo" o "Top Jugadores".
- Cambios a créditos, sesión o autenticación real.

Cada uno de estos, si se implementa, va en su propio spec.
