-- Ejecutar manualmente en el SQL Editor de Supabase. Transacción atómica y repetible.
BEGIN;
DO $$
DECLARE checks text[];
BEGIN
  SELECT array_agg(c.conname) INTO checks
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attname = 'coleccion'
  WHERE c.conrelid = 'public.registros'::regclass
    AND c.contype = 'c' AND c.conkey = ARRAY[a.attnum]::smallint[];
  IF coalesce(array_length(checks, 1), 0) <> 1 THEN
    RAISE EXCEPTION 'Se esperaba un único CHECK exclusivo de coleccion; revisar el esquema antes de migrar';
  END IF;
  EXECUTE format('ALTER TABLE public.registros DROP CONSTRAINT %I', checks[1]);
END $$;
ALTER TABLE public.registros ADD CONSTRAINT registros_coleccion_check
  CHECK (coleccion IN ('actors', 'matriz', 'ideas', 'ideas-sintesis',
    'gremios-votos', 'gremios-taller', 'priorizacion-votos', 'canvas'));
COMMIT;
