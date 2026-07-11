-- Seed: pagos pendientes de revisión + solicitudes de reembolso + transferencias confirmadas
-- Para probar la tab "Por revisar" y "Reembolso directo" (admin plataforma)
--
-- Ejecutar después de:
--   48_pagos_transferencias.sql
--   49_seed_pagos_transferencias.sql
--   50_seed_admin_complejo_demo_pagos.sql
--   51_seed_admin_complejo_factura_extra.sql
--   52_solicitudes_reembolso.sql
--
-- Requiere: demo.admin@armemosla.com (Auth)

DO $$
DECLARE
  v_admin UUID;
  v_cuenta_bac UUID;
  v_cuenta_ficohsa UUID;
  v_factura_pagar UUID;
  v_factura_abril UUID;
  v_t UUID;
  v_mes_pagar INTEGER;
  v_año_pagar INTEGER;
  v_email_admin CONSTANT TEXT := 'demo.admin@armemosla.com';
BEGIN
  SELECT id INTO v_admin FROM auth.users WHERE email = v_email_admin LIMIT 1;
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Falta % en Auth. Ejecutá 50_seed_admin_complejo_demo_pagos.sql primero.', v_email_admin;
  END IF;

  SELECT id INTO v_cuenta_bac
  FROM public.cuentas_bancarias_armemosla
  WHERE banco_nombre = 'BAC Credomatic' AND activo = true
  LIMIT 1;

  SELECT id INTO v_cuenta_ficohsa
  FROM public.cuentas_bancarias_armemosla
  WHERE banco_nombre = 'Banco Ficohsa' AND activo = true
  LIMIT 1;

  IF v_cuenta_bac IS NULL OR v_cuenta_ficohsa IS NULL THEN
    RAISE EXCEPTION 'Faltan cuentas bancarias. Ejecutá 49_seed_pagos_transferencias.sql.';
  END IF;

  SELECT
    EXTRACT(MONTH FROM (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'))::INTEGER,
    EXTRACT(YEAR FROM (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'))::INTEGER
  INTO v_mes_pagar, v_año_pagar;

  SELECT id INTO v_factura_pagar
  FROM public.facturas_mensuales
  WHERE admin_id = v_admin AND mes = v_mes_pagar AND año = v_año_pagar
  LIMIT 1;

  SELECT id INTO v_factura_abril
  FROM public.facturas_mensuales
  WHERE admin_id = v_admin AND mes = 4 AND año = 2026
  LIMIT 1;

  IF v_factura_pagar IS NULL THEN
    RAISE EXCEPTION 'Sin factura %/%. Ejecutá 51_seed_admin_complejo_factura_extra.sql.', v_mes_pagar, v_año_pagar;
  END IF;

  IF v_factura_abril IS NULL THEN
    RAISE EXCEPTION 'Sin factura abril/2026. Ejecutá 50_seed_admin_complejo_demo_pagos.sql.';
  END IF;

  -- -------------------------------------------------------------------------
  -- Pagos pendientes de revisión (tab Por revisar — badge "Pago reportado")
  -- -------------------------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1 FROM public.transferencias WHERE numero_transaccion = 'DEMO-REV-PEND-001'
  ) THEN
    INSERT INTO public.transferencias (
      admin_id, cuenta_bancaria_id, numero_transaccion, monto, estado, solicita_factura_rtn, created_at
    ) VALUES (
      v_admin, v_cuenta_bac, 'DEMO-REV-PEND-001', 200.00, 'pendiente_revision', false,
      TIMEZONE('utc', NOW()) - INTERVAL '2 days'
    )
    RETURNING id INTO v_t;

    INSERT INTO public.transferencia_facturas (transferencia_id, factura_id, monto_aplicado)
    VALUES (v_t, v_factura_pagar, 200.00);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.transferencias WHERE numero_transaccion = 'DEMO-REV-PEND-002'
  ) THEN
    INSERT INTO public.transferencias (
      admin_id, cuenta_bancaria_id, numero_transaccion, monto, estado, solicita_factura_rtn, created_at
    ) VALUES (
      v_admin, v_cuenta_ficohsa, 'DEMO-REV-PEND-002', 150.00, 'pendiente_revision', true,
      TIMEZONE('utc', NOW()) - INTERVAL '1 day'
    )
    RETURNING id INTO v_t;

    INSERT INTO public.transferencia_facturas (transferencia_id, factura_id, monto_aplicado)
    VALUES (v_t, v_factura_pagar, 150.00);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.transferencias WHERE numero_transaccion = 'DEMO-REV-PEND-003'
  ) THEN
    INSERT INTO public.transferencias (
      admin_id, cuenta_bancaria_id, numero_transaccion, monto, estado, solicita_factura_rtn, created_at
    ) VALUES (
      v_admin, v_cuenta_bac, 'DEMO-REV-PEND-003', 130.00, 'pendiente_revision', false,
      TIMEZONE('utc', NOW()) - INTERVAL '6 hours'
    )
    RETURNING id INTO v_t;

    INSERT INTO public.transferencia_facturas (transferencia_id, factura_id, monto_aplicado)
    VALUES (v_t, v_factura_pagar, 130.00);
  END IF;

  UPDATE public.facturas_mensuales
  SET
    estado_pago = 'en_revision',
    fecha_pago = NULL,
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = v_factura_pagar;

  -- -------------------------------------------------------------------------
  -- Transferencias confirmadas (abril 2026) — base para reembolsos
  -- -------------------------------------------------------------------------

  IF NOT EXISTS (
    SELECT 1 FROM public.transferencias WHERE numero_transaccion = 'DEMO-REV-CONF-001'
  ) THEN
    INSERT INTO public.transferencias (
      admin_id, cuenta_bancaria_id, numero_transaccion, monto, estado,
      revisado_at, created_at
    ) VALUES (
      v_admin, v_cuenta_bac, 'DEMO-REV-CONF-001', 200.00, 'confirmada',
      TIMEZONE('utc', NOW()) - INTERVAL '10 days',
      TIMEZONE('utc', NOW()) - INTERVAL '12 days'
    )
    RETURNING id INTO v_t;

    INSERT INTO public.transferencia_facturas (transferencia_id, factura_id, monto_aplicado)
    VALUES (v_t, v_factura_abril, 200.00);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.transferencias WHERE numero_transaccion = 'DEMO-REV-CONF-002'
  ) THEN
    INSERT INTO public.transferencias (
      admin_id, cuenta_bancaria_id, numero_transaccion, monto, estado,
      revisado_at, created_at
    ) VALUES (
      v_admin, v_cuenta_ficohsa, 'DEMO-REV-CONF-002', 200.00, 'confirmada',
      TIMEZONE('utc', NOW()) - INTERVAL '8 days',
      TIMEZONE('utc', NOW()) - INTERVAL '9 days'
    )
    RETURNING id INTO v_t;

    INSERT INTO public.transferencia_facturas (transferencia_id, factura_id, monto_aplicado)
    VALUES (v_t, v_factura_abril, 200.00);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.transferencias WHERE numero_transaccion = 'DEMO-REV-CONF-003'
  ) THEN
    INSERT INTO public.transferencias (
      admin_id, cuenta_bancaria_id, numero_transaccion, monto, estado,
      revisado_at, created_at
    ) VALUES (
      v_admin, v_cuenta_bac, 'DEMO-REV-CONF-003', 120.00, 'confirmada',
      TIMEZONE('utc', NOW()) - INTERVAL '5 days',
      TIMEZONE('utc', NOW()) - INTERVAL '6 days'
    )
    RETURNING id INTO v_t;

    INSERT INTO public.transferencia_facturas (transferencia_id, factura_id, monto_aplicado)
    VALUES (v_t, v_factura_abril, 120.00);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.transferencias WHERE numero_transaccion = 'DEMO-REV-CONF-004'
  ) THEN
    INSERT INTO public.transferencias (
      admin_id, cuenta_bancaria_id, numero_transaccion, monto, estado,
      revisado_at, created_at
    ) VALUES (
      v_admin, v_cuenta_ficohsa, 'DEMO-REV-CONF-004', 80.00, 'confirmada',
      TIMEZONE('utc', NOW()) - INTERVAL '3 days',
      TIMEZONE('utc', NOW()) - INTERVAL '4 days'
    )
    RETURNING id INTO v_t;

    INSERT INTO public.transferencia_facturas (transferencia_id, factura_id, monto_aplicado)
    VALUES (v_t, v_factura_abril, 80.00);
  END IF;

  UPDATE public.facturas_mensuales
  SET
    estado_pago = 'pagado',
    fecha_pago = COALESCE(fecha_pago, TIMEZONE('utc', NOW()) - INTERVAL '3 days'),
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = v_factura_abril;

  -- -------------------------------------------------------------------------
  -- Solicitudes de reembolso pendientes (tab Por revisar — badge rojo)
  -- -------------------------------------------------------------------------

  SELECT id INTO v_t FROM public.transferencias WHERE numero_transaccion = 'DEMO-REV-CONF-001' LIMIT 1;
  IF v_t IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.solicitudes_reembolso
    WHERE transferencia_id = v_t AND estado = 'pendiente'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.solicitudes_reembolso sr
    WHERE sr.transferencia_id = v_t AND sr.motivo LIKE 'Transferencia duplicada%'
  ) THEN
    INSERT INTO public.solicitudes_reembolso (
      transferencia_id, admin_id, monto, motivo, estado, created_at
    ) VALUES (
      v_t, v_admin, 200.00,
      'Transferencia duplicada: reporté el mismo pago dos veces por error.',
      'pendiente',
      TIMEZONE('utc', NOW()) - INTERVAL '18 hours'
    );
  END IF;

  SELECT id INTO v_t FROM public.transferencias WHERE numero_transaccion = 'DEMO-REV-CONF-002' LIMIT 1;
  IF v_t IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.solicitudes_reembolso
    WHERE transferencia_id = v_t AND estado = 'pendiente'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.solicitudes_reembolso sr
    WHERE sr.transferencia_id = v_t AND sr.motivo LIKE 'Monto incorrecto%'
  ) THEN
    INSERT INTO public.solicitudes_reembolso (
      transferencia_id, admin_id, monto, motivo, estado, created_at
    ) VALUES (
      v_t, v_admin, 100.00,
      'Monto incorrecto: debía ser L 100 pero transferí L 200.',
      'pendiente',
      TIMEZONE('utc', NOW()) - INTERVAL '4 hours'
    );
  END IF;

  PERFORM public.sincronizar_visibilidad_complejos_admin(v_admin);

  RAISE NOTICE 'OK seed revisión pagos para %', v_email_admin;
  RAISE NOTICE '  Por revisar: 3 pagos pendientes + 2 solicitudes de reembolso';
  RAISE NOTICE '  Reembolso directo: 2 transferencias confirmadas (CONF-003, CONF-004)';
  RAISE NOTICE '  Factura en revisión: %/%', v_mes_pagar, v_año_pagar;
END $$;

-- Verificar cola "Por revisar":
-- SELECT 'pago' AS tipo, t.numero_transaccion, t.monto, t.estado, t.created_at
-- FROM public.transferencias t
-- WHERE t.numero_transaccion LIKE 'DEMO-REV-PEND-%'
-- UNION ALL
-- SELECT 'reembolso', t.numero_transaccion, sr.monto, sr.estado, sr.created_at
-- FROM public.solicitudes_reembolso sr
-- JOIN public.transferencias t ON t.id = sr.transferencia_id
-- WHERE sr.estado = 'pendiente'
-- ORDER BY created_at;

-- Verificar reembolso directo:
-- SELECT numero_transaccion, monto, estado FROM public.transferencias
-- WHERE numero_transaccion LIKE 'DEMO-REV-CONF-%' AND estado = 'confirmada'
-- ORDER BY revisado_at DESC;
