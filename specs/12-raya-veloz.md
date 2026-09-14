# SPEC 12 — Raya Veloz

> Promovido desde specs/game-jam/4_raya/propuesta-1-raya-veloz.md (game jam sobre "cuatro en raya", promovido el 2026-09-14).

> **Status:** Approved
> **Depends on:** Ninguno
> **Date:** 2026-09-14
> **Objective:** Añadir "RAYA VELOZ", un cuatro en raya clásico (7×6, columnas con gravedad) en duelo 1 contra IA con un cronómetro por turno que fuerza el ritmo de un bucle de arcade continuo, como juego nuevo de categoría VERSUS con motor real en Arcade Vault.

## Por qué existe este spec

El cuatro en raya es, por diseño, un juego de mesa por turnos sin reloj: se puede pensar indefinidamente cada movimiento. Eso choca con el patrón de motor real de Arcade Vault (`requestAnimationFrame`, `dt` capado, partida corta y continua). "RAYA VELOZ" resuelve esa tensión con un cronómetro por turno que, al expirar, deja caer la ficha sola en la primera columna con hueco — el tablero nunca deja de "correr", incluso si el jugador no pulsa nada. El catálogo ya tiene un hueco `VERSUS` sin motor real (`duelo-pixel`, con simulación falsa), pero este spec introduce un juego nuevo y distinto (`raya-veloz`); no toca `duelo-pixel` ni le da motor real (ver Decisiones).

## Scope

**In:**

- Juego nuevo "RAYA VELOZ" (id `raya-veloz`), con fila nueva en la tabla `games` de Supabase (`id, title, short, long, cat, cover, color, best, plays`), `cat: 'VERSUS'`, `color: 'magenta'`, `cover: 'cover-raya'` (clase nueva), `best: 0`, `plays: 0` (el trigger de SPEC 07 los mantiene al día desde la primera partida guardada).
- Motor real construido desde cero — no porta ningún juego de `references/started-games/` — en `lib/raya-veloz-engine.ts`, con factoría `createRayaVelozEngine(canvas, { onUpdate })` y handle `pause/resume/reset/forceGameOver/destroy`.
- Mecánica core del jam: tablero clásico de 7 columnas × 6 filas con gravedad (una ficha cae hasta la celda libre más baja de la columna elegida). El jugador (magenta) y la IA (color contrastante, p. ej. cian) alternan turnos intentando conectar 4 fichas propias en línea (horizontal, vertical o diagonal).
- Cronómetro por turno visible (barra descendente dibujada por el propio motor): el turno del jugador dura `5.0 − 0.5 × (nivel − 1)` segundos (mínimo 3.0s en nivel 5). Si expira sin que el jugador haya soltado ficha, el motor coloca automáticamente una ficha del jugador en la primera columna con hueco de izquierda a derecha — el turno nunca se pierde sin jugarse, el bucle sigue avanzando solo.
- IA local determinista simulada por temporizador (sin red ni modelo externo): tras un retardo de "pensada" de `1.2 − 0.2 × (nivel − 1)` segundos (mínimo 0.4s en nivel 5), decide su columna con una regla fija en todos los niveles — 1) si puede conectar 4 ya, lo hace; 2) si no, si el jugador puede conectar 4 en su siguiente turno, bloquea esa columna; 3) si no, elige columna con peso hacia el centro y una pizca de aleatoriedad. Solo la velocidad (temporizador propio y del jugador) escala con el nivel, no la habilidad táctica — mantiene el motor determinista y verificable.
- Estructura de "ronda" para convertir la partida de mesa en puntuación arcade continua: cada ronda es un tablero completo. Ganar una ronda (el jugador conecta 4 primero) suma puntos y sube de nivel; perderla (la IA conecta 4 primero) resta una vida; un tablero lleno sin conexión de 4 (empate) no cambia vidas ni puntuación y simplemente abre una ronda nueva. El motor reinicia el tablero automáticamente al terminar cada ronda mientras queden vidas.
- Puntuación por ronda ganada: `250 × nivel + 10 × casillasVacías`, donde `casillasVacías` es el número de celdas del tablero (de 42) que seguían vacías en el momento de la conexión ganadora — premia ganar rápido con menos fichas colocadas. La puntuación acumulada nunca baja.
- 3 vidas iniciales; perder una ronda resta 1 vida; al llegar a 0 vidas, `gameOver: true`.
- Nivel inicial 1, sube en 1 por cada ronda ganada por el jugador hasta un tope de nivel 5 (a partir de ahí el temporizador y el retardo de la IA quedan fijos en su mínimo).
- El motor reporta `callbacks.onUpdate({ score, lives, level, gameOver })` cada frame — único canal hacia React, sin tocar el DOM directamente.
- Controles exclusivamente de teclado: `←`/`→` mueven un cursor resaltado sobre la columna seleccionada (con `preventDefault`, sin dar la vuelta más allá de la columna 0/6); `↓` o `Espacio` suelta la ficha del jugador en la columna seleccionada, si tiene hueco.
- Canvas interno fijo en 800×600 (4:3 exacto, igual que ROCAS/BLOQUE BUSTER), dibujado solo con primitivas de canvas (círculos para las fichas, rectángulos para la rejilla y la barra de tiempo, texto para el marcador de ronda) — sin imágenes ni sprites. La caída de cada ficha se anima con una interpolación corta (~0.25s) usando `dt`, para que el bucle `requestAnimationFrame` tenga siempre algo que dibujar aunque no haya input nuevo.
- `components/raya-veloz-canvas.tsx`, calcado del patrón de `components/rocas-canvas.tsx` (mismo `useEffect` de montaje/desmontaje, mismo `useImperativeHandle`, mismo `onUpdateRef`).
- Registro `"raya-veloz": RayaVelozCanvas` en `REAL_GAMES` (`components/real-game-registry.tsx`).
- Clase CSS `.cover-raya` nueva en `app/globals.css`, junto a las `.cover-X` existentes, en tonos magenta/neón con una rejilla de cuatro en raya estilizada.

