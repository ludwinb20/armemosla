-- Políticas de pago: mora 3% diaria, complejos ocultos por impago
-- Ejecutar después de 31_factura_descuentos_canje.sql

-- Complejos ocultos por mora (independiente de activo manual del admin)
ALTER TABLE public.complejos
  ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_complejos_oculto ON public.complejos(oculto);

-- Mora en facturas
ALTER TABLE public.facturas_mensuales
  ADD COLUMN IF NOT EXISTS dias_retraso INTEGER NOT NULL DEFAULT 0 CHECK (dias_retraso >= 0);

ALTER TABLE public.facturas_mensuales
  ADD COLUMN IF NOT EXISTS monto_mora DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (monto_mora >= 0);

-- Ampliar estados: pendiente | pagado | retrasado (vencido queda obsoleto)
ALTER TABLE public.facturas_mensuales
  DROP CONSTRAINT IF EXISTS facturas_mensuales_estado_pago_check;

UPDATE public.facturas_mensuales
SET estado_pago = 'retrasado'
WHERE estado_pago = 'vencido';

ALTER TABLE public.facturas_mensuales
  ADD CONSTRAINT facturas_mensuales_estado_pago_check
  CHECK (estado_pago IN ('pendiente', 'pagado', 'retrasado'));

COMMENT ON COLUMN public.complejos.oculto IS
  'Oculto por impago de factura: no visible para jugadores en búsqueda/reservas';
COMMENT ON COLUMN public.facturas_mensuales.dias_retraso IS
  'Días calendario después del día 20 del mes de pago sin abonar';
COMMENT ON COLUMN public.facturas_mensuales.monto_mora IS
  'Recargo del 3% de comision_neta por cada día de retraso';

-- Fecha en que la factura del mes M puede pagarse (día 1 del mes M+1)
CREATE OR REPLACE FUNCTION public.fecha_disponible_pago_factura(p_mes INTEGER, p_año INTEGER)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (DATE_TRUNC('month', MAKE_DATE(p_año, p_mes, 1)) + INTERVAL '1 month')::TIMESTAMPTZ;
$$;

-- Fecha en que se ocultan complejos si sigue impaga (día 1 del mes M+2)
CREATE OR REPLACE FUNCTION public.fecha_ocultar_complejos_factura(p_mes INTEGER, p_año INTEGER)
RETURNS TIMESTAMPTZ
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (DATE_TRUNC('month', MAKE_DATE(p_año, p_mes, 1)) + INTERVAL '2 months')::TIMESTAMPTZ;
$$;

CREATE OR REPLACE FUNCTION public.sincronizar_visibilidad_complejos_admin(p_admin_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debe_ocultar BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.facturas_mensuales f
    WHERE f.admin_id = p_admin_id
      AND f.fecha_pago IS NULL
      AND f.estado_pago <> 'pagado'
      AND TIMEZONE('utc'::text, NOW()) >= public.fecha_ocultar_complejos_factura(f.mes, f.año)
  )
  INTO v_debe_ocultar;

  UPDATE public.complejos
  SET oculto = v_debe_ocultar,
      updated_at = TIMEZONE('utc'::text, NOW())
  WHERE admin_id = p_admin_id;
END;
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
      v_dias := GREATEST(0, (DATE(v_ahora) - DATE(r.fecha_limite_pago)));
      UPDATE public.facturas_mensuales
      SET
        estado_pago = 'retrasado',
        dias_retraso = v_dias,
        monto_mora = ROUND(v_base * 0.03 * v_dias, 2),
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

  -- Admins con facturas ya pagadas: asegurar visibilidad
  FOR r IN
    SELECT DISTINCT admin_id FROM public.complejos WHERE oculto = true
  LOOP
    PERFORM public.sincronizar_visibilidad_complejos_admin(r.admin_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_factura_pagada(p_factura_id UUID)
RETURNS public.facturas_mensuales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura public.facturas_mensuales;
BEGIN
  UPDATE public.facturas_mensuales
  SET
    estado_pago = 'pagado',
    fecha_pago = TIMEZONE('utc'::text, NOW()),
    dias_retraso = 0,
    monto_mora = 0,
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_factura_id
    AND admin_id = auth.uid()
  RETURNING * INTO v_factura;

  IF v_factura.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada o sin permiso';
  END IF;

  PERFORM public.sincronizar_visibilidad_complejos_admin(v_factura.admin_id);

  RETURN v_factura;
END;
$$;

GRANT EXECUTE ON FUNCTION public.procesar_politicas_pago_facturas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_factura_pagada(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fecha_disponible_pago_factura(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fecha_ocultar_complejos_factura(INTEGER, INTEGER) TO authenticated;

-- Actualizar calcular_factura_mensual para usar estado retrasado
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
      WHEN v_ahora > f.fecha_limite_pago THEN GREATEST(0, (DATE(v_ahora) - DATE(f.fecha_limite_pago)))
      ELSE 0
    END,
    monto_mora = CASE
      WHEN f.fecha_pago IS NOT NULL THEN 0
      WHEN v_ahora > f.fecha_limite_pago THEN ROUND(COALESCE(f.comision_neta, f.comision, 0) * 0.03 * GREATEST(0, (DATE(v_ahora) - DATE(f.fecha_limite_pago))), 2)
      ELSE 0
    END
  WHERE f.id = v_factura_id
    AND f.fecha_pago IS NULL;

  PERFORM public.sincronizar_visibilidad_complejos_admin(p_admin_id);

  RETURN v_factura_id;
END;
$$;

-- RLS jugadores: excluir complejos ocultos por mora
DROP POLICY IF EXISTS "Players can view active complejos" ON public.complejos;
CREATE POLICY "Players can view active complejos"
  ON public.complejos
  FOR SELECT
  USING (
    activo = true
    AND oculto = false
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'Jugador'
    )
  );

DROP POLICY IF EXISTS "Players can view active complejo fotos" ON public.complejo_fotos;
CREATE POLICY "Players can view active complejo fotos"
  ON public.complejo_fotos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.complejos
      INNER JOIN public.profiles ON profiles.id = auth.uid()
      WHERE complejos.id = complejo_fotos.complejo_id
      AND complejos.activo = true
      AND complejos.oculto = false
      AND profiles.user_type = 'Jugador'
    )
  );

DROP POLICY IF EXISTS "Players can view active canchas" ON public.canchas;
CREATE POLICY "Players can view active canchas"
  ON public.canchas
  FOR SELECT
  USING (
    activo = true
    AND EXISTS (
      SELECT 1 FROM public.complejos
      INNER JOIN public.profiles ON profiles.id = auth.uid()
      WHERE complejos.id = canchas.complejo_id
      AND complejos.activo = true
      AND complejos.oculto = false
      AND profiles.user_type = 'Jugador'
    )
  );

DROP POLICY IF EXISTS "Players can view active cancha fotos" ON public.cancha_fotos;
CREATE POLICY "Players can view active cancha fotos"
  ON public.cancha_fotos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      INNER JOIN public.profiles ON profiles.id = auth.uid()
      WHERE canchas.id = cancha_fotos.cancha_id
      AND canchas.activo = true
      AND complejos.activo = true
      AND complejos.oculto = false
      AND profiles.user_type = 'Jugador'
    )
  );

COMMENT ON FUNCTION public.procesar_politicas_pago_facturas IS
  'Recalcula mora 3% diaria, estados retrasado y oculta complejos impagos desde el día 1 del mes M+2';
COMMENT ON FUNCTION public.marcar_factura_pagada IS
  'Marca factura pagada y restaura visibilidad de complejos si corresponde';
