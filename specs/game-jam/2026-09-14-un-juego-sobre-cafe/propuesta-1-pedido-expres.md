# SPEC (game-jam) — Pedido Exprés

> **Status:** Draft
> **Depends on:** Ninguno
> **Date:** 2026-09-14
> **Objective:** Añadir "PEDIDO EXPRÉS", un duelo de baristas 1 contra IA en tiempo real donde gana el turno quien prepare primero y sin fallos el mismo pedido, como juego nuevo de categoría VERSUS con motor real en Arcade Vault.

## Por qué existe este spec

Los 4 motores reales existentes (ROCAS, CAÍDA, BLOQUE BUSTER, SERPENTINA) son todos de un solo jugador contra el propio juego (esquivar, encajar, rebotar, crecer): ninguno tiene un rival activo dentro del bucle del motor. "PEDIDO EXPRÉS" introduce el primer oponente simulado (una IA local por temporizador) que compite en tiempo real contra el jugador dentro del mismo `requestAnimationFrame`, además de ser el primer juego VERSUS del catálogo con motor real (`duelo-pixel` ya existe en `games` con `cat: VERSUS` pero sigue con la simulación falsa). Vale la pena dejar explícita esta decisión de diseño antes de construirlo.

## Scope

**In:**

- Juego nuevo "PEDIDO EXPRÉS" (id `pedido-expres`), con fila nueva en la tabla `games` de Supabase (`id, title, short, long, cat, cover, color, best, plays`), `cat: 'VERSUS'`, `color: 'magenta'`, `cover: 'cover-barra'` (clase nueva), `best: 0`, `plays: 0` (el trigger de SPEC 07 los mantiene al día desde la primera partida guardada).
- Motor real construido desde cero — no porta ningún juego de `references/started-games/` — en `lib/pedido-expres-engine.ts`, siguiendo la factoría `createPedidoExpresEngine(canvas, { onUpdate })` con handle `pause/resume/reset/forceGameOver/destroy`.
- Mecánica core del jam: cada turno el motor genera un "pedido" (secuencia aleatoria de 3 a 6 pasos, elegidos entre `MOLER` / `EXTRAER` / `VAPORIZAR` / `SERVIR`, mapeados 1:1 a `↑ ↓ ← →`) idéntico para el jugador y para la IA. Ambos deben completar los pasos en ese mismo orden; gana el turno quien complete la secuencia entera primero, siempre que quede tiempo en el cronómetro del turno.
- IA local simulada por temporizador dentro del propio motor (sin red ni modelo externo): avanza un paso cada cierto intervalo — que se acorta a medida que sube el nivel — con una probabilidad de fallo que la frena, para que sea vencible en niveles bajos y exigente en niveles altos.
- Reporte del contrato genérico `RealGameState` (`score`, `lives`, `level`, `gameOver`) vía `callbacks.onUpdate` en cada frame — el único canal hacia React, sin tocar el DOM directamente.
- `components/pedido-expres-canvas.tsx`, calcado del patrón de `components/rocas-canvas.tsx` (mismo `useEffect` de montaje/desmontaje, mismo `useImperativeHandle`, mismo `onUpdateRef`).
- Registro `"pedido-expres": PedidoExpresCanvas` en `REAL_GAMES` (`components/real-game-registry.tsx`).
- Clase CSS `.cover-barra` nueva en `app/globals.css`, junto a las `.cover-X` existentes (`.cover-bricks`, `.cover-tetro`, `.cover-snake`, `.cover-duelo`…), en tonos magenta/neón.
- Controles exclusivamente de teclado: `↑ ↓ ← →` como los cuatro pasos del pedido. Sin ratón ni táctil.
- Canvas interno fijo en 800×600 (4:3 exacto, igual que ROCAS/BLOQUE BUSTER), dibujado solo con primitivas de canvas (rectángulos, círculos, texto) — sin imágenes ni sprites.

**Out of scope (para futuros specs):**

