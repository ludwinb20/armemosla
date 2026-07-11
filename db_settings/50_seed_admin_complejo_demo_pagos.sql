-- Seed: admin de complejo demo con factura pendiente para probar pagos por transferencia
-- Ejecutar después de 48_pagos_transferencias.sql y 49_seed_pagos_transferencias.sql
--
-- IMPORTANTE: pegá y ejecutá TODO este archivo en el SQL Editor de Supabase.
-- No ejecutes solo el email; eso da error de sintaxis.
--
-- Usuario requerido en Auth: demo.admin@armemosla.com

DO $$
DECLARE
  v_admin UUID;
  v_jugador UUID;
  v_complejo UUID;
  v_cancha UUID;
  v_mes_factura INTEGER := 4;
  v_año_factura INTEGER := 2026;
  v_email_admin CONSTANT TEXT := 'demo.admin@armemosla.com';
BEGIN
  SELECT id INTO v_admin
  FROM auth.users
  WHERE email = v_email_admin
  LIMIT 1;

  IF v_admin IS NULL THEN
    RAISE EXCEPTION
      'Falta % en Auth. Créalo en Supabase → Authentication → Users y vuelve a ejecutar TODO este script.',
      v_email_admin;
  END IF;

  -- Jugador demo opcional (reservas sin jugador también cuentan para la factura)
  SELECT id INTO v_jugador
  FROM auth.users
  WHERE email IN ('demo.jugador1@armemosla.test', 'demo.jugador1@armemosla.com')
  LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, user_type, es_admin_plataforma)
  VALUES (
    v_admin,
    v_email_admin,
    'Roberto Demo Complejo',
    'Administrador de Cancha',
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    user_type = 'Administrador de Cancha',
    es_admin_plataforma = false;

  SELECT id INTO v_complejo
  FROM public.complejos
  WHERE admin_id = v_admin AND nombre = 'Complejo Demo Pagos'
  LIMIT 1;

  IF v_complejo IS NULL THEN
    INSERT INTO public.complejos (
      admin_id, nombre, direccion_texto, direccion_lat, direccion_lng, oculto, activo
    )
    VALUES (
      v_admin,
      'Complejo Demo Pagos',
      'Tegucigalpa, Honduras (demo)',
      14.07230000,
      -87.19210000,
      false,
      true
    )
    RETURNING id INTO v_complejo;
  ELSE
    UPDATE public.complejos
    SET
      oculto = false,
      activo = true,
      direccion_texto = COALESCE(NULLIF(direccion_texto, ''), 'Tegucigalpa, Honduras (demo)'),
      direccion_lat = COALESCE(direccion_lat, 14.07230000),
      direccion_lng = COALESCE(direccion_lng, -87.19210000)
    WHERE id = v_complejo;
  END IF;

  SELECT id INTO v_cancha
  FROM public.canchas
  WHERE complejo_id = v_complejo AND nombre = 'Cancha 5v5 Demo'
  LIMIT 1;

  IF v_cancha IS NULL THEN
    INSERT INTO public.canchas (
      complejo_id, nombre, largo, ancho, jugadores_por_equipo, precio_por_hora, activo
    )
    VALUES (v_complejo, 'Cancha 5v5 Demo', 40, 20, 5, 800.00, true)
    RETURNING id INTO v_cancha;
  END IF;

  IF v_jugador IS NOT NULL THEN
    INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
    SELECT v_cancha, ts, v_jugador, true, 'completada'
    FROM (VALUES
      (TIMESTAMPTZ '2026-04-05 18:00:00+00'),
      (TIMESTAMPTZ '2026-04-12 19:00:00+00'),
      (TIMESTAMPTZ '2026-04-18 17:30:00+00'),
      (TIMESTAMPTZ '2026-04-22 20:00:00+00'),
      (TIMESTAMPTZ '2026-04-28 16:00:00+00')
    ) AS t(ts)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.reservas r
      WHERE r.cancha_id = v_cancha AND r.fecha_hora = t.ts AND r.estado = 'completada'
    );
  ELSE
    INSERT INTO public.reservas (cancha_id, fecha_hora, user_id, made_by_player, estado)
    SELECT v_cancha, ts, NULL, false, 'completada'
    FROM (VALUES
      (TIMESTAMPTZ '2026-04-05 18:00:00+00'),
      (TIMESTAMPTZ '2026-04-12 19:00:00+00'),
      (TIMESTAMPTZ '2026-04-18 17:30:00+00'),
      (TIMESTAMPTZ '2026-04-22 20:00:00+00'),
      (TIMESTAMPTZ '2026-04-28 16:00:00+00')
    ) AS t(ts)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.reservas r
      WHERE r.cancha_id = v_cancha AND r.fecha_hora = t.ts AND r.estado = 'completada'
    );
  END IF;

  PERFORM public.calcular_factura_mensual(v_admin, v_mes_factura, v_año_factura);
  PERFORM public.procesar_politicas_pago_facturas();

  RAISE NOTICE 'OK: % listo. Factura %/% (~L 400 comisión).', v_email_admin, v_mes_factura, v_año_factura;
END $$;

-- Admin plataforma (tu otra cuenta):
-- UPDATE public.profiles SET es_admin_plataforma = true WHERE email = 'tu-email@...';

-- Verificar:
-- SELECT email, user_type, es_admin_plataforma FROM public.profiles
-- WHERE email = 'demo.admin@armemosla.com';
