# SPEC 01 — Pantallas visuales del MVP de Arcade Vault

> **Status:** Implemented
> **Depends on:** Ninguna
> **Date:** 2026-09-08
> **Objective:** Migrar las 5 pantallas visuales del prototipo de referencia (Biblioteca, Detalle, Reproductor, Login y Salón de la Fama) a rutas reales de Next.js App Router, con datos mock, sin implementar mecánica de juego real.

## Por qué existe este spec

`references/templates/` contiene un prototipo funcional en React puro (CDN, sin build, enrutado por `location.hash`) con una identidad visual neón/retro ya definida (`styles.css`, fuentes Press Start 2P + JetBrains Mono). Este spec traslada ese prototipo al proyecto Next.js real, cambiando el modelo de enrutado a rutas de App Router y decidiendo qué comportamiento del prototipo se conserva tal cual (persistencia, simulación de partida) y qué se resuelve de forma distinta por ser ahora una app con rutas reales.

## Scope

**In:**

- 5 pantallas: Biblioteca (`/`), Detalle de juego (`/juego/[id]`), Reproductor (`/juego/[id]/jugar`), Login (`/login`) y Salón de la Fama (`/salon-de-la-fama`).
- Nav compartida (enlaces, contador de créditos decorativo, botón de sesión, menú móvil) y footer, en `app/layout.tsx`.
- Identidad visual completa del template (paleta, tipografías, fondo con grid en perspectiva, scanlines, efecto CRT, tarjetas con tilt) portada a `app/globals.css`.
- Datos mock de los 8 juegos (`GAMES`) y generador determinista de puntuaciones (`seededScores`) portados a TypeScript.
- Sesión de usuario mock (login/invitado/logout) y puntuaciones guardadas, persistidas en `localStorage`.
- Simulación visual de partida en el Reproductor (puntuación que sube sola, pausa, fin de partida, guardar puntuación), igual que el template.

**Out of scope (para specs futuros):**

- Mecánica real de cualquiera de los 8 juegos.
- Backend, base de datos o autenticación real (proveedor de identidad, validación de credenciales).
- Sistema de créditos/monedas funcional.
- Login social (Google/GitHub) funcional — quedan como botones decorativos.
- Que el Salón de la Fama o el leaderboard del Detalle reflejen partidas realmente jugadas (siguen siendo datos seedeados/mock, igual que en el template).
- Sonido, internacionalización, y cualquier ajuste de accesibilidad más allá del markup heredado del template.

## Data model

```ts
// lib/games.ts
type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
type GameColor = "cyan" | "magenta" | "yellow" | "green";

type Game = {
  id: string; // slug, p.ej. "bloque-buster"
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string; // clase CSS del degradado de portada, p.ej. "cover-bricks"
  color: GameColor;
  best: number;
  plays: string; // p.ej. "12.4K"
};

const CATS: Array<"TODOS" | GameCategory> = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];

// lib/scores.ts
type ScoreRow = { rank: number; name: string; score: number; date: string };
// seededScores(seed: number, count?: number): ScoreRow[] — mismo algoritmo pseudoaleatorio del template

// lib/session.ts
type SessionUser = { name: string };
type SavedScore = { game: string; score: number; name: string; at: number };
```

Claves de `localStorage` (versionadas, distintas de las del template `av_user`/`av_scores` para poder migrar el esquema más adelante):

- `av:user:v1` — `SessionUser | null`.
- `av:scores:v1` — `SavedScore[]`.

## Implementation plan

