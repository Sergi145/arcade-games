# Sugerencias de juegos — Arcade Vault

Registro vivo de recomendaciones del agente `@game-planner` para el próximo
juego a añadir al catálogo. Se actualiza cada vez que el agente propone algo
nuevo; no se borra el historial, solo se mueven las entradas de sección según
su estado.

Leyenda de estado: `Pendiente` (aún no se decide) → `Aprobada` (se decide
construirla) → `Implementada` (ya tiene motor real y está en
`references/implemented_games.md`) / `Descartada` (se decide no hacerla, con
motivo).

## Pendientes

### [2026-09-14] INVASORES — SHOOTER / green

**Recomendación principal**: darle motor real a `invasores` (ya existe en el
catálogo de Supabase, categoría `SHOOTER`, color `green`, sin engine — hoy usa
la simulación falsa del Player). Un clon tipo Space Invaders encaja de forma
natural: oleada de enemigos, nave que dispara, estado reducible a
`{ score, lives, level, gameOver }`, controles de solo teclado
(izquierda/derecha + disparo). No hay fuente en `references/started-games/`
para portar, pero es viable construirlo desde cero siguiendo el precedente de
`serpentina` (SPEC 10) y reutilizando patrones de colisión/disparo ya
resueltos en `lib/rocas-engine.ts`. Refuerza `SHOOTER` (pasaría de 2 a 3
juegos) sin saturar más `ARCADE`, que ya tiene 4 de los 8 juegos del catálogo
(`bloque-buster`, `serpentina`, `gloton`, `ranaria`).

**Alternativas consideradas**:

- `RANARIA` (ARCADE, green) — mecánica de cruce por carriles, feasible, pero
  ARCADE es la categoría más saturada del catálogo (4/8); no ayuda al balance.
- `GLOTÓN` (ARCADE, yellow) — tipo Pac-Man; motor viable pero más complejo
  (IA de fantasmas, grid de pellets) que Invasores para el mismo beneficio de
  categoría (ARCADE, ya saturada).
- `DUELO PIXEL` (VERSUS, cyan) — único juego en la categoría VERSUS (mayor
  hueco real), pero de mayor riesgo: un juego de versus/lucha no encaja de
  forma nativa en el modelo de `scores` (una sola puntuación numérica por
  partida, leaderboard pensado para runs en solitario). Se deja pendiente de
  una evaluación aparte antes de comprometerse.

**Riesgos**: ninguno bloqueante para Invasores; es el candidato de menor
fricción técnica. El riesgo real está en `duelo-pixel` (arriba) si se retoma
más adelante.

**Siguiente paso**: no hace falta spec nueva — es un port/build de motor real
dentro del patrón ya cubierto por SPEC 04/08/09/10. Se puede invocar el skill
`add-arcade-game` directamente cuando se decida construirlo.

**Reforzada [2026-09-14]**: reevaluación independiente (misma fecha, segunda
pasada de planificación) confirma `INVASORES` como recomendación principal.
Se revisó de nuevo el catálogo completo de 8 filas (histórico de
`lib/games.ts` previo a SPEC 05, mismos `id`/`cat`/`color` sembrados en
`games`): ARCADE = `bloque-buster`, `serpentina`, `gloton`, `ranaria` (4);
PUZZLE = `caida` (1); SHOOTER = `rocas`, `invasores` (2); VERSUS =
`duelo-pixel` (1). Contra `REAL_GAMES`, los 4 pendientes de motor real
siguen siendo `gloton` (ARCADE/yellow), `invasores` (SHOOTER/green),
`ranaria` (ARCADE/green) y `duelo-pixel` (VERSUS/cyan). De esos 4,
`invasores` sigue siendo el de menor riesgo técnico (pocos inputs, sesión
corta, una sola métrica numérica, sin IA de pathfinding como `gloton` ni el
riesgo de modelo de puntuación de `duelo-pixel`), y no empeora el
desequilibrio de categorías porque no sube el recuento de ARCADE (ya el más
saturado, 4/8) — solo completa `SHOOTER` con motor real. No se registra
como entrada nueva para no duplicar; se mantiene en Pendientes con este
refuerzo.

