# Plan: catálogo IGDB y colecciones compartidas (solo `games`)

Estado: diseño. Nada implementado todavía.

## Decisiones tomadas

- Alcance: solo `games`. Directo a IGDB (sin fase intermedia de título normalizado).
- App legacy (`public/legacy/`): ya no se usa, no se mantiene compatibilidad.
- Visibilidad: un usuario le da permiso explícito a otro para ver su colección (`access_grants`). Sin perfiles públicos.
- Campos compartidos: `title`, `status`, `score`, `hours`, `hltb`, `tags`, `releaseDate`, `yearCompleted`, `review`, `platform` (salvo `Pirated`), `igdbId`, `coverId`.
  Nunca se comparten: `price`, `purchaseDate`, `owned`, ni el valor `Pirated` de `platform` (se devuelve `null`).
- Reviews: se comparten por defecto, pero se muestran ocultas (click para revelar, anti-spoiler).
- Opiniones de otros: lista por defecto.
- Stats: el dueño elige qué widgets de su página de stats ven quienes tienen permiso.
- Ediciones: remasters, ports y ediciones se agrupan con el original (`version_parent` / `parent_game` de IGDB). Remakes y DLC quedan separados.
- Tiempo para terminar: se sigue usando HowLongToBeat (los datos de IGDB tienen mucha menos cobertura).
- Tags de IGDB: se muestran como sugerencias; solo entran al pool de tags si se clickean.
- SQL: lo aplica el usuario desde el SQL Editor de Supabase; las migraciones se versionan en `supabase/migrations/`.

## Fases

### 0. Base
1. Crear `supabase/migrations/`. Antes de cada migración: `create table games_backup_YYYYMMDD as table games;`.
2. `profiles(user_id pk, handle unique, display_name)`. Sirve para identificar a quién le das permiso sin exponer emails.
3. `access_grants(owner_id, viewer_id, created_at, pk(owner_id, viewer_id))`. El dueño otorga y revoca; es unidireccional.
4. Settings → "Compartir": buscar por handle, otorgar, listar, revocar.

### 1. Catálogo IGDB
5. App de Twitch y secrets en Supabase (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`).
6. Edge Function `igdb`: token cacheado y renovado, CORS para `github.io`, debounce en el cliente.
   - `search`: `name`, `alternative_names`, `first_release_date`, `cover.image_id`, `game_type`.
   - `detail`: lo necesario para `game_titles`, al elegir un juego.
7. `normalize_title()` en SQL (`immutable`, `unaccent`) para entradas manuales y backfill.
8. `game_titles(id, igdb_id, title, year, title_key, cover_id, game_type, parent_igdb_id, group_igdb_id, steam_appid, critic_rating, critic_count, user_rating, user_count, developer, publisher, franchise, fetched_at)`.
   `group_igdb_id` = original al que se agrupa (regla de ediciones). Se refresca si `fetched_at` es viejo.
9. Formulario "buscá y elegí" con fallback "agregar manual":
   - completa `title` y `releaseDate`;
   - guarda `igdbId` y `coverId` en el item (además de `title`);
   - sugiere tags (géneros, temas, keywords) como chips;
   - `hltb`, `platform`, `score`, `hours`, `owned`, `review`, `status` siguen manuales.
10. Columna generada `title_key` en `games` (fallback para items sin `igdbId`).
11. Backfill asistido: para cada item sin `igdbId`, sugerir candidato de IGDB; el usuario confirma. Solo agrega `igdbId`/`coverId`, nunca pisa campos existentes.
12. Atribución de IGDB en la UI.

### 2. Compartir
13. RPC `shared_games(owner_handle)`: verifica el grant y devuelve los items con solo los campos compartidos.
14. Vista de solo lectura de la colección de otro (`/games/?u=handle`): sin FAB, sin edición, sin importar/borrar.
15. Stats compartidos:
    - darle un `id` estable a cada `WidgetSpec`/`MetricSpec` de `games` (hoy no tienen);
    - `profiles.shared_stats` (ids visibles); por defecto, todos los que se pueden calcular con los campos compartidos;
    - toggle "visible para otros" por widget en la página de stats;
    - los widgets que dependen de precio o de `Pirated` no se pueden compartir.
    Nota: los stats se calculan en el cliente a partir de los items compartidos, así que ocultar un widget es una elección de presentación, no protege datos. Lo que protege es la lista de campos compartidos de la RPC.
16. RPC `game_opinions(item_id)`: matchea por `group_igdb_id`, con `title_key` como fallback; solo devuelve opiniones de dueños que te dieron permiso.
17. `ItemModal`: sección "Lo que opinan otros" (lista, review oculta hasta click), cargada al abrir.

### 3. Extras habilitados por el catálogo
18. Portadas en biblioteca y modal.
19. Stats: tu score vs. crítica, por desarrolladora/distribuidora, completitud de sagas.
20. Detalle extendido a pedido (resumen, capturas, videos, similares). No se guarda.

## TODO

- [ ] **Precio de Steam** (pospuesto): usar `game_titles.steam_appid` y un modo `steam-price` en la Edge Function (la API de Steam también necesita proxy por CORS). Solo aplica a juegos en Steam.
