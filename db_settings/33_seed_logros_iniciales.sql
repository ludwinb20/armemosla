-- Logros iniciales: Fiel a la cancha + Explorador
-- Ejecutar después de 32_logros_evaluacion.sql

INSERT INTO public.logros (
  codigo,
  titulo,
  descripcion,
  icono,
  activo,
  orden,
  criterio_tipo,
  criterio_params,
  recompensa_tipo,
  recompensa_valor,
  recompensa_restricciones
)
VALUES
  (
    'fiel_a_la_cancha',
    'Fiel a la cancha',
    'Completá 20 reservas en la misma cancha y ganá una reserva gratis ahí.',
    'football',
    true,
    1,
    'reservas_completadas_misma_cancha',
    '{"cantidad": 20}'::jsonb,
    'reserva_gratis',
    100,
    '{
      "misma_cancha_progreso": true,
      "valido_dias": 90,
      "requiere_reserva_pendiente": true
    }'::jsonb
  ),
  (
    'explorador',
    'Explorador',
    'Jugá en 10 canchas diferentes y obtené 20% de descuento en tu próxima reserva.',
    'compass',
    true,
    2,
    'canchas_distintas_jugadas',
    '{"cantidad": 10}'::jsonb,
    'porcentaje',
    20,
    '{
      "misma_cancha_progreso": false,
      "valido_dias": 60,
      "requiere_reserva_pendiente": true
    }'::jsonb
  )
ON CONFLICT (codigo) DO UPDATE SET
  titulo = EXCLUDED.titulo,
  descripcion = EXCLUDED.descripcion,
  icono = EXCLUDED.icono,
  activo = EXCLUDED.activo,
  orden = EXCLUDED.orden,
  criterio_tipo = EXCLUDED.criterio_tipo,
  criterio_params = EXCLUDED.criterio_params,
  recompensa_tipo = EXCLUDED.recompensa_tipo,
  recompensa_valor = EXCLUDED.recompensa_valor,
  recompensa_restricciones = EXCLUDED.recompensa_restricciones,
  updated_at = TIMEZONE('utc'::text, NOW());

SELECT codigo, titulo, criterio_tipo, recompensa_tipo, recompensa_valor
FROM public.logros
WHERE codigo IN ('fiel_a_la_cancha', 'explorador')
ORDER BY orden;
