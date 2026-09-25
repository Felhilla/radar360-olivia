begin;
alter table public.registros
drop constraint if exists registros_coleccion_check;
alter table public.registros
add constraint registros_coleccion_check
check (coleccion in (
  'actors',
  'matriz',
  'ideas',
  'ideas-sintesis',
  'gremios-votos',
  'gremios-taller',
  'priorizacion-votos',
  'canvas',
  'activacion-votos'
));
commit;
