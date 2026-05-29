-- Función y trigger para auto-completar reservas
-- Ejecutar después de 11_reservas.sql
--
-- Esta función actualiza automáticamente las reservas de 'pendiente' a 'completada'
-- cuando han pasado 30 minutos después de la fecha_hora de la reserva

-- Función para auto-completar reservas
CREATE OR REPLACE FUNCTION public.auto_completar_reservas()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.reservas
  SET estado = 'completada',
      updated_at = TIMEZONE('utc'::text, NOW())
  WHERE estado = 'pendiente'
    AND fecha_hora + INTERVAL '30 minutes' < TIMEZONE('utc'::text, NOW());
END;
$$;

-- Comentario para documentación
COMMENT ON FUNCTION public.auto_completar_reservas() IS 'Actualiza automáticamente las reservas pendientes a completadas después de 30 minutos de su fecha_hora';

-- NO re-ejecutar después de 32_logros_evaluacion.sql / 38_auto_completar_con_logros.sql:
-- esta versión NO evalúa logros. Usar 38 para producción con cron.
--
-- Ejemplo de llamada manual:
-- SELECT public.auto_completar_reservas();

-- Opción: Trigger que se ejecuta antes de SELECT (menos eficiente, pero automático)
-- DROP TRIGGER IF EXISTS trigger_auto_completar_reservas ON public.reservas;
-- CREATE TRIGGER trigger_auto_completar_reservas
--   BEFORE SELECT ON public.reservas
--   FOR EACH STATEMENT
--   EXECUTE FUNCTION public.auto_completar_reservas();
--
-- NOTA: PostgreSQL no soporta triggers BEFORE SELECT directamente.
-- La mejor opción es llamar la función desde el backend antes de consultar reservas.