**Out of scope (para futuros specs):**

- Multijugador humano-humano (red, matchmaking, sala local a dos teclados) — el rival es siempre la IA local determinista.
- Selección de dificultad, tamaño de tablero o modo de juego antes de empezar — el nivel siempre parte en 1 y sube solo por rondas ganadas.
- Inteligencia artificial con búsqueda profunda (minimax con poda, tablas de apertura) — la IA usa solo la regla de un movimiento descrita arriba; más profundidad es otra iteración si se decide que el juego es "demasiado fácil".
- Sonido y música.
- Ratón o control táctil para elegir columna (p. ej. clic directo sobre la columna) — solo teclado, igual que el resto del catálogo.
- Cambios a `components/jugar-client.tsx`, `app/juego/[id]/page.tsx`, `components/salon-de-la-fama-client.tsx` o `lib/session.tsx` — el leaderboard genérico (SPEC 06/07) ya funciona en cuanto el motor reporte `RealGameState`.
- Repetir el refactor del Paso 0 del skill `add-arcade-game` (generalización de `RealGameState`) — ya está hecho desde SPEC 08; este spec solo lo verifica.
- Dar motor real a `duelo-pixel` (el otro juego `VERSUS` del catálogo, aún con simulación falsa) — identidad y fila propias en `games`; si se aborda, va en su propio spec.

## Data model

Este spec no introduce persistencia nueva: reutiliza tal cual la fila de `games` (Supabase, `id, title, short, long, cat, cover, color, best, plays`) y el tipo `RealGameState` ya definido en `components/real-game-registry.tsx` (`score, lives, level, gameOver`) como único contrato entre el motor y React/Supabase. La única fila nueva a insertar vía migración es:

```sql
-- migración: alta de raya-veloz en games
insert into games (id, title, short, long, cat, cover, color, best, plays)
values (
  'raya-veloz',
  'RAYA VELOZ',
  'Cuatro en raya contrarreloj: cada ficha cuenta, cada segundo pesa.',
  'Te enfrentas a una IA en un cuatro en raya de siete columnas con un cronómetro que no perdona: si se agota tu turno, la ficha cae sola en la primera columna libre. Conecta cuatro antes que la máquina, sube de nivel y resiste con tus vidas mientras el ritmo se acelera.',
  'VERSUS',
  'cover-raya',
  'magenta',
  0,
  0
);
```

