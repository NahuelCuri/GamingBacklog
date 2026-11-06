# Remote MCP — Backlog desde Claude (web, desktop, mobile)

Objetivo: decirle a Claude desde el celular "anotá 4.500 de almuerzo" o "agregá Hades II a jugando" y que quede en la app.

## Por qué no puede vivir "en la página"

La app es un export estático en GitHub Pages: no hay servidor, solo HTML/JS. Un MCP remoto necesita un endpoint HTTP público, y Claude (web, desktop y mobile) lo llama **desde la nube de Anthropic**, no desde tu dispositivo, así que tampoco sirve el MCP local de `scripts/mcp/`.

El backend ya es Supabase, así que el MCP va ahí:

```
Claude mobile/web ──HTTPS──▶ Supabase Edge Function `mcp`  (Streamable HTTP)
        │                         │  Authorization: Bearer <JWT de Supabase del usuario>
        │                         ▼
        │                    Postgres (mismas tablas, mismo RLS que la página)
        │
        └─ OAuth 2.1 (PKCE + DCR) ──▶ Supabase Auth como OAuth server
                                      └─ pantalla de consentimiento: /oauth/consent en la app (GitHub Pages)
```

- **Auth: Supabase OAuth 2.1 Server**, que Supabase ya ofrece (con Dynamic Client Registration, que es lo que usan los custom connectors de Claude). El token que recibe la función es un JWT normal de Supabase de *tu* usuario → RLS aplica igual que en la página. Sin service role key, sin tokens propios.
- **Pantalla de consentimiento**: Supabase redirige a una página nuestra para que el usuario apruebe al cliente ("Claude quiere acceder a tu Backlog"). Va en la app estática; reutiliza el login que ya existe.
- Costo: Edge Functions y OAuth server entran en el plan free de Supabase.

## Fases

### 0. Verificar (antes de escribir código)
- [ ] Supabase: OAuth Server habilitable en este proyecto (Authentication → OAuth Server) y con DCR.
- [ ] Claude: tu plan permite custom connectors (en Free hay límite de uno) y que el redirect `https://claude.ai/api/mcp/auth_callback` funciona.

### 1. Núcleo de tools compartido
- Sacar la lógica de tools de `scripts/mcp/server.mjs` a un módulo puro (`mcp-core`) que recibe un cliente Supabase ya autenticado. Lo usan el MCP local (Node) y la Edge Function (Deno, vía `npm:@supabase/supabase-js`).
- Generar en build un `schemas.json` desde `config/collections/*` (campos del modal, enums, categorías sugeridas) para que las tools sepan qué pide cada colección sin duplicar la config a mano.
- Tools pensadas para chat corto desde el celular:
  - `add_expense`, `add_game`, `add_book`, `add_movie`, `add_wine`: argumentos tipados por colección (fecha por defecto: hoy, en hora local AR).
  - `list_items` / `search_items` (por mes, texto, estado).
  - `update_item`.
  - `delete_items`: exige `confirm: true`; la descripción le pide a Claude confirmar con vos.
  - (Después) `lookup_game` usando el catálogo IGDB del plan social.
- Tests con `memoryStore` como los del resto de `lib/`.

### 2. Edge Function `mcp`
- `supabase/functions/mcp/index.ts`: Streamable HTTP **sin estado** (POST JSON-RPC → respuesta JSON; sin SSE), mismo protocolo que el server local.
- Sin token o token inválido → `401` con `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource"`.
- Sirve `/.well-known/oauth-protected-resource` apuntando al issuer de Supabase Auth.
- Con token válido: `createClient(url, anonKey, { global: { headers: { Authorization } } })` → RLS.
- **Solo el dueño**: el `sub` del JWT tiene que estar en el secret `MCP_ALLOWED_USERS` (ids separados por coma, hoy solo el tuyo); si no, `403`. Es la barrera real: aunque otro usuario de la app registre su propio conector y se loguee, no pasa de acá. Sumar a alguien = agregar su id al secret, sin redeploy.
- Deploy: `supabase functions deploy mcp --no-verify-jwt` (la función valida el token ella misma para poder devolver el 401 con metadata).
- Probar con MCP Inspector pegando un access token a mano.

### 3. OAuth
- Dashboard: habilitar OAuth Server + DCR; authorization path → `https://nahuelcuri.github.io/GamingBacklog/oauth/consent/`.
- Página `app/oauth/consent/page.tsx`: si no hay sesión, login; muestra cliente + permisos; Aprobar / Rechazar con la API OAuth de supabase-js.
- La pantalla de consentimiento también corta a quien no esté en la lista ("Este conector es privado") para que ni siquiera llegue a aprobar; es UX, la seguridad la da el chequeo de la función.
- Guardrails: aceptar solo redirect URIs de `claude.ai` (y `localhost` para el Inspector/Claude Code), consentimiento siempre explícito, lista de clientes autorizados con "revocar" en Ajustes.

### 4. Conectar Claude
- claude.ai → Settings → Connectors → Add custom connector → URL `https://<proyecto>.supabase.co/functions/v1/mcp`, sin client id/secret (se registra solo por DCR).
- Login + consentimiento una vez en la web; queda disponible en mobile y desktop.
- Claude Code también puede usar este remoto (`claude mcp add --transport http backlog <url>`) y el MCP local pasa a ser opcional.

### 5. Pulido
- Logs mínimos de llamadas (tool, colección, ok/error) para depurar.
- Mensajes de error pensados para que Claude los explique bien ("no existe esa colección", "la fecha debe ser AAAA-MM-DD").
- Bump de `version` del server y changelog corto en este doc.

## Riesgos / decisiones abiertas
- **OAuth Server de Supabase es reciente**: si algo no funciona con Claude (DCR, metadata), plan B es implementar `/authorize`, `/token` y `/register` dentro de la misma Edge Function con tokens propios guardados hasheados en una tabla `mcp_tokens`. Más código y más superficie de seguridad; solo si el plan A falla.
- **Tablas compartidas** (`wines`): el MCP escribe con `added_by` como `store.ts`; el otro miembro ve los cambios por realtime.
- **Alcance**: arrancar sin `delete_items` remoto y sumarlo cuando el flujo esté probado.

## Fuentes
- Supabase OAuth 2.1 Server: https://supabase.com/docs/guides/auth/oauth-server
- Supabase, MCP authentication: https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication
- Claude connectors, autenticación: https://claude.com/docs/connectors/building/authentication
