# Trips por usuario, con compartir

Estado: fases 1–3 implementadas en la rama `trips-sharing` (2026-10-19); falta aplicar el SQL y la limpieza.

- SQL: `supabase/trips_sharing.sql` (aplicar **antes** de desplegar la app: la app nueva llama a `trip_people`) y después `supabase/trips_sharing_cleanup.sql`.
- Solo rol editor por ahora; `viewer` existe en la tabla pero la app no lo ofrece.
- Ids nuevos: `t`/`c` + timestamp + 6 caracteres aleatorios (`newId`).

## Hoy

- `trips` y `trip_cards` (`id, data, added_by, updated_at`) son un único espacio compartido.
- RLS deja entrar a quien esté en `trip_members`; la UI usa la allowlist `TRIP_MEMBERS` (`config/libraries.ts`).
- Todos ven todo. El canal realtime es uno solo (`trips-shared`).
- Si el espacio está vacío, se siembra el viaje de ejemplo con ids fijos (`t1`, `c1`…).

## Objetivo

- Cualquier usuario logueado tiene sus propios viajes.
- El dueño comparte un viaje con otro usuario como **editor** (o **lector**, en una fase posterior).
- El dueño puede revocar; el invitado puede salir del viaje.
- Compartir es por viaje, no por todo el espacio.

## Modelo de datos (SQL, se aplica a mano en el SQL Editor)

```sql
-- 1. Dueño del viaje
alter table trips add column owner_id uuid not null default auth.uid() references auth.users(id);

-- 2. Viaje de cada card, en una columna que RLS puede usar (sale de data.trip, no cambia el cliente)
alter table trip_cards add column trip_id text generated always as (data->>'trip') stored;
create index on trip_cards(trip_id);

-- 3. Con quién se comparte
create table trip_shares (
  trip_id    text not null references trips(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'editor' check (role in ('editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

-- 4. Helpers (SECURITY DEFINER para no recursar en RLS)
create function can_read_trip(t text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = t and owner_id = auth.uid())
      or exists (select 1 from trip_shares where trip_id = t and user_id = auth.uid());
$$;
create function can_edit_trip(t text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from trips where id = t and owner_id = auth.uid())
      or exists (select 1 from trip_shares where trip_id = t and user_id = auth.uid() and role = 'editor');
$$;
```

Sin FK de `trip_cards.trip_id` a `trips`: el cliente sube viajes y cards en paralelo, y la FK fallaría en ese caso. Las cards de un viaje borrado las borra el cliente, como ahora. Opcional: un trigger que las borre igual.

## RLS

| Tabla | select | insert | update | delete |
|---|---|---|---|---|
| `trips` | `can_read_trip(id)` | `owner_id = auth.uid()` | `can_edit_trip(id)`; `owner_id` no cambia (trigger o check) | `owner_id = auth.uid()` |
| `trip_cards` | `can_read_trip(trip_id)` | `can_edit_trip(trip_id)` | `can_edit_trip(trip_id)` | `can_edit_trip(trip_id)` |
| `trip_shares` | dueño del viaje o `user_id = auth.uid()` | solo vía RPC | dueño (cambiar rol) | dueño, o `user_id = auth.uid()` (salir) |

El upsert actual sirve tal cual: no manda `owner_id`, así que al insertar toma `auth.uid()` y al actualizar no lo toca.

## Invitar sin exponer usuarios

RPC `share_trip(trip_id, email, role)` SECURITY DEFINER:

- verifica que quien llama es el dueño;
- busca el uid por email exacto en `auth.users`;
- inserta en `trip_shares`;
- devuelve `ok` / `not_found`, sin revelar nada más.

RPC `trip_members(trip_id)` devuelve, para el dueño y los invitados, el email (o el handle) y el rol de cada uno.

Cuando exista `profiles.handle` (ver `SOCIAL_IGDB_PLAN.md`), se suma la búsqueda por handle.

## Migración de los datos actuales

1. `update trips set owner_id = '<admin uid>'`.
2. `insert into trip_shares select id, '<uid del hermano>', 'editor' from trips`.
3. Con eso, los dos siguen viendo lo mismo.
4. `trip_members` y sus policies se borran al final (fase 4). Hasta entonces conviven con un OR.

## Cliente

- **Acceso**: sacar el gate `isTripMember` de `TripsRoute`, `useTripStore` y `prefs`. Trips pasa a ser una librería más.
- **Ids**: `newId` usa `t` + timestamp y el seed usa `t1`/`c1`. Con un espacio por usuario chocan en la PK: un upsert sobre una fila ajena falla por RLS.
  - Pasar a `crypto.randomUUID()` para lo nuevo (los ids viejos quedan).
  - El seed genera ids nuevos, o se reemplaza por el estado vacío.
- **Escritura**: en `useTrips.write`, subir primero los viajes y después las cards. Si no, RLS rechaza la card de un viaje que todavía no existe.
- **Carga**: `select("data, owner_id")` en `trips`, para saber qué viajes son míos y cuáles compartidos.
- **Realtime**:
  - canal por usuario (`trips-<uid>`);
  - `postgres_changes` respeta RLS en inserts y updates;
  - los DELETE de filas ajenas llegan solo con el id y no hacen nada.
  - Si te revocan, el viaje desaparece en la próxima carga y se ve "This trip isn't here".
- **Copia local**: la key `trip-planner-v1` pasa a ser por usuario (`trip-planner-v1:<uid>`).

## UI

- **Home**: badge "Compartido por X" en los viajes ajenos y avatares de los invitados en los propios. Se pueden reemplazar los `companions` decorativos.
- **Board**: botón "Share", al lado de Edit y Export, que abre un diálogo:
  - lista de personas con su rol;
  - un campo de email para agregar;
  - quitar a alguien.
  - Un invitado ve "Leave trip" en lugar de Delete.
- **Editor del viaje**: "Delete trip" solo para el dueño.
- **Lector** (fase 3b): sin FAB, sin drag, sin editar. El Export sigue disponible.

## Fases

1. **SQL** (compatible hacia atrás): columnas, `trip_shares`, helpers, policies nuevas con OR a `trip_members`, migración de los datos.
2. **Cliente por usuario**:
   - sacar la allowlist;
   - ids aleatorios;
   - orden de escritura;
   - `owner_id` en la carga;
   - canal y copia local por usuario.
3. **Compartir**: RPCs `share_trip` y `trip_members`, diálogo Share, Leave y badges. 3b: rol lector.
4. **Limpieza**: borrar `trip_members`, `TRIP_MEMBERS` y las policies viejas.

## Relacionado

- **Export** (hecho): un viaje se descarga como JSON (`{ trips: [trip], cards }`) desde el header del board.
- **Import** (pendiente): crear el viaje del archivo como uno nuevo, con ids nuevos. Es otra forma de compartir: la copia es independiente del original.
