# SPEC (game-jam) — CREMA

> **Status:** Draft
> **Depends on:** Ninguno
> **Date:** 2026-09-14
> **Objective:** Añadir CREMA, un juego PUZZLE en el que el jugador saca café espresso equilibrando temperatura, presión y tiempo de extracción en tiempo real antes de que la taza se queme o quede aguada.

## Por qué existe este spec

Es la propuesta 2 de la game jam "un juego sobre café" (2026-09-14), con tres restricciones fijas del jam: categoría `PUZZLE`, mecánica core de gestión de un recurso bajo presión (temperatura/presión/tiempo de extracción en tiempo real, con barras/diales que suben y bajan) y color `yellow`. No hay ningún prototipo de café en `references/started-games/`, así que este es un juego construido desde cero (Caso B del skill `add-arcade-game`, sin fila previa en `games`).

## Scope

**In:**

- Una fila nueva en `games` con `id: "crema"`, `title: "CREMA"`, `cat: "PUZZLE"`, `color: "yellow"` y una portada propia (`cover-crema`).
- `lib/crema-engine.ts`: motor real con la factoría `createCremaEngine(canvas, { onUpdate })`, bucle `requestAnimationFrame` con `dt` capado a 0.05s, y la mecánica core: dos diales que derivan solos (TEMPERATURA, PRESIÓN) corregibles con teclado, y una barra de TIEMPO de extracción que avanza sola desde el inicio de cada ronda.
- Reglas de puntuación binarias, tal como pide el jam: cortar la extracción (Space) con TEMPERATURA, PRESIÓN y TIEMPO dentro de su zona objetivo = taza perfecta, suma puntos; cortar fuera de zona, o dejar que TIEMPO se pase de su máximo sin cortar, = mala tirada, resta una vida.
- Dificultad progresiva: cada 3 tazas perfectas sube el nivel, las zonas objetivo se estrechan y la deriva de los diales se acelera.
- `components/crema-canvas.tsx` calcando el patrón de `components/rocas-canvas.tsx` (montaje/desmontaje del engine, `useImperativeHandle`, `onUpdateRef`).
- Registro de `crema: CremaCanvas` en `REAL_GAMES` (`components/real-game-registry.tsx`).
- Verificación con `npm run lint`, `npm run build` y una partida manual completa en `/juego/crema/jugar`, incluyendo guardado de puntuación real.

**Out of scope (para specs futuros):**

- Una cuarta variable ("molienda", "tueste") o mecánicas de café adicionales (latte art, gestión de un local, pedidos con leche/ratios).
- Modo versus o multijugador — la categoría es PUZZLE en solitario.
- Cualquier cambio a `app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx`, `components/salon-de-la-fama-client.tsx`, `components/game-card.tsx` o `lib/session.tsx` — el leaderboard genérico por `game_id` ya funciona sin tocarlos.
- Sonido o música específica del juego más allá del HUD compartido ya existente.
- El refactor del Paso 0 del skill `add-arcade-game` (generalizar `RealGameState`) — ya está hecho: `RealGameState` vive en `components/real-game-registry.tsx` y los 4 motores reales actuales (`rocas`, `caida`, `bloque-buster`, `serpentina`) ya lo usan.

## Data model

Este spec no introduce persistencia nueva. Reutiliza el shape de la tabla `games` (sembrado por SPEC 05/07: `id, title, short, long, cat, cover, color, best, plays`, con `best=0, plays=0` iniciales que el trigger de SPEC 07 actualiza solo) y el tipo `RealGameState` ya exportado por `components/real-game-registry.tsx`:

```ts
export type RealGameState = {
  score: number;
  lives: number;
  level: number;
  gameOver: boolean;
};
```

La única fila nueva en `games`, a insertar vía `mcp__supabase__apply_migration`:

```sql
insert into games (id, title, short, long, cat, cover, color, best, plays)
values (
  'crema',
  'CREMA',
  'Domina la temperatura y la presión antes de que la taza se queme.',
  'Cada pedido marca una zona objetivo de temperatura, presión y tiempo de extracción. Corrige los diales con el teclado y corta el disparo en el momento justo: una taza perfecta suma puntos, una mala tirada cuesta una vida.',
  'PUZZLE',
  'cover-crema',
  'yellow',
  0,
  0
);
```

