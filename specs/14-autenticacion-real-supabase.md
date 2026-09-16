# SPEC 14 — Autenticación real con Supabase Auth

> **Status:** Approved
> **Depends on:** SPEC 03, SPEC 06
> **Date:** 2026-09-16
> **Objective:** Reemplazar la sesión simulada de `lib/session.tsx` (localStorage) por autenticación real de Supabase Auth — email/contraseña y OAuth con Google y GitHub — en la pantalla `/login` ya existente, manteniendo el modo invitado para jugar pero exigiendo sesión iniciada para guardar puntuación.

## Por qué existe este spec

Desde SPEC 01, `lib/session.tsx` simula una sesión: `login(user)` escribe `{ name }` en `localStorage` (`av:user:v1`) sin validar nada, y cualquiera puede "ser" cualquier jugador con solo escribir un nombre. SPEC 03 ya dejó lista la infraestructura real (`@supabase/ssr`, `lib/supabase/client.ts`/`server.ts`, y `proxy.ts` refrescando `supabase.auth.getUser()` en cada request) pero nunca se conectó a ninguna pantalla — es plomería a la espera de este spec. Este spec sustituye el mock por cuentas reales de Supabase Auth (email + contraseña, más Google y GitHub por OAuth) reutilizando la pantalla `/login` que ya existe (pestañas INICIAR SESIÓN / CREAR CUENTA, con los botones GOOGLE/GITHUB ya presentes en el diseño pero hoy sin conectar), sin tocar el resto del catálogo de juegos ni el leaderboard salvo en el punto exacto donde la cuenta aporta valor: el nombre que se guarda en `scores.name`.

## Scope

**In:**

- `lib/session.tsx` reescrito: `SessionUser` se deriva de la sesión real de Supabase Auth (`supabase.auth.getSession()` en el cliente de navegador + listener `onAuthStateChange`), no de `localStorage`. `SessionUser.name` sale de los metadatos del usuario con una cadena de fallback que cubre email y OAuth: `user_metadata.name ?? user_metadata.full_name ?? user_metadata.user_name ?? email.split("@")[0]`, siempre normalizado a mayúsculas y truncado a 10 caracteres (mismo límite que `scores.name`). Se elimina el setter mock `login(user)` y la clave `av:user:v1`. `logout()` pasa a llamar `supabase.auth.signOut()`. `saveScore` mantiene su firma y comportamiento actuales (sigue siendo el único punto de escritura en `scores`).
- `app/login/page.tsx` reescrito sobre el mismo layout visual (`auth-card`, pestañas INICIAR SESIÓN / CREAR CUENTA):
  - INICIAR SESIÓN pide **email + contraseña** y llama a `createClient().auth.signInWithPassword(...)`.
  - CREAR CUENTA pide **nombre de usuario (1–10 caracteres) + email + contraseña + confirmar contraseña** y llama a `createClient().auth.signUp({ email, password, options: { data: { name } } })`. El nombre de usuario se valida en cliente a 1–10 caracteres antes de enviarlo (misma restricción que ya tiene `scores.name`).
  - Confirmación de contraseña: se valida en cliente que ambos campos coincidan antes de llamar a Supabase.
  - Los botones **GOOGLE** y **GITHUB** ya presentes en el diseño se conectan a `createClient().auth.signInWithOAuth({ provider: "google" | "github", options: { redirectTo: \`${origin}/auth/callback\` } })`. No piden nombre de usuario — no hay formulario intermedio, solo el redirect al proveedor.
  - Errores de Supabase (credenciales inválidas, email ya registrado, contraseña débil, OAuth cancelado/fallido, red) se muestran como mensaje inline dentro de `auth-card`, sin recargar la página.
  - Los tres flujos (email, Google, GitHub), en éxito, navegan a `/` con la sesión ya iniciada (sin paso de confirmación de email, ver más abajo).
  - "JUGAR COMO INVITADO" se mantiene igual: llama a `logout()` y navega a `/` sin exigir cuenta.
  - Si al entrar a `/login` ya hay sesión iniciada, se muestra una tarjeta simple ("Ya iniciaste sesión como {name}" + botón para cerrar sesión) en vez del formulario.
