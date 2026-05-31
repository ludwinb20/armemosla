-- Corrige fecha_limite_pago errónea (p. ej. fin de mes) y mora en 0.
-- La mora usa siempre el día 20 del mes M+1 (canónico), no la fecha guardada en la fila.
-- Ejecutar después de 44_mora_base_comision_fix.sql

CREATE OR REPLACE FUNCTION public.fecha_limite_pago_factura(p_mes INTEGER, p_año INTEGER)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    (DATE_TRUNC('month', MAKE_DATE(p_año, p_mes, 1)) + INTERVAL '1 month' + INTERVAL '19 days')::DATE
    + INTERVAL '23 hours 59 minutes 59 seconds'
  )::TIMESTAMPTZ;
$$;

-- Reemplaza versión que dependía de fecha_limite_pago de la fila (podía ser fin de mes).
DROP FUNCTION IF EXISTS public.calcular_dias_mora_factura(INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.calcular_dias_mora_factura(
  p_mes INTEGER,
  p_año INTEGER,
  p_ahora TIMESTAMPTZ
)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_ahora <= public.fecha_limite_pago_factura(p_mes, p_año) THEN 0
    ELSE GREATEST(
      0,
      (
        LEAST(
          DATE(p_ahora),
          DATE(public.fecha_ocultar_complejos_factura(p_mes, p_año)) - 1
        ) - DATE(public.fecha_limite_pago_factura(p_mes, p_año))
      )::INTEGER
    )
  END;
$$;

DROP FUNCTION IF EXISTS public.calcular_monto_mora_factura(INTEGER, INTEGER, TIMESTAMPTZ, DECIMAL, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.calcular_monto_mora_factura(
  p_mes INTEGER,
  p_año INTEGER,
  p_comision_base DECIMAL,
  p_ahora TIMESTAMPTZ
)
RETURNS DECIMAL(10, 2)
LANGUAGE sql
STABLE
AS $$
  SELECT ROUND(
    COALESCE(p_comision_base, 0) * 0.03
      * public.calcular_dias_mora_factura(p_mes, p_año, p_ahora),
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
  v_limite TIMESTAMPTZ;
  v_dias INTEGER;
  v_base DECIMAL(10, 2);
BEGIN
  FOR r IN
    SELECT id, admin_id, mes, año, comision, comision_neta, total_descuentos_canje,
           fecha_pago, estado_pago
    FROM public.facturas_mensuales
    WHERE fecha_pago IS NULL
      AND estado_pago <> 'pagado'
  LOOP
    v_limite := public.fecha_limite_pago_factura(r.mes, r.año);
    v_base := public.comision_base_factura(r.comision, r.comision_neta, r.total_descuentos_canje);

    IF v_ahora > v_limite THEN
      v_dias := public.calcular_dias_mora_factura(r.mes, r.año, v_ahora);
      UPDATE public.facturas_mensuales
      SET
        fecha_limite_pago = v_limite,
        estado_pago = 'retrasado',
        dias_retraso = v_dias,
        monto_mora = public.calcular_monto_mora_factura(r.mes, r.año, v_base, v_ahora),
        updated_at = v_ahora
      WHERE id = r.id;
    ELSIF v_ahora >= public.fecha_disponible_pago_factura(r.mes, r.año) THEN
      UPDATE public.facturas_mensuales
      SET
        fecha_limite_pago = v_limite,
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
  v_fecha_limite TIMESTAMPTZ;
  v_inicio_mes TIMESTAMP WITH TIME ZONE;
  v_fin_mes TIMESTAMP WITH TIME ZONE;
  v_ahora TIMESTAMPTZ := TIMEZONE('utc'::text, NOW());
BEGIN
  v_fecha_limite := public.fecha_limite_pago_factura(p_mes, p_año);

  v_inicio_mes := DATE_TRUNC('month', MAKE_DATE(p_año, p_mes, 1));
  v_fin_mes := (DATE_TRUNC('month', MAKE_DATE(p_año, p_mes, 1)) + INTERVAL '1 month - 1 day')::DATE
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
    fecha_limite_pago = EXCLUDED.fecha_limite_pago,
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
      WHEN v_ahora > v_fecha_limite THEN 'retrasado'
      ELSE 'pendiente'
    END,
    dias_retraso = CASE
      WHEN f.fecha_pago IS NOT NULL THEN 0
      WHEN v_ahora > v_fecha_limite THEN public.calcular_dias_mora_factura(p_mes, p_año, v_ahora)
      ELSE 0
    END,
    monto_mora = CASE
      WHEN f.fecha_pago IS NOT NULL THEN 0
      WHEN v_ahora > v_fecha_limite THEN public.calcular_monto_mora_factura(
        p_mes, p_año, v_comision_neta, v_ahora
      )
      ELSE 0
    END
  WHERE f.id = v_factura_id
    AND f.fecha_pago IS NULL;

  PERFORM public.sincronizar_visibilidad_complejos_admin(p_admin_id);

  RETURN v_factura_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fecha_limite_pago_factura(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_dias_mora_factura(INTEGER, INTEGER, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calcular_monto_mora_factura(INTEGER, INTEGER, DECIMAL, TIMESTAMPTZ) TO authenticated;

-- Corregir fechas límite guardadas (p. ej. 28 feb en lugar de 20 feb)
UPDATE public.facturas_mensuales
SET fecha_limite_pago = public.fecha_limite_pago_factura(mes, año);

SELECT public.procesar_politicas_pago_facturas();