El único estado nuevo es **interno del motor** (`lib/crema-engine.ts`), nunca persistido ni expuesto fuera de `onUpdate` — se ilustra para dejar clara la mecánica, no es un modelo de datos de la app:

```ts
// Interno, vive solo dentro del engine; no se persiste ni se exporta.
type Dial = {
  value: number; // 0-100
  target: [number, number]; // zona objetivo actual
  drift: number; // velocidad de deriva, unidades/seg
};

type RoundState = {
  temperatura: Dial;
  presion: Dial;
  tiempo: { value: number; max: number; target: [number, number] };
  perfectCupsThisLevel: number;
};
```

Convenciones:

- Diales en escala 0-100 (no grados/bar reales) para que las zonas objetivo y su estrechamiento por nivel sean simples de calcular y dibujar.
- `tiempo.value` avanza sola en cada frame (`+= dt * velocidad`); `temperatura.value` y `presion.value` derivan solas con un paseo aleatorio acotado y se corrigen con teclado.

## Implementation plan

1. **Identidad del juego (Paso 1, Caso B del skill `add-arcade-game`):** aplicar la migración SQL de arriba con `mcp__supabase__apply_migration` para insertar la fila `crema` en `games`, y añadir la clase `.cover-crema` en `app/globals.css` siguiendo el patrón ya existente de `.cover-bricks`/`.cover-tetro`/`.cover-snake` (`.cover-bg` como base + `background`/gradiente/`::after` propios, tonos amarillo/ámbar). Verificación: `select id, cat, color from games where id = 'crema'` devuelve la fila nueva; `/biblioteca` muestra la portada nueva sin errores visuales (el juego sigue en simulación falsa hasta el paso 5).
2. **Esqueleto del motor:** crear `lib/crema-engine.ts` con la factoría `createCremaEngine(canvas: HTMLCanvasElement, { onUpdate }: { onUpdate: (state: RealGameState) => void })` devolviendo el handle (`pause`, `resume`, `reset`, `forceGameOver`, `destroy`) y un bucle `requestAnimationFrame` con `dt` capado a 0.05s que solo pinta el fondo del canvas de 800×600. Verificación: el archivo compila y `npm run lint` pasa sobre él.
3. **Diales y ronda:** implementar dentro del motor los dos diales con deriva aleatoria acotada (TEMPERATURA, PRESIÓN) y su corrección por teclado (`←`/`→` para temperatura, `↑`/`↓` para presión, registrados con `addEventListener` dentro de la factoría y liberados en `destroy()`), más la barra de TIEMPO que avanza sola desde el inicio de cada ronda; dibujar los tres indicadores y sus zonas objetivo en el canvas. Verificación manual: al abrir `/juego/crema/jugar` (una vez registrado en el paso 5) los diales derivan solos y responden a las teclas.
4. **Corte de extracción y puntuación:** al pulsar `Space`, si TEMPERATURA y PRESIÓN están dentro de su zona y TIEMPO dentro de la suya → taza perfecta (`score += 100 * level`, arranca la siguiente ronda); si se pulsa fuera de zona, o TIEMPO supera su máximo sin pulsar `Space` → mala tirada (`lives -= 1`, arranca la siguiente ronda igualmente); cada 3 tazas perfectas consecutivas sube `level` en 1 y estrecha las zonas objetivo / acelera la deriva; al llegar `lives` a 0, `gameOver = true`. Llamar `onUpdate(state)` cada frame con el `RealGameState` completo. Verificación manual: encadenar una taza perfecta y una mala confirma que `score`, `lives` y `level` cambian exactamente como se describe.
5. **Wrapper React y registro:** crear `components/crema-canvas.tsx` calcando `components/rocas-canvas.tsx` (mismo `useEffect` de montaje/desmontaje del engine sobre el `<canvas>`, mismo `useImperativeHandle` reexponiendo `pause/resume/reset/forceGameOver`, mismo `onUpdateRef`), y añadir `crema: CremaCanvas` a `REAL_GAMES` en `components/real-game-registry.tsx`. Verificación: `/juego/crema/jugar` carga el motor real en vez de la simulación falsa de `components/jugar-client.tsx`.
6. **Verificación final:** ejecutar `npm run lint` y `npm run build` sin errores; jugar una partida manual completa en `/juego/crema/jugar` (al menos una taza perfecta y una mala tirada, hasta `gameOver`), guardar la puntuación con un nombre y confirmar el modal "PUNTUACIÓN GUARDADA_"; comprobar que `/juego/crema` y la pestaña CREMA de `/salon-de-la-fama` reflejan esa puntuación real; confirmar con `select best, plays from games where id = 'crema'` que el trigger de SPEC 07 actualizó las estadísticas.