**Reforzada de nuevo [2026-09-14]**: tercera pasada de planificación (nueva
petición de Sergi pidiendo recomendación), contexto re-verificado desde
cero en vez de asumir el refuerzo anterior. `references/started-games/`
solo contiene `02-asteroids`, `03-tetris` y `04-arkanoid` — los tres ya
portados como `rocas`, `caida` y `bloque-buster` respectivamente (confirmado
también en `references/implemented_games.md` y `REAL_GAMES` de
`components/real-game-registry.tsx`) — así que no queda ningún candidato de
port de bajo esfuerzo sin usar; cualquier motor nuevo de los 4 juegos
restantes (`gloton`, `invasores`, `ranaria`, `duelo-pixel`) se construye
desde cero, igual que se hizo con `serpentina` (SPEC 10). Se repasaron
también las 11 specs (`specs/01-mvp-pantallas-visuales.md` a
`specs/11-crt-adaptable-a-resolucion.md`): todas en `Status: Implemented`,
ninguna decide ni descarta `invasores`, `gloton`, `ranaria` ni
`duelo-pixel` — el hueco sigue abierto y sin resolver en spec previa. Con
ese contexto reconfirmado, `INVASORES` se mantiene como recomendación
principal: completaría `SHOOTER` a 2/2 juegos con motor real (hoy solo
`rocas` lo tiene), `gloton`/`ranaria` seguirían sin ayudar porque ARCADE ya
está saturado, y `duelo-pixel` sigue aparcado por su riesgo de modelo de
puntuación. Sigue sin abrirse entrada nueva; este es el tercer refuerzo del
mismo bloque.

### Tanda de 20 candidatos nuevos [2026-09-14]

Encargo de Sergi: generar 20 recomendaciones de juegos **nuevos** (más allá de
los 4 huecos de motor real ya existentes en el catálogo de Supabase —
`gloton`, `invasores`, `ranaria`, `duelo-pixel` — que siguen su propia
recomendación activa arriba, sin cambios). Investigación repartida en 4 lotes
temáticos de 5 candidatos cada uno (SHOOTER, PUZZLE, ARCADE, VERSUS),
analizados en paralelo con los mismos criterios del game-planner y
consolidados aquí en una sola pasada de escritura para evitar condiciones de
carrera sobre este archivo. Mejor candidato por lote: COMANDO MISIL
(SHOOTER), FUSIÓN/2048 (PUZZLE), ALUNIZAJE/Lunar Lander (ARCADE), REBOTE/Pong
vs CPU (VERSUS). **Pick global de la tanda: REBOTE** — el motor más simple de
los 20 analizados, mapeo de `score` sin contorsiones (puntos anotados antes
de N fallos) y cubre el único hueco de categoría con cero juegos reales
(VERSUS solo tiene `duelo-pixel` pendiente). Ninguno de estos 20 compite con
la recomendación activa de `INVASORES` de arriba — son candidatos para un
catálogo ampliado, no reemplazos.

#### Lote SHOOTER

### [2026-09-14] COMANDO MISIL — SHOOTER / cyan

**Recomendación principal**: `id: comando-misil` (Missile Command).
Interceptar misiles que caen sobre ciudades con una mira controlada por
teclado (no ratón, para no romper el patrón 100% teclado del proyecto).
Colisión circular igual a la que ya resuelve `lib/rocas-engine.ts`. El motor
más simple y de menor riesgo de los 5 candidatos SHOOTER.
**Alternativas consideradas**: `ciempies` (Centipede, más reglas por la
ramificación del cuerpo), `escuadron` (Galaga, solapa conceptualmente con
`invasores`), `tanque` (Battle City 1P, viable con reservas de modo),
`vigia` (Defender, descartado por scroll+radar+IA de rescate, el más caro).
**Riesgos**: ninguno bloqueante; decidir antes de construir "cursor por
teclado" vs. ratón (el proyecto no tiene precedente de input de ratón).
**Siguiente paso**: viable para `add-arcade-game` directo en cuanto se
decida el esquema de mira/disparo.

### [2026-09-14] CIEMPIÉS — SHOOTER / magenta

