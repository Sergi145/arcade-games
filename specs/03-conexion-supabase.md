# SPEC 03 — Conexión Next.js ↔ Supabase

> **Status:** Implemented
> **Depends on:** Ninguna
> **Date:** 2026-09-09
> **Objective:** Conectar el proyecto Next.js con el proyecto de Supabase existente (`ddbbdyjjsvrxzbijprwg`) mediante `@supabase/ssr`, verificando el round-trip completo con una tabla mínima de prueba, sin migrar todavía ningún dato o lógica real (sesión, juegos, puntuaciones).

## Por qué existe este spec

El proyecto ya tiene un servidor MCP de Supabase configurado (`.mcp.json`, project ref `ddbbdyjjsvrxzbijprwg`) apuntando a un proyecto Supabase vacío (sin tablas ni migraciones), pero el código de Next.js no tiene ningún cliente de Supabase instalado ni variables de entorno configuradas. Toda la persistencia actual (`lib/session.tsx`, sesión y puntuaciones guardadas) sigue viviendo en `localStorage`, según lo decidido en SPEC 01. Este spec establece únicamente la plomería de conexión — paquetes, clientes, variables de entorno y una verificación real de lectura — dejando la migración de datos y autenticación reales para specs futuros.

## Scope

**In:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno: `.env.local` (gitignored, con los valores reales del proyecto `ddbbdyjjsvrxzbijprwg`) y `.env.local.example` (committeado, con placeholders) — `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `lib/supabase/client.ts` — cliente de navegador (`createBrowserClient`), para usar desde componentes cliente.
- `lib/supabase/server.ts` — cliente de servidor (`createServerClient`, leyendo/escribiendo cookies vía `next/headers`), para usar desde Server Components y Route Handlers.
- `proxy.ts` en la raíz del proyecto (convención de Next.js 16, sucesora de `middleware.ts`), con el helper estándar de `@supabase/ssr` para refrescar el token de sesión en cada request (matcher que excluye estáticos: `_next/static`, `_next/image`, `favicon.ico`, assets).
- Una migración SQL aplicada al proyecto remoto (vía `mcp__supabase__apply_migration`) que crea una tabla `health_check` con una fila sembrada.
- Página de verificación `app/supabase-status/page.tsx` (Server Component) que consulta `health_check` con el cliente de servidor y muestra el resultado, o un estado de error visible si la consulta falla.

**Out of scope (para specs futuros):**

- Migrar `lib/session.tsx` (login/logout mock) a Supabase Auth real.
- Migrar `lib/games.ts` o `lib/scores.ts` a tablas reales, o sustituir sus datos mock por queries.
- Cualquier tabla o esquema de dominio (juegos, puntuaciones, perfiles de usuario).
- Row Level Security más allá de la lectura pública mínima necesaria para que `/supabase-status` funcione.
- Stack local de Supabase CLI (`supabase init` + Docker) — las migraciones se aplican directamente al proyecto remoto vía MCP.
- Variables de entorno de producción / configuración de despliegue.
- Enlazar `/supabase-status` desde el Nav o cualquier otra pantalla del producto.

## Data model

```sql
-- health_check: tabla de verificación, temporal, no forma parte del dominio real de la app
create table health_check (
  id bigint generated always as identity primary key,
  message text not null,
  created_at timestamptz not null default now()
);

alter table health_check enable row level security;

create policy "Public read access" on health_check
  for select
  to anon, authenticated
  using (true);
```

La propia migración siembra una fila: `message = 'Supabase conectado correctamente'`. RLS está habilitado con una política de solo lectura pública (sin insert/update/delete), para que la publishable key pueda leer pero no escribir. Esta tabla y la página que la consulta son andamiaje para probar la conexión — el modelo de datos real (juegos, sesión, puntuaciones) se define en specs futuros cuando se migren esas piezas.

## Implementation plan

1. `npm install @supabase/supabase-js @supabase/ssr`. Verificación: `package.json`/`package-lock.json` actualizados, `npm run build` sigue funcionando.
2. Crear `.env.local` (gitignored, con la URL real `https://ddbbdyjjsvrxzbijprwg.supabase.co` y la publishable key `sb_publishable_...` del proyecto) y `.env.local.example` (committeado, con placeholders `NEXT_PUBLIC_SUPABASE_URL=` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`). Verificación: `.env.local` no aparece en `git status` (ya cubierto por el `.gitignore` existente, que ignora `.env*`).
3. Crear `lib/supabase/client.ts` con `createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)`. Verificación: se importa sin errores de tipos.
4. Crear `lib/supabase/server.ts` con `createServerClient(...)` siguiendo el patrón oficial de `@supabase/ssr` para Server Components (cookies vía `next/headers`). Verificación: se importa sin errores de tipos.
5. Crear `proxy.ts` en la raíz (nombre requerido por Next.js 16; `middleware.ts` está deprecado) con la función `proxy` que refresca la sesión de Supabase en cada request, con el matcher estándar que excluye estáticos. Verificación: `npm run dev` arranca sin errores y las rutas existentes (`/`, `/biblioteca`, `/login`, etc.) siguen funcionando.
6. Aplicar la migración SQL que crea `health_check`, siembra la fila inicial, habilita RLS y añade la política de solo lectura pública, vía `mcp__supabase__apply_migration`. Verificación: `mcp__supabase__list_tables` muestra `health_check` en el esquema `public` con `rls_enabled: true` y sin advisories de seguridad pendientes.
7. Crear `app/supabase-status/page.tsx` (Server Component) que use `lib/supabase/server.ts` para hacer `select * from health_check limit 1`, mostrando el mensaje y la fecha si tiene éxito, o un bloque de error visible si la consulta falla. Verificación: visitar `/supabase-status` en `npm run dev` muestra "Supabase conectado correctamente" y la fecha sembrada.
8. Ejecutar `npm run lint` y `npm run build`. Verificación: ambos terminan sin errores.

