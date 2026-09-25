-- PROPUESTA · NO EJECUTADA. Endurecimiento mínimo de Supabase para el taller (25 sep 2026).
-- Ver docs/seguridad-revision.md. Revisar con Felipe antes de correrla en el SQL Editor.
-- Líneas cortas a propósito: el editor corta las líneas largas al pegar.

begin;

-- 1. Nadie borra actores desde la web: el sitio los descarta con estado, no los elimina.
drop policy if exists "borrado publico" on public.registros;
create policy "borrado publico"
on public.registros for delete to anon
using (coleccion <> 'actors');

-- 2. Tope de tamaño por registro (evita cargar basura masiva).
alter table public.registros
drop constraint if exists registros_data_tamano;
alter table public.registros
add constraint registros_data_tamano
check (octet_length(data::text) <= 20000);

-- 3. El id del registro debe coincidir con data.id en
--    las colecciones que lo guardan (evita duplicados).
alter table public.registros
drop constraint if exists registros_actor_id;
alter table public.registros
add constraint registros_actor_id
check (coleccion <> 'actors' or data->>'id' = id);

commit;

-- Después del taller (requiere más trabajo, no es SQL suelto):
-- * Inicio de sesión real (Supabase Auth, enlace mágico) para
--   participantes y administradores; políticas RLS por rol.
-- * Escrituras vía funciones (RPC o Edge Functions) que validen
--   como hoy lo hace public/api-supabase.js en el navegador.
-- * Repositorio privado y retiro de datos sensibles de la Matriz.