1. Añadir las fuentes de Google (Press Start 2P, JetBrains Mono, Courier Prime) vía `next/font/google` y portar `references/templates/styles.css` a `app/globals.css` (variables de color, fondo con grid/scanlines, resets base). Verificación: `npm run dev` muestra un fondo oscuro con grid y tipografía correcta en una página en blanco.
2. Crear `lib/games.ts` con el array `GAMES`, el tipo `Game` y `CATS`, portados de `references/templates/data.jsx`.
3. Crear `lib/scores.ts` con `seededScores()` y el tipo `ScoreRow`, portado del mismo archivo.
4. Crear `lib/session.ts` con un `SessionProvider` (contexto de cliente) que expone `user`, `login(user)`, `logout()`, `saveScore(entry)`, leyendo/escribiendo `av:user:v1` y `av:scores:v1`, con fallback a estado en memoria si `localStorage` no está disponible.
5. Actualizar `app/layout.tsx`: envolver `children` en `SessionProvider`, renderizar las capas de fondo (`.av-bg`, ruido), la `Nav` y el footer (texto `© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0`).
6. Crear `components/nav.tsx` (cliente): enlaces a `/` y `/salon-de-la-fama`, contador de créditos estático "CRÉDITOS · 03", botón "Iniciar Sesión" (→ `/login`) o nombre de usuario (click = `logout()`), menú móvil con hamburguesa, usando `useSession()`.
7. Crear `components/game-card.tsx` (cliente, efecto tilt con `onMouseMove`) y `app/page.tsx` (Biblioteca): hero, buscador, chips de categoría, grid de tarjetas, estado vacío "NO HAY RESULTADOS", cada tarjeta navega a `/juego/[id]`.
8. Crear `app/juego/[id]/page.tsx` (Detalle): portada, tags, descripción, stat strip (partidas, mejor global, dificultad), botones "JUGAR AHORA" (→ `/juego/[id]/jugar`) y "VOLVER AL VAULT" (→ `/`), aside con leaderboard de 10 filas vía `seededScores`. `notFound()` si el `id` no existe en `GAMES`.
9. Crear `app/juego/[id]/jugar/page.tsx` (Reproductor, cliente): HUD (jugador, puntuación, vidas, nivel), pantalla CRT decorativa, botones Pausa/Fin/Salir, puntuación que sube sola cada ~220ms mientras no está en pausa ni terminado, nivel derivado de la puntuación, modal de fin de partida con input de iniciales y "GUARDAR PUNTUACIÓN" (→ `saveScore()`), "JUGAR DE NUEVO" reinicia el estado.
10. Crear `app/login/page.tsx` (Auth, cliente): pestañas "INICIAR SESIÓN"/"CREAR CUENTA", campos de formulario (correo solo en la segunda pestaña), envío llama a `login()` y redirige a `/`, botón "JUGAR COMO INVITADO" llama a `logout()` y redirige a `/`, botones sociales decorativos sin acción.
11. Crear `app/salon-de-la-fama/page.tsx` (cliente): pestañas por juego, podio (top 3), tabla de 12 filas, fila "TU MEJOR MARCA" cuando hay sesión iniciada, botón "VOLVER A LA BIBLIOTECA" (→ `/`).
12. Ejecutar `npm run lint` y `npm run build`, y recorrer manualmente todas las rutas y acciones descritas en los criterios de aceptación.

## Acceptance criteria