- Multijugador real entre dos personas (red, matchmaking, sala) — el rival es siempre la IA local simulada por temporizador.
- Sonido y música.
- Menú de selección de bebida o de dificultad antes de empezar — el pedido siempre lo genera el motor al azar según el nivel actual.
- Sprites, ilustraciones o animaciones de personaje para las estaciones de café — arte más allá de primitivas de canvas.
- Cambios a `components/jugar-client.tsx`, `app/juego/[id]/page.tsx`, `components/salon-de-la-fama-client.tsx` o `lib/session.tsx` — el leaderboard genérico (SPEC 06/07) ya funciona en cuanto el motor reporte `RealGameState`.
- Repetir el refactor del Paso 0 del skill `add-arcade-game` (generalización de `RealGameState`) — ya está hecho desde SPEC 08; este spec solo lo verifica.
- Dar motor real a `duelo-pixel` (el otro juego `VERSUS` del catálogo, aún con simulación falsa) — juego distinto, spec distinto si se decide abordarlo.

## Data model

Este spec no introduce persistencia nueva: reutiliza tal cual la fila de `games` (Supabase, `id, title, short, long, cat, cover, color, best, plays`) y el tipo `RealGameState` ya definido en `components/real-game-registry.tsx` (`score, lives, level, gameOver`) como único contrato entre el motor y React/Supabase. La única fila nueva a insertar vía migración es:

```sql
-- migración: alta de pedido-expres en games
insert into games (id, title, short, long, cat, cover, color, best, plays)
values (
  'pedido-expres',
  'PEDIDO EXPRÉS',
  'Dos baristas, un mismo pedido: gana quien lo sirva primero.',
  'Te enfrentas a una IA barista en turnos exprés: memoriza el pedido y pulsa MOLER, EXTRAER, VAPORIZAR y SERVIR en orden antes que tu rival. Cada turno ganado sube el marcador; cada turno perdido cuesta una vida.',
  'VERSUS',
  'cover-barra',
  'magenta',
  0,
  0
);
```

El único estado nuevo es interno al motor (nunca persistido, vive en el cierre de la factoría) y sirve solo para ilustrar cómo se deriva `RealGameState`:

```ts
// lib/pedido-expres-engine.ts (estado interno, no expuesto tal cual)
type Paso = "moler" | "extraer" | "vapor" | "servir"; // ↑ ↓ ← →

type PedidoExpresInternalState = {
  pedido: Paso[]; // secuencia objetivo del turno actual (3 a 6 pasos)
  progresoJugador: number; // pasos correctos consecutivos, 0..pedido.length
  progresoIA: number;
  tiempoRestante: number; // segundos del turno actual
  rondasJugador: number; // marcador de duelo (pedidos ganados), solo en pantalla
  rondasIA: number;
  // score/lives/level/gameOver se derivan de lo anterior en cada resolución
  // de turno y son lo único que sale por callbacks.onUpdate(state)
};
```

## Implementation plan