**Recomendación principal**: `id: ciempies` (Centipede). Disparar a un
ciempiés segmentado que serpentea por un campo de hongos degradables;
fragmentarlo al impactar segmentos intermedios.
**Alternativas consideradas**: por detrás de `comando-misil` (motor más
simple) por la lógica de ramificación del ciempiés y el campo de hongos con
HP, la pieza más delicada del lote SHOOTER.
**Riesgos**: diseño de reglas de ramificación/degradación es el mayor
esfuerzo; sin riesgo de assets (todo geométrico).
**Siguiente paso**: spec o diseño previo de la máquina de estados del
ciempiés antes de construir; luego `add-arcade-game`.

### [2026-09-14] ESCUADRÓN — SHOOTER / yellow

**Recomendación principal**: `id: escuadron` (Galaga). Oleadas en formación
que pican hacia el jugador; motor viable con curvas paramétricas de vuelo.
**Alternativas consideradas**: solapa conceptualmente con `invasores`
(recomendación activa arriba, reforzada 3 veces) — construir ambos antes de
decidir cuál se prioriza sería redundante.
**Riesgos**: redundancia de propuesta de valor frente a `invasores`;
omitir el "rayo tractor" del original para no romper `RealGameState`.
**Siguiente paso**: aparcar hasta que se resuelva/implemente `invasores`
primero, para no duplicar esfuerzo de diseño.

### [2026-09-14] VIGÍA — SHOOTER / green

**Recomendación principal**: `id: vigia` (Defender). Scroll lateral,
rescatar astronautas de naves abductoras.
**Alternativas consideradas**: el más caro y arriesgado de los 20 candidatos
completos — requiere cámara de scroll sobre mundo ancho, radar en HUD (no
soportado hoy por `jugar-client.tsx`), IA de abducción/rescate y vuelo libre
con inercia; ningún patrón del repo actual sirve de base.
**Riesgos**: alto en todos los frentes (scroll+radar+IA+física); duración de
partida potencialmente larga/impredecible, en tensión con el CRT 4:3.
**Siguiente paso**: descartado como próximo candidato; no recomendado sin
una revisión de alcance mucho más amplia (spec dedicado si se retoma).

### [2026-09-14] TANQUE — SHOOTER / magenta

**Recomendación principal**: `id: tanque` (Battle City, **acotado a 1
jugador contra oleadas de CPU**). Arena con muros destructibles en grid
(patrón similar a `caida`), tanque a 4 direcciones, IA enemiga simple.
**Alternativas consideradas**: la variante VERSUS/2 jugadores locales
**no encaja de forma nativa** en el esquema `scores` (mismo problema exacto
ya señalado para `duelo-pixel`: una fila = una partida = un jugador) — se
descarta explícitamente esa variante, solo se recomienda la de 1P vs CPU.
**Riesgos**: bajo-medio en la variante 1P-vs-CPU; alto (de modelo de datos,
no de motor) si se intentase la variante VERSUS.
**Siguiente paso**: viable para `add-arcade-game` **solo si se fija por
adelantado el modo 1P vs CPU**, nunca el modo 2 jugadores.

#### Lote PUZZLE

### [2026-09-14] FUSIÓN — PUZZLE / cyan

**Recomendación principal**: `id: fusion` (2048). Grilla 4×4, fusionar tiles
numéricos con flechas. El motor más barato y de menor riesgo de los 20
candidatos junto con `rebote`: sin físicas, sin IA, sin assets, input 100%
flechas ya alineado con el patrón del proyecto.
**Alternativas consideradas**: mejor cociente esfuerzo/beneficio del lote
PUZZLE frente a `secuencia` (más simple pero de contenido más delgado),
`cadena-gema` (mejor encaje de categoría pura pero algoritmo de
matching/cascada más costoso), `saltacubos` y `dominio` (ambos más caros).
**Riesgos**: mínimos; única nota es de ritmo (juego por turnos sin presión
de tiempo real, distinto del resto del catálogo).
**Siguiente paso**: viable para `add-arcade-game` directo, sin decisiones
de diseño pendientes.

### [2026-09-14] SECUENCIA — PUZZLE / green