- Ruta nueva `app/auth/callback/route.ts`: recibe la redirección de Supabase tras el flujo OAuth (`code` en la query string), llama a `supabase.auth.exchangeCodeForSession(code)` con el cliente de servidor (`lib/supabase/server.ts`) y redirige a `/`. Sin esta ruta, Google/GitHub autentican contra Supabase pero la app nunca recibe la sesión.
- `components/jugar-client.tsx`: el modal de fin de partida deja de tener un input de nombre libre.
  - Con sesión iniciada (email, Google o GitHub): se muestra el nombre de la cuenta (`user.name`, de solo lectura) y el botón "GUARDAR PUNTUACIÓN" llama a `saveScore` igual que hoy.
  - Sin sesión (invitado): en su lugar se muestra un aviso "INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN" con un enlace a `/login`. Esa puntuación concreta no se recupera ni se reintenta tras iniciar sesión.
- Migración Supabase que sustituye la policy pública `Public insert access` (`INSERT ... TO anon, authenticated ... WITH CHECK (true)`) en `scores` por una que exige sesión autenticada, para que "guardar exige login" se cumpla también a nivel de base de datos y no solo en la UI. La policy no distingue proveedor: cualquier sesión autenticada (email, Google o GitHub) cae en el rol `authenticated`.
- Verificar/desactivar la opción **"Confirm email"** en el dashboard de Supabase del proyecto (`ddbbdyjjsvrxzbijprwg`, Authentication → Sign In / Email) para que el registro por email deje sesión iniciada al instante. Es un paso manual sobre la configuración del proyecto, no una migración de esquema.
- Documentar como prerequisito manual pendiente: crear una app OAuth en Google Cloud Console y otra en GitHub Developer Settings, y pegar sus Client ID/Secret en el dashboard de Supabase (Authentication → Providers → Google / GitHub) usando la Callback URL que Supabase indica para este proyecto. Sin este paso externo, los botones GOOGLE/GITHUB quedan implementados pero no funcionan (ver Risks).

**Out of scope (para futuros specs):**

- Magic link (inicio de sesión sin contraseña por enlace al correo) — solo email+contraseña, Google y GitHub en este spec.
- Confirmación de email obligatoria — se desactiva explícitamente (ver Decisiones).
- Recuperación de contraseña ("¿olvidaste tu contraseña?").
- Página de perfil o edición del nombre de cuenta después del registro.
- Proteger `/biblioteca`, el detalle de un juego o el propio Reproductor (`/juego/[id]/jugar`) detrás de login — solo el guardado de puntuación queda detrás de sesión; el resto sigue público como hoy.
- Tabla `profiles` nueva o columna `user_id` en `scores` — el nombre de cuenta vive en `user_metadata` de Supabase Auth.
- Persistir o reintentar el guardado de una puntuación de invitado después de que inicie sesión.
- Separar `/login` en dos rutas (`/login` + `/registro`) — se mantiene una sola pantalla con pestañas.
- Cambios a `proxy.ts`, `lib/supabase/client.ts` o `lib/supabase/server.ts` — SPEC 03 ya los dejó listos para sesiones reales de Supabase Auth.
- Cambios a `components/salon-de-la-fama-client.tsx` — ya maneja `user === null` devolviendo `you = null`, sin código nuevo que escribir.

## Data model

No se crean tablas nuevas: Supabase Auth ya gestiona `auth.users` (incluido `user_metadata.name`, escrito en el registro). Solo cambia una policy existente en `scores`:

```sql
-- migración: exigir sesión autenticada para insertar en scores
drop policy "Public insert access" on scores;

create policy "Authenticated insert access"
  on scores for insert
  to authenticated
  with check (true);
```

`games` y el resto del esquema no cambian. `SessionUser` (`lib/session.tsx`) mantiene la misma forma pública que hoy usan sus consumidores (`{ name: string }`), solo cambia de dónde sale el valor:

```ts
// lib/session.tsx (antes: leído de localStorage av:user:v1)
export type SessionUser = { name: string };
// ahora: derivado de supabase.auth.getSession() + onAuthStateChange
// name = (metadata.name ?? metadata.full_name ?? metadata.user_name ?? email.split("@")[0])
//          .toUpperCase().slice(0, 10)
// - metadata.name: viene del registro por email (options.data.name)
// - metadata.full_name: nombre completo que da Google
// - metadata.user_name: usuario de GitHub
```

## Implementation plan

