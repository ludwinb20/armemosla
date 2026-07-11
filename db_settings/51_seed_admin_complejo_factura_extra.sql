-- Segunda factura pendiente para demo.admin@armemosla.com
-- Ejecutar después de 50_seed_admin_complejo_demo_pagos.sql
--
-- Genera reservas + factura del MES CALENDARIO ANTERIOR (la "Factura a pagar" en la app).
-- Ej: junio 2026 → mayo 2026 (~L 480 comisión, 6 reservas × L 800).

DO $$
DECLARE
  v_admin UUID;
  v_jugador UUID;
  v_cancha UUID;
  v_mes INTEGER;
  v_año INTEGER;
  v_dia INTEGER;
  v_ts TIMESTAMPTZ;
  v_email_admin CONSTANT TEXT := 'demo.admin@armemosla.com';
  v_dias INTEGER[] := ARRAY[4, 8, 12, 16, 22, 26];
BEGIN
  SELECT id INTO v_admin FROM auth.users WHERE email = v_email_admin LIMIT 1;
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'No existe %. Creá el usuario en Auth primero.', v_email_admin;
  END IF;

  SELECT c.id INTO v_cancha
  FROM public.canchas c
  INNER JOIN public.complejos co ON co.id = c.complejo_id
  WHERE co.admin_id = v_admin
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF v_cancha IS NULL THEN
    RAISE EXCEPTION 'Sin canchas para %. Ejecutá 50_seed_admin_complejo_demo_pagos.sql antes.', v_email_admin;
  END IF;

  SELECT
    EXTRACT(MONTH FROM (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'))::INTEGER,
    EXTRACT(YEAR FROM (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'))::INTEGER
  INTO v_mes, v_año;

  SELECT id INTO v_jugador
  FROM auth.users
  WHERE email IN ('demo.jugador1@armemosla.test', 'demo.jugador1@armemosla.com', 'demo.jugador2@armemosla.test')
  LIMIT 1;

  FOREACH v_dia IN ARRAY v_dias LOOP
    v_ts := make_timestamptz(v_año, v_mes, v_dia, 17, 0, 0);

    IF NOT EXISTS (
      SELECT 1 FROM public.reservas r
      WHERE r.cancha_id = v_cancha AND r.fecha_hora = v_ts AND r.estado = 'completada'
    ) THEN
      INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
      VALUES (
        v_cancha,
        v_ts,
        CASE WHEN v_jugador IS NOT NULL THEN v_jugador ELSE NULL END,
        v_jugador IS NOT NULL,
        'completada'
      );
    END IF;
  END LOOP;

  PERFORM public.calcular_factura_mensual(v_admin, v_mes, v_año);
  PERFORM public.procesar_politicas_pago_facturas();

  UPDATE public.facturas_mensuales
  SET
    fecha_pago = NULL,
    updated_at = TIMEZONE('utc', NOW())
  WHERE admin_id = v_admin AND mes = v_mes AND año = v_año AND fecha_pago IS NOT NULL;

  PERFORM public.procesar_politicas_pago_facturas();

  RAISE NOTICE 'OK: factura %/% para % (~6 reservas, comisión ~L 480).', v_mes, v_año, v_email_admin;
END $$;

-- Verificar:
-- SELECT fm.mes, fm.año, fm.total_facturado, fm.comision, fm.estado_pago
-- FROM public.facturas_mensuales fm
-- JOIN public.profiles p ON p.id = fm.admin_id
-- WHERE p.email = 'demo.admin@armemosla.com'
-- ORDER BY fm.año DESC, fm.mes DESC;