**Recomendación principal**: `id: secuencia` (Simon). Repetir secuencias de
colores crecientes; los 4 colores coinciden literalmente con `GameColor` del
proyecto, guiño temático directo. Motor trivial (máquina de estados).
**Alternativas consideradas**: segundo mejor del lote PUZZLE tras `fusion`,
solo por detrás en profundidad de contenido (sesiones muy cortas, mecánica
única sin variación).
**Riesgos**: el proyecto no tiene sistema de audio en ningún motor — decidir
explícitamente si es solo visual o si se introduce Web Audio API por primera
vez.
**Siguiente paso**: viable para `add-arcade-game` tras decidir si lleva
sonido.

### [2026-09-14] CADENA-GEMA — PUZZLE / magenta

**Recomendación principal**: `id: cadena-gema` (match-3 estilo Bejeweled).
Grilla 8×8, detección de líneas de 3+, gravedad y cascadas. El encaje de
categoría PUZZLE más puro y sin ambigüedad de género del lote.
**Alternativas consideradas**: por detrás de `fusion`/`secuencia` por el
algoritmo de matching/cascada recursiva y por requerir adaptar una
interacción nativa de ratón a un esquema de cursor+flechas+espacio.
**Riesgos**: bugs sutiles de cascada/reshuffle; UX de control por teclado
necesita diseño explícito antes de construir.
**Siguiente paso**: spec breve (o decisión de diseño documentada) sobre el
esquema de cursor por teclado antes de `add-arcade-game`.

### [2026-09-14] SALTACUBOS — PUZZLE / yellow

**Recomendación principal**: `id: saltacubos` (Q\*bert). Saltos isométricos
sobre pirámide de cubos, pintar cada cubo, evitar/eliminar enemigos.
**Alternativas consideradas**: encaje estético fuerte pero es más
acción-plataforma que puzzle puro; motor exige proyección isométrica propia
(sin precedente en el repo) e IA de enemigo perseguidor.
**Riesgos**: IA de persecución es la pieza más delicada; controles
diagonales sobre grilla isométrica requieren UX cuidada.
**Siguiente paso**: spec de diseño de controles isométricos antes de
`add-arcade-game`.

### [2026-09-14] DOMINIO — PUZZLE / magenta

**Recomendación principal**: `id: dominio` (Qix). Trazar líneas para
reclamar territorio, esquivando un enemigo errático. El look "vector CRT"
más fuerte del lote, pero el motor más caro de los 20 candidatos.
**Alternativas consideradas**: el peor esfuerzo/beneficio del lote PUZZLE —
requiere flood-fill de área encerrada cada frame (sin precedente de
geometría de áreas en ningún motor actual) más doble IA (Qix + Sparx).
**Riesgos**: rendimiento del flood-fill por frame, bugs de bordes mal
cerrados, doble IA sin precedente — probablemente excede el alcance de "un
spec, un ciclo".
**Siguiente paso**: no recomendado como próximo candidato; aparcar salvo que
se justifique el sobrecoste de ingeniería frente a `fusion`/`secuencia`.

#### Lote ARCADE

### [2026-09-14] ALUNIZAJE — ARCADE / green

**Recomendación principal**: `id: alunizaje` (Lunar Lander). Aterrizar con
gravedad/combustible limitado sobre plataformas cada vez más pequeñas. El
mejor encaje estético "vector CRT" de los 20 (arcade vectorial original de
fósforo verde) y reutiliza directamente la física de rotación+empuje ya
resuelta en `lib/rocas-engine.ts`.
**Alternativas consideradas**: mejor del lote ARCADE frente a `aleteo`
(motor aún más barato pero concepto genérico), `tunelero`/`justa` (más caros
por terreno destructible o física de vuelo+combate), `topos` (peor encaje
temático y de input).
**Riesgos**: generación procedural de terreno y ajuste fino del umbral de
aterrizaje "seguro"; ambos son problemas conocidos con solución estándar.
**Siguiente paso**: viable para `add-arcade-game` directo, con
`lib/rocas-engine.ts` como precedente técnico reutilizable.

### [2026-09-14] ALETEO — ARCADE / cyan

**Recomendación principal**: `id: aleteo` (flappy-flyer/endless runner).
Impulso + gravedad, esquivar obstáculos en scroll infinito. El motor más
barato de todo el lote ARCADE, probablemente más simple que `serpentina`.
**Alternativas consideradas**: segundo del lote tras `alunizaje`, solo por
detrás en originalidad (género muy genérico/sobreexplotado).
**Riesgos**: mínimos técnicamente; el valor diferencial depende del
tratamiento visual (estela de neón, partículas) más que de la mecánica.
**Siguiente paso**: viable para `add-arcade-game` directo.