- [ ] `npm run dev` levanta la app sin errores en consola.
- [ ] `/` muestra la Biblioteca con buscador, chips de categoría y una grid con los 8 juegos de `GAMES`.
- [ ] Filtrar por categoría o buscar por texto reduce la grid a los juegos que coinciden; sin coincidencias se muestra "NO HAY RESULTADOS".
- [ ] Cada tarjeta de juego navega a `/juego/[id]` al hacer click.
- [ ] `/juego/[id]` con un id válido muestra portada, tags, descripción, stat strip y una tabla de 10 puntuaciones.
- [ ] `/juego/[id]` con un id inexistente devuelve la página 404 de Next.js.
- [ ] El botón "JUGAR AHORA" navega a `/juego/[id]/jugar`.
- [ ] En `/juego/[id]/jugar` la puntuación sube sola cada ~220ms mientras no está en pausa ni terminada la partida.
- [ ] El botón "PAUSA"/"REANUDAR" detiene y reanuda el incremento de puntuación.
- [ ] El botón "FIN" abre el modal de fin de partida con la puntuación final mostrada.
- [ ] Guardar la puntuación en el modal la añade a `av:scores:v1` en `localStorage` y muestra "PUNTUACIÓN GUARDADA_".
- [ ] "JUGAR DE NUEVO" reinicia puntuación, vidas y nivel, y cierra el modal.
- [ ] En `/login`, alternar entre "INICIAR SESIÓN" y "CREAR CUENTA" muestra/oculta el campo de correo electrónico.
- [ ] Enviar el formulario de login guarda el usuario en `av:user:v1` y redirige a `/`.
- [ ] "JUGAR COMO INVITADO" limpia la sesión (`av:user:v1` a `null`) y redirige a `/`.
- [ ] Con sesión iniciada, la Nav muestra el nombre de usuario en vez del botón "Iniciar Sesión"; al hacer click sobre el nombre se cierra la sesión.
- [ ] `/salon-de-la-fama` muestra pestañas por juego, un podio con los 3 primeros y una tabla de 12 filas para el juego seleccionado.
- [ ] Con sesión iniciada, `/salon-de-la-fama` añade al final de la tabla una fila "TU MEJOR MARCA EN [JUEGO]".
- [ ] El menú móvil (hamburguesa) abre y cierra un panel lateral con los mismos enlaces que la Nav de escritorio.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** rutas reales de Next.js App Router (`/`, `/juego/[id]`, `/juego/[id]/jugar`, `/login`, `/salon-de-la-fama`) en vez del router por hash del template. Es lo idiomático en App Router y da URLs navegables/compartibles.
- **No:** mantener el router por hash del template — rompería con las convenciones de un proyecto Next.js real.
- **Sí:** persistir sesión y puntuaciones guardadas en `localStorage`, igual que el template, pero con claves versionadas `av:user:v1` / `av:scores:v1` en vez de `av_user`/`av_scores`, para poder migrar el esquema más adelante sin romper datos existentes.
- **Sí:** mantener el auto-incremento simulado de puntuación en el Reproductor. Es una maqueta visual de "estar jugando" (sin input real del jugador ni mecánica propia), no un juego — decidido explícitamente durante la fase de preguntas.
- **Sí:** portar `styles.css` casi literalmente a `app/globals.css` en vez de reescribirlo en utilidades Tailwind, priorizando la fidelidad visual al template. Tailwind v4 sigue disponible en el proyecto para trabajo futuro.
- **Sí:** centralizar la sesión en un `SessionProvider` de cliente en `app/layout.tsx`, en vez de leer `localStorage` de forma independiente en cada pantalla — evita relecturas duplicadas y refleja el patrón del `App` raíz del template.
- **No:** autenticación real o backend — cualquier usuario/contraseña se acepta, igual que el template.
- **No:** leer `av:scores:v1` de vuelta para construir el leaderboard del Detalle o el Salón de la Fama — se conserva el comportamiento del template de mostrar siempre datos seedeados/mock, no las partidas realmente guardadas.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `localStorage` no disponible (modo privado / navegador restringido) | `SessionProvider` hace fallback a estado en memoria; login, invitado y guardar puntuación funcionan durante la sesión aunque no persistan tras recargar. |
| Las fuentes de Google Fonts no cargan (sin red) | Las variables `--pixel`/`--mono` mantienen el fallback `system-ui, monospace` del template. |

## What is **not** in this spec

- Mecánica real de ninguno de los 8 juegos (Bloque Buster, Caída, Serpentina, Glotón, Invasores, Rocas, Ranaria, Duelo Pixel).
- Autenticación real, backend o base de datos.
- Sistema de créditos/monedas funcional (el contador es decorativo).
- Login social (Google/GitHub) funcional.
- Leaderboards calculados a partir de partidas realmente jugadas.
- Sonido, internacionalización o auditoría de accesibilidad más allá de lo heredado del template.

Cada uno de estos, si se implementa, va en su propio spec.
