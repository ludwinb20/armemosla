-- Descuentos por canjes de recompensas en factura mensual
-- Ejecutar después de 30_logros_recompensas.sql

ALTER TABLE public.facturas_mensuales
  ADD COLUMN IF NOT EXISTS total_descuentos_canje DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (total_descuentos_canje >= 0);

ALTER TABLE public.facturas_mensuales
  ADD COLUMN IF NOT EXISTS comision_neta DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (comision_neta >= 0);

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

  UPDATE public.facturas_mensuales
  SET estado_pago = CASE
    WHEN fecha_pago IS NOT NULL THEN 'pagado'
    WHEN TIMEZONE('utc'::text, NOW()) > fecha_limite_pago THEN 'vencido'
    ELSE 'pendiente'
  END
  WHERE id = v_factura_id;

  RETURN v_factura_id;
END;
$$;

COMMENT ON COLUMN public.facturas_mensuales.total_descuentos_canje IS
  'Suma de montos descontados por canjes de recompensas en el mes';
COMMENT ON COLUMN public.facturas_mensuales.comision_neta IS
  'Comisión 10% menos descuentos por canjes de recompensas';