1. Verificar en el dashboard de Supabase (proyecto `ddbbdyjjsvrxzbijprwg`, Authentication → Sign In / Email) que **"Confirm email" está desactivado**; si está activado, desactivarlo. Sin este paso, el registro por email no deja sesión iniciada al instante. Verificación: la consola de Supabase muestra la opción desactivada.
2. Paso manual externo: crear una app OAuth en Google Cloud Console y otra en GitHub Developer Settings, y configurar sus Client ID/Secret en Supabase (Authentication → Providers → Google / GitHub) con la Callback URL que Supabase da para este proyecto. Verificación: ambos proveedores aparecen como "Enabled" en Authentication → Providers. Si este paso queda pendiente, los pasos 3–7 se implementan igual, pero los botones GOOGLE/GITHUB no autenticarán hasta completarlo (ver Risks).
3. Reescribir `lib/session.tsx`: eliminar `av:user:v1`/localStorage y el setter mock `login(user)`; derivar `user` de `supabase.auth.getSession()` + `onAuthStateChange` sobre el cliente de navegador (`lib/supabase/client.ts`), con la cadena de fallback `name ?? full_name ?? user_name ?? email` truncada a 10 caracteres (ver Data model); `logout()` llama a `supabase.auth.signOut()`; `saveScore` no cambia de firma ni de comportamiento. Verificación: el build falla en `app/login/page.tsx` porque ya no existe `login()` — se corrige en el siguiente paso.
4. Reescribir `app/login/page.tsx` sobre el mismo `auth-card`: pestaña INICIAR SESIÓN (email + contraseña → `signInWithPassword`), pestaña CREAR CUENTA (nombre 1–10 caracteres + email + contraseña + confirmar contraseña, validación de coincidencia en cliente → `signUp` con `options.data.name`), botones GOOGLE/GITHUB conectados a `signInWithOAuth`, mensajes de error inline, tarjeta de "ya iniciaste sesión" si `user` ya existe al entrar, "JUGAR COMO INVITADO" sin cambios de comportamiento. Verificación manual: registrar una cuenta nueva por email entra directamente sin confirmar email; cerrar sesión y volver a entrar con las mismas credenciales funciona; credenciales incorrectas muestran el mensaje de error sin recargar; los botones GOOGLE/GITHUB inician el redirect al proveedor (el resto del flujo se verifica en el paso 6).
5. Crear `app/auth/callback/route.ts`: intercambia el `code` de la query string por sesión (`supabase.auth.exchangeCodeForSession`, cliente de servidor) y redirige a `/`. Verificación: el archivo compila; aún no se prueba de extremo a extremo hasta tener credenciales OAuth reales (paso 2).
6. Actualizar el modal de fin de partida en `components/jugar-client.tsx`: con `user` existente, mostrar su nombre de solo lectura y guardar con `saveScore` igual que hoy; con `user` nulo, sustituir el formulario por el aviso "INICIA SESIÓN PARA GUARDAR TU PUNTUACIÓN" enlazando a `/login`. Verificación manual: terminar una partida sin sesión muestra el aviso, no el input; terminar una partida con sesión iniciada (por cualquiera de los tres métodos) guarda con el nombre de la cuenta sin pedir nada más.
7. Migración Supabase (`mcp__supabase__apply_migration`) que sustituye `Public insert access` por `Authenticated insert access` en `scores` (ver Data model). Verificación: un `insert` de prueba sin sesión (rol `anon`) es rechazado por RLS; el mismo `insert` con una sesión autenticada (desde la app, con un usuario logueado por cualquier método) funciona igual que antes.
8. `npm run lint` y `npm run build`, y prueba manual completa: registrar una cuenta nueva por email, cerrar sesión, volver a iniciar sesión, entrar con Google y con GitHub (si las credenciales del paso 2 ya están listas) y comprobar que el nombre se deriva del perfil truncado a 10 caracteres, jugar como invitado y comprobar que no se puede guardar puntuación, jugar con sesión iniciada y guardar puntuación con el nombre de la cuenta, recargar la página y comprobar que la sesión se mantiene, y confirmar que `/salon-de-la-fama` y el resto del catálogo siguen funcionando igual. Verificación: los criterios de aceptación siguientes se cumplen y ambos comandos terminan sin errores.

## Acceptance criteria