## Acceptance criteria

- [x] `@supabase/supabase-js` y `@supabase/ssr` están en `package.json`.
- [x] Existe `.env.local` (gitignored) con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` apuntando al proyecto `ddbbdyjjsvrxzbijprwg`, y `.env.local.example` committeado con placeholders.
- [x] `lib/supabase/client.ts` y `lib/supabase/server.ts` existen y exportan un cliente Supabase utilizable desde componentes cliente y desde Server Components respectivamente.
- [x] `proxy.ts` refresca la sesión de Supabase en cada request no estático.
- [x] La tabla `health_check` existe en el proyecto Supabase remoto con una fila sembrada, RLS habilitado y una política de solo lectura pública.
- [x] `/supabase-status` muestra el mensaje y la fecha de la fila sembrada, confirmando que la app puede leer datos reales de Supabase.
- [x] Si la conexión falla (credenciales inválidas), `/supabase-status` muestra un estado de error visible en vez de crashear la página.
- [x] `npm run lint` y `npm run build` terminan sin errores.

## Decisions

- **Sí:** usar `@supabase/ssr` con tres piezas (cliente de navegador, cliente de servidor, middleware) en vez de un único cliente de navegador. Es el patrón oficial de Supabase para App Router y deja listo el terreno para Supabase Auth real en un spec futuro — decidido explícitamente en la fase de preguntas.
- **Sí:** usar la publishable key nueva (`sb_publishable_...`) en vez de la legacy anon key (JWT). Es el formato recomendado por Supabase para proyectos nuevos — decidido explícitamente en la fase de preguntas.
- **Sí:** crear una tabla `health_check` real y una página que la consulte para verificar la conexión, en vez de solo comprobar que el cliente se inicializa sin errores. Prueba el round-trip completo (Next.js → Supabase → Next.js), no solo que las credenciales tienen el formato correcto — decidido explícitamente en la fase de preguntas.
- **No:** migrar `lib/session.tsx`, `lib/games.ts` o `lib/scores.ts` a Supabase en este spec. Es infraestructura de conexión únicamente; migrar datos y auth reales son cambios grandes con su propio scope, decisiones de esquema y riesgos — quedan para specs futuros, confirmado explícitamente por el usuario ("solo quiero la conexión únicamente").
- **No:** levantar un stack local de Supabase CLI (`supabase init` + Docker). El servidor MCP de Supabase ya está configurado contra el proyecto remoto (`.mcp.json`), así que las migraciones se aplican directamente ahí — más simple para un proyecto en fase temprana sin datos de producción que proteger.
- **Sí:** usar `proxy.ts` (función `proxy`) en vez de `middleware.ts` (función `middleware`). La doc de Next.js 16 en `node_modules/next/dist/docs/` marca `middleware.ts` como deprecado — sigue funcionando, pero `proxy.ts` es la convención vigente. Confirmado explícitamente durante la implementación (Paso 5), tras detectarlo y presentarlo como ambigüedad no resuelta por el spec original.
- **No:** enlazar `/supabase-status` desde el Nav u otras pantallas. Es una página de diagnóstico temporal, no parte del producto — se accede solo por URL directa mientras sea útil.

## Risks

| Riesgo                                                                                                                          | Mitigación                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Las variables de entorno solo existen en `.env.local` local, no en un entorno de despliegue                                     | Fuera del scope de este spec (no hay despliegue todavía); `.env.local.example` documenta qué variables hacen falta para cuando se configure uno.                   |
| `middleware.ts` mal configurado bloquea o rompe rutas existentes                                                                | El paso 5 usa el matcher estándar recomendado por Supabase (excluye estáticos) y el paso 8 corre build/lint más una pasada manual por las rutas existentes.        |
| La publishable key es un formato reciente; alguna versión de `@supabase/ssr` podría no reconocerla igual que la legacy anon key | Se fija la versión exacta instalada en `package-lock.json`; si hay incompatibilidad, la legacy anon key (ya disponible en el proyecto) es el fallback documentado. |

## What is **not** in this spec

- Supabase Auth real reemplazando el login mock de `lib/session.tsx`.
- Cualquier tabla o esquema para juegos, puntuaciones o perfiles de usuario.
- Row Level Security más allá de permitir lectura pública de `health_check`.
- Despliegue a un entorno con variables de entorno de producción.

Cada uno de estos, si se implementa, va en su propio spec.