El resto del estado es interno al motor (nunca persistido, vive en el cierre de la factoría) y se ilustra aquí solo para dejar claro cómo se deriva `RealGameState`:

```ts
// lib/raya-veloz-engine.ts (estado interno, no expuesto tal cual)
type Celda = 0 | 1 | 2; // 0 vacío, 1 jugador, 2 IA
type Tablero = Celda[][]; // 7 columnas × 6 filas

type RayaVelozInternalState = {
  tablero: Tablero;
  turno: "jugador" | "ia";
  columnaSeleccionada: number; // 0..6, controlada con ←/→
  tiempoRestanteTurno: number; // segundos del turno actual (solo cuenta en el turno del jugador)
  retardoIA: number; // segundos restantes de "pensada" de la IA en su turno
  rondasGanadasJugador: number; // marcador visible en pantalla, no persistido
  rondasGanadasIA: number;
  // score/lives/level/gameOver se derivan al resolver cada ronda y son
  // lo único que sale por callbacks.onUpdate(state)
};
```

## Implementation plan

1. Verificar el Paso 0 del skill `add-arcade-game` (`grep -rn "RocasEngineState" --include=*.ts --include=*.tsx .`): confirmar que `RealGameState` sigue generalizado en `components/real-game-registry.tsx` y que los 4 motores existentes lo usan, sin repetir el refactor. Ningún archivo cambia en este paso.
2. Migración Supabase (`mcp__supabase__apply_migration`) que inserta la fila `raya-veloz` en `games` con el contenido de la sección Data model. Verificación: `select * from games where id = 'raya-veloz'` devuelve la fila con `best = 0` y `plays = 0`.
3. Añadir la clase `.cover-raya` en `app/globals.css`, junto a las `.cover-X` existentes, con el mismo patrón (`.cover-bg` como base común + `background`/gradiente/`::after` propio en magenta/neón). Verificación: `/biblioteca` muestra la portada nueva para RAYA VELOZ (aunque el juego todavía use la simulación falsa hasta el paso 6).
4. Crear `lib/raya-veloz-engine.ts`: tablero 7×6 con gravedad, bucle `requestAnimationFrame` con `dt` capado a 0.05s, listeners de `←`/`→`/`↓`/`Espacio` (con `preventDefault`, registrados y limpiados dentro de la factoría), cronómetro del turno del jugador con auto-caída en la primera columna libre al expirar, IA por temporizador con la regla determinista de un movimiento (ganar > bloquear > centro ponderado + aleatoriedad), detección de conexión de 4 (horizontal/vertical/diagonal) y de tablero lleno (empate), resolución de ronda con las fórmulas de puntuación/vidas/nivel de la sección Scope, animación corta de caída de ficha, y dibujado con primitivas de canvas (rejilla, fichas, cursor de columna, barra de tiempo, marcador de rondas). Expone `pause/resume/reset/forceGameOver/destroy`. Verificación: el archivo compila sin errores de tipos; aún no se usa desde ningún componente.
5. Crear `components/raya-veloz-canvas.tsx` calcado de `components/rocas-canvas.tsx`: mismo `useEffect` de montaje/desmontaje que crea y destruye el engine sobre el `<canvas>`, mismo `useImperativeHandle`, mismo `onUpdateRef`; solo cambia el import a `createRayaVelozEngine` y el tipo de estado a `RealGameState`. Verificación: se importa sin errores de tipos, aún no conectado al registro.
6. Añadir `"raya-veloz": RayaVelozCanvas` a `REAL_GAMES` en `components/real-game-registry.tsx`. Verificación: compila e importa correctamente; `components/jugar-client.tsx` ya elige el motor real para `raya-veloz` sin más cambios.
7. `npm run lint` y `npm run build`, y prueba manual en `/juego/raya-veloz/jugar`: mover el cursor con `←`/`→`, soltar ficha con `↓`/`Espacio`, dejar expirar el cronómetro a propósito y confirmar la caída automática en la primera columna libre, ganar una ronda (conectar 4) y comprobar que suben `score` y `level`, perder una ronda a propósito (dejar que la IA conecte 4) y comprobar que baja `lives`, forzar un tablero lleno sin conexión y confirmar que ni vidas ni puntuación cambian, agotar las 3 vidas y ver el modal de fin de partida, guardar puntuación con un nombre, y confirmar que `/juego/raya-veloz` y `/salon-de-la-fama` (pestaña RAYA VELOZ) muestran esa puntuación real. Verificación: los criterios de aceptación siguientes se cumplen y ambos comandos terminan sin errores.