## Acceptance criteria

- [ ] La fila `crema` existe en `games` con `cat = 'PUZZLE'`, `color = 'yellow'` y una portada propia (`cover-crema`) visible en `/biblioteca`.
- [ ] `/juego/crema/jugar` carga el motor real (`lib/crema-engine.ts`) sin errores en la consola, en vez de la simulación falsa.
- [ ] Mantener TEMPERATURA y PRESIÓN dentro de su zona objetivo y pulsar `Space` cuando TIEMPO también está en zona suma exactamente `100 * level` puntos y no resta vidas.
- [ ] Pulsar `Space` con TEMPERATURA o PRESIÓN fuera de su zona, o dejar que TIEMPO supere su máximo sin pulsar `Space`, resta exactamente 1 vida y no suma puntos.
- [ ] Cada 3 tazas perfectas consecutivas, `level` sube en 1 y las zonas objetivo se estrechan (o la deriva se acelera).
- [ ] Al llegar a 0 vidas, `gameOver` pasa a `true` y `jugar-client.tsx` muestra el modal de fin de partida sin cambios en ese archivo.
- [ ] Guardar la puntuación desde el modal inserta una fila real en `scores` con `game_id = 'crema'`, y el trigger de SPEC 07 actualiza `games.best`/`games.plays` para `crema`.
- [ ] `crema` aparece en `REAL_GAMES` (`components/real-game-registry.tsx`) apuntando a `CremaCanvas`.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** juego construido desde cero (Caso B del skill), sin partir de `references/started-games/` — no existe ningún prototipo de gestión de café en esa carpeta, y el jam pide explícitamente un tema nuevo.
- **Sí:** mecánica binaria (taza perfecta = puntos, mala tirada = vida) en vez de una escala continua de calidad (perfecta/regular/mala) — coincide exactamente con la restricción del jam ("cada taza perfecta suma puntos, una mala tirada cuesta una vida") y mantiene el motor simple para una partida corta.
- **Sí:** tres variables (temperatura, presión, tiempo) visibles y corregibles a la vez con 5 teclas (`←`/`→`, `↑`/`↓`, `Space`) — cumple la mecánica core obligatoria de gestión de un recurso bajo presión sin necesitar ratón ni combos complejos.
- **Sí:** canvas interno 800×600 (4:3 nativo, igual que `rocas`) en vez de letterboxing — el layout (dos diales verticales + barra de tiempo) se diseña directamente en ese ratio, sin adaptar una resolución ajena.
- **Sí:** dificultad por nivel = estrechar zonas objetivo y acelerar la deriva cada 3 tazas perfectas, en vez de añadir mecánicas nuevas por nivel — mantiene el motor pequeño y el `RealGameState` (`level`) con un rol claro, consistente con cómo lo usan `caida` (líneas/10) o `rocas`.
- **No:** un cuarto dial de "molienda" — fuera de alcance explícitamente; añadiría una sexta tecla y complejidad no pedida por el jam; queda como posible ampliación futura si se aprueba en `references/games-suggestions-todo.md`.
- **No:** vidas mapeadas a algo distinto de corazones — se reutiliza el HUD existente (`"♥ ".repeat(lives).trim() || "—"` en `jugar-client.tsx`) sin cambios en ese archivo.
- **No:** lógica especial de pausa para los diales en movimiento — `pause()`/`resume()` simplemente detienen y reanudan el bucle `requestAnimationFrame`, igual que en `rocas`; la deriva se congela sola al pausar el bucle.

## What is **not** in this spec

- Una cuarta variable de café ("molienda", tueste, ratio de leche) u otras mecánicas de barista (latte art, gestión de un local, pedidos personalizados).
- Modo versus o multijugador.
- Cambios a `app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx`, `components/salon-de-la-fama-client.tsx`, `components/game-card.tsx` o `lib/session.tsx`.
- Sonido o música específica del juego más allá del HUD compartido.
- El refactor de generalización de `RealGameState` (Paso 0 del skill) — ya implementado antes de este spec.

Cada uno de estos, si se implementa, va en su propio spec.