- [ ] Un visitante sin cuenta puede registrarse desde CREAR CUENTA (nombre 1–10 caracteres, email, contraseña, confirmar contraseña) y queda con sesión iniciada de inmediato, sin paso de confirmación de email.
- [ ] Un usuario existente puede iniciar sesión desde INICIAR SESIÓN con email + contraseña.
- [ ] Credenciales incorrectas en INICIAR SESIÓN muestran un mensaje de error inline sin recargar la página.
- [ ] Registrar un email ya usado muestra un mensaje de error inline en vez de crear una cuenta duplicada.
- [ ] Contraseñas que no coinciden en CREAR CUENTA se detectan en cliente, con mensaje inline, antes de llamar a Supabase.
- [ ] "JUGAR COMO INVITADO" sigue sin exigir cuenta y navega a `/` con la sesión cerrada, igual que hoy.
- [ ] El botón con el nombre en `Nav` cierra la sesión real de Supabase Auth (no solo borra un dato local) y vuelve a mostrar "Iniciar Sesión".
- [ ] Un invitado (sin sesión) puede jugar cualquier juego con normalidad; al terminar la partida, el modal muestra el aviso para iniciar sesión en vez del formulario de guardar puntuación.
- [ ] Un usuario con sesión iniciada (email, Google o GitHub), al terminar una partida, ve su nombre de cuenta ya puesto (sin campo editable) y puede guardar la puntuación con "GUARDAR PUNTUACIÓN".
- [ ] Un `insert` en `scores` sin sesión autenticada (rol `anon`) es rechazado por RLS a nivel de base de datos, sin importar el proveedor con el que se hubiera iniciado sesión.
- [ ] `/salon-de-la-fama` sigue mostrando "tu mejor marca" para el usuario con sesión iniciada, sin cambios en `components/salon-de-la-fama-client.tsx`.
- [ ] Recargar la página con sesión iniciada mantiene la sesión (no vuelve a pedir login), gracias al refresco de cookies ya existente en `proxy.ts` (SPEC 03).
- [ ] Pulsar el botón GOOGLE en `/login` redirige a Google y, tras autenticar (con las credenciales del paso 2 del plan ya configuradas), vuelve a la app con sesión iniciada vía `app/auth/callback/route.ts`.
- [ ] Pulsar el botón GITHUB en `/login` hace el mismo flujo con GitHub como proveedor.
- [ ] El nombre de cuenta de un usuario que entró por Google o GitHub por primera vez sale automáticamente de su perfil (nombre completo o usuario de GitHub) truncado a 10 caracteres, sin pedirle que elija un nombre.
- [ ] Si al entrar a `/login` ya hay sesión iniciada, se muestra la tarjeta de "ya iniciaste sesión" en vez del formulario.
- [ ] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** Supabase Auth (email + contraseña, Google y GitHub) reemplaza el mock de `lib/session.tsx` — `proxy.ts` (SPEC 03) ya refresca la sesión de Supabase Auth en cada request, infraestructura pensada para este momento.
- **Sí:** OAuth con Google y GitHub además de email + contraseña — decidido explícitamente con el usuario; los botones GOOGLE/GITHUB ya existían en el diseño de `/login` sin conectar, así que se cablean en vez de retirarse.
- **No:** magic link (inicio de sesión sin contraseña por enlace al correo) — no se pidió; email+contraseña y OAuth cubren los casos de uso actuales.
- **Sí:** el nombre de cuenta de un usuario que entra por primera vez con Google o GitHub se deriva automáticamente de su perfil (`full_name`/`user_name`) truncado a 10 caracteres, sin pantalla de onboarding adicional — mantiene el registro por OAuth en un solo paso (redirect + vuelta), igual de simple que los otros dos providers; el usuario aceptó que el nombre resultante puede no ser tan "arcade" como uno elegido a mano.
- **Sí:** las credenciales OAuth (Client ID/Secret de Google y GitHub en Supabase) quedan documentadas como paso manual pendiente en el plan de implementación, no como algo que este spec resuelve — el usuario confirmó que aún no las tiene; el código de los botones y del callback se implementa igual, solo no se puede probar de extremo a extremo hasta que se configuren.
- **Sí:** confirmación de email desactivada — cuenta activa al instante tras `signUp`, sin depender de que el envío de correos transaccionales de Supabase esté configurado; encaja con el tono casual/arcade del proyecto.
- **Sí:** nombre de usuario como campo propio del registro, limitado a 1–10 caracteres — encaja exactamente con la restricción ya existente de `scores.name`, evitando truncar o rechazar nombres más largos al guardar puntuación.
- **Sí:** INICIAR SESIÓN pide email, no nombre de usuario — Supabase Auth no soporta login nativo por username; pedir email es el patrón estándar y evita una tabla/consulta extra solo para resolver username → email.
- **Sí:** campo "confirmar contraseña" en el registro — patrón estándar, evita errores de tecleo no detectados hasta el siguiente login.
- **Sí:** invitados pueden jugar cualquier juego sin restricción; solo guardar puntuación exige sesión iniciada — mantiene la experiencia actual de "jugar sin fricción" y añade la cuenta solo donde aporta valor real (persistir el nombre).
- **Sí:** si un invitado no inicia sesión, la puntuación de esa partida se pierde (no se persiste en `sessionStorage` ni se reintenta tras el login) — decidido por simplicidad; revisable en un spec futuro si resulta un problema real.
- **Sí:** la restricción "guardar exige sesión" se refuerza también en la base de datos (policy `INSERT` de `scores` pasa de pública a `authenticated`) — si solo se aplicara en la UI, cualquiera podría seguir insertando directamente contra la API pública de Supabase con la clave anónima.
- **Sí:** `/login` se mantiene como una sola pantalla con pestañas (INICIAR SESIÓN / CREAR CUENTA) — confirmado con el usuario, mismo patrón que ya existe.
- **Sí:** `app/login/page.tsx` llama a `createClient().auth.signInWithPassword`/`.signUp`/`.signOut` directamente, mismo patrón que ya usa `components/salon-de-la-fama-client.tsx` con `createClient()`, en vez de añadir wrappers `signIn`/`signUp` a `lib/session.tsx` — mantiene `lib/session.tsx` centrado en exponer el estado reactivo de sesión, no la lógica de formularios.
- **No:** página de perfil, edición del nombre de cuenta tras el registro, o recuperación de contraseña — no se pidieron; cada una es candidata a su propio spec futuro.
- **No:** proteger `/biblioteca`, el detalle de un juego o el Reproductor tras login — solo el guardado de puntuación queda detrás de sesión.
- **No:** cambios a `proxy.ts` — SPEC 03 ya deja listo el refresco de sesión para este caso.
- **No:** tabla `profiles` nueva ni `user_id` en `scores` — el nombre de cuenta vive en `user_metadata` de Supabase Auth, sin duplicar datos que este spec no necesita consultar con SQL.