1. Verificar el Paso 0 del skill `add-arcade-game` (`grep -rn "RocasEngineState" --include=*.ts --include=*.tsx .`): confirmar que `RealGameState` sigue generalizado en `components/real-game-registry.tsx` y que los 4 motores existentes lo usan, sin necesidad de repetir el refactor. Ningún archivo cambia en este paso.
2. Migración Supabase (`mcp__supabase__apply_migration`) que inserta la fila `pedido-expres` en `games` con el contenido de la sección Data model. Verificación: `select * from games where id = 'pedido-expres'` devuelve la fila con `best = 0` y `plays = 0`.
3. Añadir la clase `.cover-barra` en `app/globals.css`, junto a las `.cover-X` existentes, con el mismo patrón (`.cover-bg` como base común + `background`/gradiente/`::after` propio en magenta/neón). Verificación: `/biblioteca` muestra la portada nueva para PEDIDO EXPRÉS (aunque el juego todavía use la simulación falsa hasta el paso 6).
4. Crear `lib/pedido-expres-engine.ts`: generador de pedidos aleatorios por nivel, bucle `requestAnimationFrame` con `dt` capado a 0.05s, listeners de `↑ ↓ ← →` (con `preventDefault`, registrados y limpiados dentro de la factoría) que avanzan `progresoJugador` solo si la tecla coincide con el siguiente paso pendiente, simulación de IA por temporizador que avanza `progresoIA`, resolución de turno (gana quien complete antes; en timeout gana quien tenga más pasos completos, empate favorece a la IA), actualización de `score/lives/level/gameOver` según las reglas de la sección Decisiones, y dibujado con primitivas de canvas (ticket del pedido, dos estaciones jugador/IA, barra de tiempo, marcador de duelo). Expone `pause/resume/reset/forceGameOver/destroy`. Verificación: el archivo compila sin errores de tipos; aún no se usa desde ningún componente.
5. Crear `components/pedido-expres-canvas.tsx` calcado de `components/rocas-canvas.tsx`: mismo `useEffect` de montaje/desmontaje que crea y destruye el engine sobre el `<canvas>`, mismo `useImperativeHandle`, mismo `onUpdateRef`; solo cambia el import a `createPedidoExpresEngine` y el tipo de estado a `RealGameState`. Verificación: se importa sin errores de tipos, aún no conectado al registro.
6. Añadir `"pedido-expres": PedidoExpresCanvas` a `REAL_GAMES` en `components/real-game-registry.tsx`. Verificación: compila e importa correctamente; `components/jugar-client.tsx` ya elige el motor real para `pedido-expres` sin más cambios.
7. `npm run lint` y `npm run build`, y prueba manual en `/juego/pedido-expres/jugar`: jugar varios turnos completos (ganar alguno a tiempo y perder otro a propósito, pulsando una tecla equivocada o dejando correr el cronómetro), confirmar que el HUD de React sube `score`/`level` y baja `lives` según las reglas descritas, perder las 3 vidas y ver el modal de fin de partida, guardar puntuación con un nombre, y confirmar que `/juego/pedido-expres` y `/salon-de-la-fama` (pestaña PEDIDO EXPRÉS) muestran esa puntuación real. Verificación: los criterios de aceptación siguientes se cumplen y ambos comandos terminan sin errores.

## Acceptance criteria

