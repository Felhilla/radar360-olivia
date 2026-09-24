-- Radar 360 · Taller Olivia Colombia — esquema de datos en Supabase
-- Reemplaza los stores de Netlify Blobs. Una sola tabla: cada fila es un registro de una colección
-- (el equivalente a un blob), con su contenido en JSON.
-- Ejecutar una vez en Supabase → SQL Editor.

create table if not exists public.registros (
  coleccion  text        not null check (coleccion in (
               'actors', 'matriz', 'ideas', 'ideas-sintesis',
               'gremios-votos', 'gremios-taller', 'priorizacion-votos', 'canvas')),
  id         text        not null check (length(id) between 1 and 400),
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (coleccion, id)
);

-- El sitio es público y sin inicio de sesión, igual que en Netlify: cualquiera con el enlace lee y escribe.
alter table public.registros enable row level security;

drop policy if exists "lectura publica" on public.registros;
drop policy if exists "alta publica" on public.registros;
drop policy if exists "edicion publica" on public.registros;
drop policy if exists "borrado publico" on public.registros;

create policy "lectura publica" on public.registros for select to anon using (true);
create policy "alta publica"    on public.registros for insert to anon with check (true);
create policy "edicion publica" on public.registros for update to anon using (true) with check (true);
create policy "borrado publico" on public.registros for delete to anon using (true);

grant select, insert, update, delete on public.registros to anon;