## Acceptance criteria

- [ ] La fila `raya-veloz` existe en `games` con `cat = 'VERSUS'`, `color = 'magenta'`, `cover = 'cover-raya'`, `best = 0` y `plays = 0` antes de la primera partida guardada.
- [ ] `/juego/raya-veloz/jugar` carga sin errores en consola y renderiza el canvas del motor real (no la barra de progreso falsa) dentro del bisel CRT, con un tablero de 7 columnas × 6 filas dibujado con primitivas de canvas.
- [ ] `←`/`→` mueven el cursor de columna sin salirse de 0..6; `↓`/`Espacio` sueltan una ficha del jugador que cae por gravedad hasta la celda libre más baja de esa columna.
- [ ] Una barra de tiempo visible cuenta hacia atrás en el turno del jugador; si llega a cero sin que el jugador haya soltado ficha, el motor coloca automáticamente una ficha en la primera columna con hueco.
- [ ] La IA mueve de forma autónoma tras su propio retardo, sin ningún input del jugador, y su regla es verificable: si tiene una jugada ganadora la toma, si no y el jugador tiene una jugada ganadora la bloquea.
- [ ] Conectar 4 fichas propias (horizontal, vertical o diagonal) antes que la IA suma `250 × nivel + 10 × casillasVacías` a `score` de forma determinista, sube `level` en 1 (tope 5) y abre una ronda nueva con el tablero vacío.
- [ ] Que la IA conecte 4 primero resta exactamente 1 a `lives` y abre una ronda nueva con el tablero vacío; `score` no cambia.
- [ ] Un tablero lleno (42 celdas ocupadas) sin conexión de 4 de ningún bando no cambia `lives` ni `score` y abre una ronda nueva.
- [ ] `lives` llega a 0 tras perder 3 rondas y dispara `gameOver: true` junto con el modal de fin de partida de React.
- [ ] A mayor `level`, el cronómetro del turno del jugador es visiblemente más corto y la IA mueve más rápido (retardo de pensada menor).
- [ ] El botón PAUSA detiene el cronómetro del turno, el retardo de la IA y la animación de caída, manteniendo el último fotograma visible; REANUDAR continúa exactamente donde quedó.
- [ ] "JUGAR DE NUEVO" reinicia por completo el motor (tablero, marcador de rondas, nivel, score, vidas) vía `reset()`, sin recargar la página.
- [ ] SALIR navega a `/juego/raya-veloz` y desmonta el motor limpiamente, sin listeners de teclado ni `requestAnimationFrame` colgando.
- [ ] Guardar puntuación desde el modal de fin de partida inserta una fila en `scores` vía `useSession().saveScore`, sin cambios en `lib/session.tsx`.
- [ ] `/juego/raya-veloz` y `/salon-de-la-fama` (pestaña RAYA VELOZ) muestran la puntuación real guardada, con el trigger `bump_game_stats()` (SPEC 07) manteniendo `games.best`/`games.plays` al día.
- [ ] Los demás juegos del catálogo, con o sin motor real, siguen funcionando igual tras este cambio.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** al expirar el cronómetro del turno, la ficha del jugador cae automáticamente en la primera columna con hueco (en vez de perder el turno sin jugar). Mantiene el tablero siempre avanzando — ningún turno queda "vacío" — y encaja mejor en un bucle de arcade continuo que un simple "pierdes el turno", que dejaría de tener efecto visible en el tablero.
- **Sí:** estructura de rondas (cada ronda es un tablero completo) con vidas y nivel para convertir "ganar/perder una partida de mesa" en puntuación numérica competitiva: ganar una ronda suma `250 × nivel + 10 × casillasVacías` (recompensa ganar rápido) y sube de nivel; perder una resta una vida; el juego termina al agotar las 3 vidas. Así el `score` del leaderboard mide cuántas rondas se ganaron y con qué rapidez/nivel, no solo "gané o perdí una vez".
- **Sí:** empate (tablero lleno sin conexión de 4) no cambia vidas ni puntuación, solo abre una ronda nueva. Evita penalizar al jugador por un empate forzado por la presión del cronómetro, y mantiene la regla de puntuación simple y determinista.
- **Sí:** IA determinista de un solo movimiento (ganar > bloquear > centro ponderado) igual en todos los niveles; solo la velocidad (temporizador del jugador y retardo de la IA) escala con el nivel. Da una dificultad progresiva verificable sin necesitar minimax ni aleatoriedad en el resultado táctico, y evita una IA "perfecta" imposible de vencer.
- **Sí:** tablero clásico 7×6 dentro de un canvas fijo 800×600 (4:3 exacto) — mismas proporciones estándar del cuatro en raya real, sin distorsión ni letterbox dentro del bisel CRT, igual criterio que ROCAS/BLOQUE BUSTER.
- **Sí:** controles exclusivamente de teclado (`←`/`→` para elegir columna, `↓`/`Espacio` para soltar) — reutiliza el mismo lenguaje de controles que el resto del catálogo, sin ratón ni clic sobre columnas.
- **Sí:** id nuevo y distinto `raya-veloz`, sin reutilizar `duelo-pixel` — `duelo-pixel` ya tiene su propia fila e identidad en `games` (categoría VERSUS, aún con simulación falsa); mezclar ambos en un spec rompería la regla de "un paso, un cambio commiteable" y decidiría por otro juego sin que se haya planificado.
- **No:** perder el turno sin jugar al expirar el cronómetro — descartado explícitamente en favor de la caída automática (ver arriba).
- **No:** IA con búsqueda profunda (minimax, poda alfa-beta, tablas de apertura) — sobreingeniería para el mínimo jugable del jam; se puede añadir en un spec posterior si el nivel 5 resulta demasiado fácil.
- **No:** multijugador humano-humano — la restricción del jam pide explícitamente 1 contra IA.
- **No:** selección de dificultad o tamaño de tablero antes de empezar — el nivel siempre parte en 1 y escala solo por rondas ganadas, igual criterio que PEDIDO EXPRÉS (otra propuesta de este mismo jam).
- **No:** sonido, ratón o control táctil — ningún motor real existente los usa hoy.
- **No:** cambios a `components/jugar-client.tsx`, al HUD genérico de React o a `lib/session.tsx` — el contrato `RealGameState` ya cubre todo lo que ese HUD necesita.
- **No:** dar motor real a `duelo-pixel` en este spec — identidad y fila propias; si se aborda, va en su propio spec.