- [ ] La fila `pedido-expres` existe en `games` con `cat = 'VERSUS'`, `color = 'magenta'`, `cover = 'cover-barra'`, `best = 0` y `plays = 0` antes de la primera partida guardada.
- [ ] `/juego/pedido-expres/jugar` carga sin errores en consola y renderiza el canvas del motor real (no la barra de progreso falsa) dentro del bisel CRT.
- [ ] El canvas interno es 800×600 y todo se dibuja con primitivas de canvas (rectángulos/círculos/texto), sin imágenes ni sprites cargados.
- [ ] Cada turno muestra un pedido (secuencia de 3 a 6 pasos entre MOLER/EXTRAER/VAPORIZAR/SERVIR) idéntico para el jugador y la IA.
- [ ] Pulsar `↑ ↓ ← →` solo avanza el progreso del jugador cuando la tecla coincide con el siguiente paso pendiente del pedido; una tecla incorrecta no hace avanzar el progreso.
- [ ] La IA avanza su propio progreso de forma autónoma, sin ningún input del jugador, a un ritmo que depende del nivel actual.
- [ ] Completar el pedido antes que la IA y antes de que expire el cronómetro del turno suma puntos a `score` de forma determinista (100 × nivel, más 10 puntos por cada segundo entero restante del turno).
- [ ] Perder un turno (la IA completa el pedido primero, o expira el cronómetro sin que el jugador vaya estrictamente por delante) resta exactamente 1 a `lives`.
- [ ] `lives` llega a 0 tras perder 3 turnos y dispara `gameOver: true` junto con el modal de fin de partida de React.
- [ ] `level` sube en 1 cada 3 pedidos ganados por el jugador, hasta un máximo de nivel 5; a mayor nivel, el pedido tiene más pasos y/o el turno dura menos tiempo.
- [ ] El botón PAUSA detiene el cronómetro del turno y el avance de la IA manteniendo el último fotograma visible; REANUDAR continúa exactamente donde quedó.
- [ ] "JUGAR DE NUEVO" reinicia por completo el motor (marcador de duelo, nivel, score, vidas, pedido) vía `reset()`, sin recargar la página.
- [ ] SALIR navega a `/juego/pedido-expres` y desmonta el motor limpiamente, sin listeners de teclado ni `requestAnimationFrame` colgando.
- [ ] Guardar puntuación desde el modal de fin de partida inserta una fila en `scores` vía `useSession().saveScore`, sin cambios en `lib/session.tsx`.
- [ ] `/juego/pedido-expres` y `/salon-de-la-fama` (pestaña PEDIDO EXPRÉS) muestran la puntuación real guardada, con el trigger `bump_game_stats()` (SPEC 07) manteniendo `games.best`/`games.plays` al día.
- [ ] Los demás juegos del catálogo, con o sin motor real, siguen funcionando igual tras este cambio.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** motor construido desde cero, sin portar `references/started-games/` — no existe ningún juego de referencia sobre baristas/café en esa carpeta; el patrón de factoría (Paso 3 del skill `add-arcade-game`) es el mismo se venga o no de una carpeta de referencia.
- **Sí:** IA simulada localmente por temporizador con probabilidad de fallo, sin modelo ni red — cumple "duelo 1 contra IA en tiempo real" sin dependencias externas ni estado no determinista fuera del propio motor, mismo espíritu autocontenido que ROCAS/CAÍDA/BLOQUE BUSTER.
- **Sí:** cuatro pasos del pedido mapeados a `↑ ↓ ← →` — reutiliza el mismo lenguaje de controles que el resto del catálogo (flechas), sin teclas nuevas ni ratón.
- **Sí:** dibujado solo con primitivas de canvas, sin imágenes — consistente con 3 de los 4 motores reales existentes (ROCAS, CAÍDA, BLOQUE BUSTER); evita carga asíncrona de assets antes de poder arrancar el bucle.
- **Sí:** un empate en el cronómetro favorece a la IA salvo que el jugador vaya estrictamente por delante — regla determinista y verificable que evita turnos "sin ganador" que dejarían el marcador de duelo sin avanzar.
- **Sí:** canvas interno fijo en 800×600 (4:3 exacto) — igual que ROCAS/BLOQUE BUSTER, sin necesidad de letterbox al diseñarse el layout desde cero para esa proporción.
- **No:** selección de bebida o dificultad por el jugador antes de empezar — el pedido siempre lo genera el motor al azar; un menú de selección es mejora para un spec posterior, no el mínimo jugable del jam.
- **No:** sonido — ningún motor real existente reproduce audio hoy; añadirlo aquí introduciría una asimetría que el jam no pide.
- **No:** multijugador humano-humano — la restricción del jam pide explícitamente 1 contra IA, no dos jugadores en red.
- **No:** cambios a `components/jugar-client.tsx`, al HUD genérico de React o a `lib/session.tsx` — el contrato `RealGameState` ya cubre todo lo que ese HUD necesita.
- **No:** dar motor real a `duelo-pixel` en el mismo spec — ya tiene su propia fila e identidad en `games`; mezclar ambos juegos en un spec rompería la regla de "un paso, un cambio commiteable".

## What is **not** in this spec

- Multijugador humano-humano (red, matchmaking).
- Sonido y música.
- Menú de selección de bebida/dificultad antes de cada partida.
- Sprites o animaciones de personaje para las estaciones de café.
- Cambios al HUD genérico de React, a `lib/session.tsx` o a las pantallas de Detalle/Salón de la Fama.
- Motor real para `duelo-pixel`.

Cada uno de estos, si se implementa, va en su propio spec.
