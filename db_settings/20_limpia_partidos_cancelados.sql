-- Quita partidos marcados cancelados (antes se hacía UPDATE; el UNIQUE(reserva_id) impedía volver a publicar).
-- Ejecutar una vez en Supabase si existen filas con estado = 'cancelado'.

DELETE FROM public.partidos_abiertos
WHERE estado = 'cancelado';
