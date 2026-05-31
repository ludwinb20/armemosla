-- Tope de mora: solo acumula hasta el día 1 del mes M+2 (mismo día en que se ocultan complejos).
-- A partir de esa fecha el monto queda congelado y los complejos dejan de aparecer en búsqueda.
-- Ejecutar después de 40_pagos_mora_complejos_ocultos.sql

COMMENT ON COLUMN public.facturas_mensuales.dias_retraso IS
  'Días de mora acumulados (máx. desde el día 21 del mes de pago hasta el último día de ese mes)';
COMMENT ON COLUMN public.facturas_mensuales.monto_mora IS
  'Recargo 3% de comision_neta por día de mora; no aumenta después del día 1 del mes M+2';

CREATE OR REPLACE FUNCTION public.calcular_dias_mora_factura(
  p_mes INTEGER,
  p_año INTEGER,
  p_fecha_limite TIMESTAMPTZ,
  p_ahora TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_ahora <= p_fecha_limite THEN 0
    ELSE GREATEST(
      0,
      (
        LEAST(
          DATE(p_ahora),
          DATE(public.fecha_ocultar_complejos_factura(p_mes, p_año)) - 1
        ) - DATE(p_fecha_limite)
      )::INTEGER
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_monto_mora_factura(
  p_mes INTEGER,
  p_año INTEGER,
  p_fecha_limite TIMESTAMPTZ,
  p_comision_base DECIMAL,
  p_ahora TIMESTAMPTZ
)
RETURNS DECIMAL(10, 2)
LANGUAGE sql
STABLE
AS $$
  SELECT ROUND(
    COALESCE(p_comision_base, 0) * 0.03
      * public.calcular_dias_mora_factura(p_mes, p_año, p_fecha_limite, p_ahora),
    2
  );
$$;

CREATE OR REPLACE FUNCTION public.procesar_politicas_pago_facturas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_ahora TIMESTAMPTZ := TIMEZONE('utc'::text, NOW());
  v_dias INTEGER;
  v_base DECIMAL(10, 2);
BEGIN
  FOR r IN
    SELECT id, admin_id, mes, año, comision_neta, comision, fecha_limite_pago, fecha_pago, estado_pago
    FROM public.facturas_mensuales
    WHERE fecha_pago IS NULL
      AND estado_pago <> 'pagado'
  LOOP
    v_base := COALESCE(r.comision_neta, r.comision, 0);

    IF v_ahora > r.fecha_limite_pago THEN
      v_dias := public.calcular_dias_mora_factura(r.mes, r.año, r.fecha_limite_pago, v_ahora);
      UPDATE public.facturas_mensuales
      SET
        estado_pago = 'retrasado',
        dias_retraso = v_dias,
        monto_mora = public.calcular_monto_mora_factura(
          r.mes, r.año, r.fecha_limite_pago, v_base, v_ahora
        ),
        updated_at = v_ahora
      WHERE id = r.id;
    ELSIF v_ahora >= public.fecha_disponible_pago_factura(r.mes, r.año) THEN
      UPDATE public.facturas_mensuales
      SET
        estado_pago = 'pendiente',
        dias_retraso = 0,
        monto_mora = 0,
        updated_at = v_ahora
      WHERE id = r.id
        AND estado_pago <> 'pendiente';
    END IF;

    PERFORM public.sincronizar_visibilidad_complejos_admin(r.admin_id);
  END LOOP;

  FOR r IN
    SELECT DISTINCT admin_id FROM public.complejos WHERE oculto = true
  LOOP
    PERFORM public.sincronizar_visibilidad_complejos_admin(r.admin_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_factura_mensual(
  p_admin_id UUID,
  p_mes INTEGER,
  p_año INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura_id UUID;
  v_total_facturado DECIMAL(10, 2) := 0;
  v_comision DECIMAL(10, 2) := 0;
  v_descuentos DECIMAL(10, 2) := 0;
  v_comision_neta DECIMAL(10, 2) := 0;
  v_fecha_limite TIMESTAMP WITH TIME ZONE;
  v_inicio_mes TIMESTAMP WITH TIME ZONE;
  v_fin_mes TIMESTAMP WITH TIME ZONE;
  v_ahora TIMESTAMPTZ := TIMEZONE('utc'::text, NOW());
BEGIN
  v_inicio_mes := DATE_TRUNC('month', MAKE_DATE(p_año, p_mes, 1));
  v_fin_mes := (DATE_TRUNC('month', MAKE_DATE(p_año, p_mes, 1)) + INTERVAL '1 month - 1 day')::DATE
    + INTERVAL '23 hours 59 minutes 59 seconds';

  v_fecha_limite := (DATE_TRUNC('month', MAKE_DATE(p_año, p_mes, 1)) + INTERVAL '1 month' + INTERVAL '19 days')::DATE
    + INTERVAL '23 hours 59 minutes 59 seconds';

  SELECT COALESCE(SUM(canchas.precio_por_hora), 0)
  INTO v_total_facturado
  FROM public.reservas
  INNER JOIN public.canchas ON canchas.id = reservas.cancha_id
  INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
  WHERE complejos.admin_id = p_admin_id
    AND reservas.estado = 'completada'
    AND reservas.fecha_hora >= v_inicio_mes
    AND reservas.fecha_hora <= v_fin_mes;

  v_comision := v_total_facturado * 0.10;

  SELECT COALESCE(SUM(cr.monto_descontado), 0)
  INTO v_descuentos
  FROM public.canjes_recompensa cr
  WHERE cr.admin_id = p_admin_id
    AND cr.created_at >= v_inicio_mes
    AND cr.created_at <= v_fin_mes;

  v_comision_neta := GREATEST(v_comision - v_descuentos, 0);

  INSERT INTO public.facturas_mensuales (
    admin_id, mes, año, total_facturado, comision,
    total_descuentos_canje, comision_neta, fecha_limite_pago
  )
  VALUES (
    p_admin_id, p_mes, p_año, v_total_facturado, v_comision,
    v_descuentos, v_comision_neta, v_fecha_limite
  )
  ON CONFLICT (admin_id, mes, año)
  DO UPDATE SET
    total_facturado = EXCLUDED.total_facturado,
    comision = EXCLUDED.comision,
    total_descuentos_canje = EXCLUDED.total_descuentos_canje,
    comision_neta = EXCLUDED.comision_neta,
    updated_at = TIMEZONE('utc'::text, NOW())
  RETURNING id INTO v_factura_id;

  DELETE FROM public.factura_detalle_cancha WHERE factura_id = v_factura_id;

  INSERT INTO public.factura_detalle_cancha (
    factura_id, cancha_id, total_reservas, total_facturado, comision
  )
  SELECT
    v_factura_id,
    canchas.id,
    COUNT(reservas.id)::INTEGER,
    COALESCE(SUM(canchas.precio_por_hora), 0),
    COALESCE(SUM(canchas.precio_por_hora), 0) * 0.10
  FROM public.canchas
  INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
  LEFT JOIN public.reservas ON reservas.cancha_id = canchas.id
    AND reservas.estado = 'completada'
    AND reservas.fecha_hora >= v_inicio_mes
    AND reservas.fecha_hora <= v_fin_mes
  WHERE complejos.admin_id = p_admin_id
  GROUP BY canchas.id
  HAVING COUNT(reservas.id) > 0;

  UPDATE public.facturas_mensuales f
  SET
    estado_pago = CASE
      WHEN f.fecha_pago IS NOT NULL THEN 'pagado'
      WHEN v_ahora > f.fecha_limite_pago THEN 'retrasado'
      ELSE 'pendiente'
    END,
    dias_retraso = CASE
      WHEN f.fecha_pago IS NOT NULL THEN 0
      WHEN v_ahora > f.fecha_limite_pago THEN public.calcular_dias_mora_factura(
        p_mes, p_año, f.fecha_limite_pago, v_ahora
      )
      ELSE 0
    END,
    monto_mora = CASE
      WHEN f.fecha_pago IS NOT NULL THEN 0
      WHEN v_ahora > f.fecha_limite_pago THEN public.calcular_monto_mora_factura(
        p_mes, p_año, f.fecha_limite_pago, COALESCE(f.comision_neta, f.comision, 0), v_ahora
      )
      ELSE 0
    END
  WHERE f.id = v_factura_id
    AND f.fecha_pago IS NULL;

  PERFORM public.sincronizar_visibilidad_complejos_admin(p_admin_id);

  RETURN v_factura_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calcular_dias_mora_factura(INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_monto_mora_factura(INTEGER, INTEGER, TIMESTAMPTZ, DECIMAL, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.procesar_politicas_pago_facturas IS
  'Recalcula mora (3% diaria, tope al día 1 del mes M+2), estados retrasado y oculta complejos impagos desde esa fecha';

-- Recalcular facturas impagas con el nuevo tope
SELECT public.procesar_politicas_pago_facturas();