## Risks

| Riesgo                                                                                                                       | Mitigación                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La caída automática al expirar el cronómetro puede crear sin querer una jugada mala o directamente perdedora para el jugador | Es el efecto de presión buscado por el jam, no un bug; se atenúa dando un temporizador generoso en nivel 1 (5.0s) que solo se acorta gradualmente.                                                                                       |
| La IA de un solo movimiento puede sentirse "floja" en nivel 1 o "injusta" en nivel 5 solo por la velocidad                   | El comportamiento táctico es idéntico en todos los niveles (siempre gana/bloquea si puede); ajustar tiempos exactos es trabajo de pulido en implementación, no cambia la regla ni el contrato.                                           |
| Un tablero de 42 celdas con turnos de hasta 5s podría alargar una ronda varios minutos en el peor caso teórico               | En la práctica la IA bloquea/gana activamente y el cronómetro fuerza jugadas, así que las rondas reales terminan mucho antes del llenado completo; no se limita explícitamente la duración porque el propio diseño ya la acota de facto. |

## What is **not** in this spec

- Multijugador humano-humano (red, matchmaking, dos teclados).
- Selección de dificultad, tamaño de tablero o modo de juego antes de cada partida.
- Inteligencia artificial con búsqueda profunda (minimax, poda, aperturas).
- Sonido y música.
- Ratón o control táctil para elegir columna.
- Cambios al HUD genérico de React, a `lib/session.tsx` o a las pantallas de Detalle/Salón de la Fama.
- Motor real para `duelo-pixel`.

Cada uno de estos, si se implementa, va en su propio spec.