## Risks

| Riesgo                                                                                                                                                                                                                            | Mitigación                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Confirm email" podría estar activado por defecto en el proyecto y no descubrirse hasta probar el registro                                                                                                                        | Paso 1 del plan lo verifica explícitamente antes de tocar código.                                                                                                     |
| Las credenciales OAuth de Google/GitHub no están creadas todavía; los botones quedarían implementados pero sin funcionar hasta que alguien complete ese paso manual en Google Cloud Console / GitHub / Supabase                   | Paso 2 del plan lo deja documentado como prerequisito explícito; el resto del spec (email+contraseña, guardado de puntuación, RLS) no depende de que esto esté listo. |
| El nombre derivado automáticamente de un perfil de Google/GitHub, truncado a 10 caracteres, puede quedar cortado de forma rara o colisionar con el de otro jugador en el leaderboard (`scores.name` es texto libre, sin unicidad) | Mismo comportamiento que ya acepta el registro manual por email (nombres de 1–10 caracteres sin garantía de unicidad); no se agrava ni se resuelve en este spec.      |
| Sustituir la policy de `INSERT` en `scores` por "solo authenticated" podría romper cualquier inserción que dependiera del acceso anónimo (scripts, pruebas manuales previas)                                                      | Paso 7 verifica explícitamente ambos roles (`anon` rechazado, `authenticated` funcionando) antes de darlo por bueno.                                                  |
| Un usuario con la sesión mock previa en `localStorage` (`av:user:v1`) la verá desaparecer tras este cambio, porque nunca fue una cuenta real                                                                                      | Comportamiento esperado: no había cuenta real que migrar; el usuario se registra una vez y listo.                                                                     |

## What is **not** in this spec

- Magic link (inicio de sesión sin contraseña por enlace al correo).
- Confirmación de email obligatoria.
- Recuperación de contraseña.
- Página de perfil o edición del nombre de cuenta.
- Protección de rutas de juego/biblioteca/detalle tras login — solo el guardado de puntuación.
- Tabla `profiles` nueva o `user_id` en `scores`.
- Persistencia o reintento del guardado de una puntuación de invitado tras iniciar sesión.
- Separar `/login` en dos rutas.

Cada uno de estos, si se implementa, va en su propio spec.
