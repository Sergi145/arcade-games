# Skins de los juegos — Arcade Vault

Tabla de estado de skins por juego con motor real (`REAL_GAMES` en
`components/real-game-registry.tsx`). Cada juego debería tener 3 skins:
**Clásico** (predeterminado, la paleta actual del motor — ya existe por
definición), **Neón** y **Retro**.

## Flujo de trabajo

- Se implementa **un juego a la vez**, solo cuando se pida explícitamente
  para ese juego concreto — no se aplican skins en bloque a todos los
  juegos.
- Al terminar de aplicar una skin a un juego, actualiza su fila en la tabla
  de abajo (❌ → ✅) en el mismo cambio.

## Estado

| Juego         | id              | Clásico | Neón | Retro |
| ------------- | --------------- | :-----: | :--: | :---: |
| ROCAS         | `rocas`         |   ✅    |  ❌  |  ❌   |
| CAÍDA         | `caida`         |   ✅    |  ❌  |  ❌   |
| BLOQUE BUSTER | `bloque-buster` |   ✅    |  ❌  |  ❌   |
| SERPENTINA    | `serpentina`    |   ✅    |  ✅  |  ✅   |
| RAYA VELOZ    | `raya-veloz`    |   ✅    |  ❌  |  ❌   |