### [2026-09-14] TUNELERO — ARCADE / yellow

**Recomendación principal**: `id: tunelero` (Dig Dug). Cavar túneles,
inflar/aplastar enemigos con rocas. Buen encaje temático, motor caro.
**Alternativas consideradas**: por detrás de `alunizaje`/`aleteo` por
terreno destructible (patrón nuevo, sin precedente), IA dual (Pooka/Fygar) y
física de rocas colgantes.
**Riesgos**: el bucle de simulación (terreno + pathfinding + caída de rocas)
es notablemente más trabajo que cualquier motor existente.
**Siguiente paso**: spec dedicado si se prioriza, dado el salto de
complejidad frente a las otras 4 opciones ARCADE.

### [2026-09-14] JUSTA — ARCADE / cyan

**Recomendación principal**: `id: justa` (Joust). Vuelo con aleteo sobre
fosas de lava, combate por altura relativa contra IA. Nota de categoría: pese
al nombre "duelo", el modo viable es PvE (no VERSUS real) — etiquetarlo
VERSUS sería un encaje forzado.
**Alternativas consideradas**: exige tanta física/IA como `tunelero`, más
una decisión de diseño explícita (simplificar el mecanismo de huevos a
puntuación instantánea) para no romper el contrato de 4 campos.
**Riesgos**: ajuste fino de física de vuelo, colisión entre múltiples
cuerpos voladores, decisión de diseño pendiente sobre los huevos.
**Siguiente paso**: decisión de diseño (cortar mecánica de huevo) antes de
cualquier spec.

### [2026-09-14] TOPOS — ARCADE / magenta

**Recomendación principal**: `id: topos` (Whac-a-Mole, reskinneado a
"brotes de energía"). Motor de simulación barato (temporizadores + grid),
pero el peor encaje temático y de input del lote.
**Alternativas consideradas**: el más débil de los 5 ARCADE — género
nativamente de ratón/tap forzado a teclado (esquema QWE/ASD/ZXC sobre grilla
3×3), formato de sesión de duración fija (contrarreloj) distinto al
"sobrevive hasta perder" del resto del catálogo.
**Riesgos**: mapeo de input teclado-a-grilla es el mayor riesgo real;
necesita reskin temático fuerte para no desentonar.
**Siguiente paso**: no recomendado como próximo candidato frente a las otras
4 opciones ARCADE.

#### Lote VERSUS

### [2026-09-14] REBOTE — VERSUS / cyan

**Recomendación principal**: `id: rebote` (Pong contra CPU). Pala vertical
del jugador vs. pala de CPU con margen de error/retardo. `score` = puntos
anotados antes de N fallos, `lives` = fallos restantes, `level` = tramo de
velocidad. Sin ninguna reinterpretación forzada del concepto original — el
mapeo a `score` es inmediato. El motor más simple y de menor riesgo de los 20
candidatos completos, junto con `fusion`.
**Alternativas consideradas**: mejor del lote VERSUS frente a
`disco-glaciar` (mismo mapeo de score pero física 2D/IA dual más cara),
`duelo-tanques` (mejor encaje de categoría SHOOTER pero primera IA de
oponente en tiempo real del proyecto), `otelo`/`cuatro-en-raya` (juegos de
tablero por turnos, ritmo distinto al resto del catálogo).
**Riesgos**: solo de balance (IA de CPU ni perfecta ni torpe); bajo.
**Siguiente paso**: viable para `add-arcade-game` directo — es el candidato
recomendado para cubrir el hueco real de la categoría VERSUS (hoy sin
ningún juego con motor real).

### [2026-09-14] DISCO GLACIAR — VERSUS / magenta

**Recomendación principal**: `id: disco-glaciar` (Air Hockey contra CPU).
Mazo en 2D, física de rebote, IA que alterna defensa/ataque. `score` = goles
antes de que la CPU llegue a N.
**Alternativas consideradas**: segundo del lote tras `rebote`, mismo mapeo
de score limpio pero motor sensiblemente más caro (física 2D + IA dual);
riesgo de solapamiento conceptual con `rebote` si se aprueban ambos.
**Riesgos**: colisión disco-mazo con "tunneling" a alta velocidad (mismo
tipo de precaución de `dt` capado que ya usa `lib/rocas-engine.ts`); IA dual
más difícil de calibrar que la 1D de Pong.
**Siguiente paso**: candidato "siguiente duelo" tras `rebote`, no como
primer VERSUS.

### [2026-09-14] DUELO DE TANQUES — SHOOTER / magenta

**Recomendación principal**: `id: duelo-tanques` (tanque vs. tanque(s) de
CPU en arena con obstáculos destructibles). `score` = tanques destruidos,
mismo patrón que `rocas`. Reforzaría SHOOTER, hoy solo con `rocas`.
**Alternativas consideradas**: mejor encaje de leaderboard y de categoría
que los candidatos de tablero (`otelo`, `cuatro-en-raya`), pero es la primera
IA de oponente en tiempo real y espacio continuo del proyecto — mayor riesgo
de ingeniería que `rebote`/`disco-glaciar`.
**Riesgos**: complejidad y tiempo de ajuste de la IA táctica (ni boba ni
injusta) es el riesgo dominante.
**Siguiente paso**: candidato de "siguiente reto" tras validar `rebote`
primero.

### [2026-09-14] OTELO — PUZZLE / green

**Recomendación principal**: `id: otelo` (Reversi/Othello contra CPU).
`score` = fichas propias al final (0-64), el mapeo de puntuación más limpio
y menos artificial de los candidatos de tablero.
**Alternativas consideradas**: mejor que `cuatro-en-raya` en encaje de
leaderboard (score natural sin fórmulas inventadas), pero comparte el mismo
reparo de ritmo por turnos frente a la cadencia de acción del resto del
catálogo.
**Riesgos**: IA de tablero (minimax/heurística de esquinas) sin precedente
en el repo, aunque más fácil de calibrar que Conecta 4; desajuste de ritmo
con la estética CRT pensada para acción.
**Siguiente paso**: candidato secundario, no prioritario frente a `rebote`.

### [2026-09-14] CUATRO EN RAYA — PUZZLE / yellow

**Recomendación principal**: `id: cuatro-en-raya` (Conecta 4 contra CPU).
**Alternativas consideradas**: el más débil de los 20 candidatos — es el
único sin mapeo de `score` natural (elegir entre una fórmula poco intuitiva
tipo `42 - turnos` o rediseñar como "racha de partidas", que rompe el
patrón de sesión corta); requiere IA minimax sin precedente en el repo.
**Riesgos**: mapeo de score forzado (el mayor del lote); ritmo por turnos
en tensión con la estética de acción del catálogo.
**Siguiente paso**: descartable salvo que se resuelva antes, como decisión
de diseño explícita, un mapeo de `score` convincente.

## Aprobadas / en construcción

_(sin entradas todavía)_

## Implementadas

### [2026-09-14] BLOQUE BUSTER — ARCADE / cyan

Motor real ya implementado (`lib/bloque-buster-engine.ts`, SPEC 09). `id`:
`bloque-buster`. Pilota una nave-paleta y rebota un núcleo de plasma para
pulverizar muros de bloques cromáticos.

### [2026-09-14] CAÍDA — PUZZLE / magenta

Motor real ya implementado (`lib/caida-engine.ts`, SPEC 08). `id`: `caida`.
Piezas geométricas descienden desde la oscuridad; rótalas, encástralas y
limpia líneas para sobrevivir.

### [2026-09-14] ROCAS — SHOOTER / yellow

Motor real ya implementado (`lib/rocas-engine.ts`, SPEC 04). `id`: `rocas`.
Nave triangular en vacío absoluto que dispara y rota para dividir rocas en
fragmentos cada vez más pequeños.

### [2026-09-14] SERPENTINA — ARCADE / green

Motor real ya implementado (`lib/serpentina-engine.ts`, SPEC 10). `id`:
`serpentina`. Serpiente de luz que recorre la grilla buscando núcleos
magenta; cada bocado la alarga y la hace más veloz.

## Descartadas

_(sin entradas todavía)_
