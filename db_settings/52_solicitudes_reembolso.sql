-- Solicitudes de reembolso (admin complejo solicita → plataforma aprueba/rechaza)
-- Ejecutar después de 48_pagos_transferencias.sql

-- Helper interno (sin chequeo de rol; usado por registrar_reembolso y aprobar_solicitud)
CREATE OR REPLACE FUNCTION public.registrar_reembolso_service(
  p_transferencia_id UUID,
  p_monto DECIMAL,
  p_motivo TEXT,
  p_visible_mensaje TEXT,
  p_creado_por UUID
)
RETURNS public.reembolsos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t public.transferencias;
  v_reembolso public.reembolsos;
  v_factura_id UUID;
BEGIN
  SELECT * INTO v_t FROM public.transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF v_t.id IS NULL OR v_t.estado <> 'confirmada' THEN
    RAISE EXCEPTION 'Solo se reembolsan transferencias confirmadas';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 OR p_monto > v_t.monto THEN
    RAISE EXCEPTION 'Monto de reembolso inválido';
  END IF;

  INSERT INTO public.reembolsos (transferencia_id, monto, motivo, visible_mensaje, creado_por)
  VALUES (p_transferencia_id, p_monto, TRIM(p_motivo), TRIM(p_visible_mensaje), p_creado_por)
  RETURNING * INTO v_reembolso;

  UPDATE public.transferencias
  SET estado = 'reembolsada', updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_transferencia_id;

  SELECT tf.factura_id INTO v_factura_id
  FROM public.transferencia_facturas tf WHERE tf.transferencia_id = p_transferencia_id LIMIT 1;

  UPDATE public.facturas_mensuales
  SET
    estado_pago = CASE
      WHEN public.monto_confirmado_factura(v_factura_id) >= public.monto_total_factura(v_factura_id) THEN 'pagado'
      ELSE 'en_revision'
    END,
    fecha_pago = CASE
      WHEN public.monto_confirmado_factura(v_factura_id) >= public.monto_total_factura(v_factura_id)
      THEN fecha_pago
      ELSE NULL
    END,
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = v_factura_id
    AND public.monto_confirmado_factura(v_factura_id) < public.monto_total_factura(v_factura_id);

  IF public.monto_confirmado_factura(v_factura_id) < public.monto_total_factura(v_factura_id) THEN
    UPDATE public.facturas_mensuales
    SET estado_pago = 'en_revision', fecha_pago = NULL, updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_factura_id AND estado_pago = 'pagado';
  END IF;

  PERFORM public.sincronizar_visibilidad_complejos_admin(v_t.admin_id);
  RETURN v_reembolso;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_reembolso(
  p_transferencia_id UUID,
  p_monto DECIMAL,
  p_motivo TEXT,
  p_visible_mensaje TEXT
)
RETURNS public.reembolsos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.es_admin_plataforma() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN public.registrar_reembolso_service(
    p_transferencia_id, p_monto, p_motivo, p_visible_mensaje, auth.uid()
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.solicitudes_reembolso (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transferencia_id UUID NOT NULL REFERENCES public.transferencias(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monto DECIMAL(10, 2) NOT NULL CHECK (monto > 0),
  motivo TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (
    estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')
  ),
  respuesta_plataforma TEXT,
  reembolso_id UUID REFERENCES public.reembolsos(id),
  revisado_por UUID REFERENCES auth.users(id),
  revisado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitudes_reembolso_pendiente_transferencia
  ON public.solicitudes_reembolso (transferencia_id)
  WHERE estado = 'pendiente';

CREATE INDEX IF NOT EXISTS idx_solicitudes_reembolso_admin ON public.solicitudes_reembolso(admin_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_reembolso_estado ON public.solicitudes_reembolso(estado);

DROP TRIGGER IF EXISTS set_solicitudes_reembolso_updated_at ON public.solicitudes_reembolso;
CREATE TRIGGER set_solicitudes_reembolso_updated_at
  BEFORE UPDATE ON public.solicitudes_reembolso
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.solicitudes_reembolso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin complejo ve sus solicitudes reembolso"
  ON public.solicitudes_reembolso FOR SELECT
  USING (auth.uid() = admin_id OR public.es_admin_plataforma());

CREATE POLICY "Admin complejo crea solicitudes reembolso"
  ON public.solicitudes_reembolso FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Admin complejo cancela solicitud pendiente propia"
  ON public.solicitudes_reembolso FOR UPDATE
  USING (auth.uid() = admin_id AND estado = 'pendiente')
  WITH CHECK (auth.uid() = admin_id AND estado = 'cancelada');

CREATE OR REPLACE FUNCTION public.solicitar_reembolso(
  p_transferencia_id UUID,
  p_monto DECIMAL,
  p_motivo TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t public.transferencias;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_t FROM public.transferencias WHERE id = p_transferencia_id;
  IF v_t.id IS NULL OR v_t.admin_id <> auth.uid() THEN
    RAISE EXCEPTION 'Transferencia no encontrada';
  END IF;

  IF v_t.estado <> 'confirmada' THEN
    RAISE EXCEPTION 'Solo podés solicitar reembolso de transferencias confirmadas';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 OR p_monto > v_t.monto THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  IF TRIM(p_motivo) = '' THEN
    RAISE EXCEPTION 'Indicá el motivo del reembolso';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.solicitudes_reembolso
    WHERE transferencia_id = p_transferencia_id AND estado = 'pendiente'
  ) THEN
    RAISE EXCEPTION 'Ya hay una solicitud de reembolso pendiente para esta transferencia';
  END IF;

  INSERT INTO public.solicitudes_reembolso (transferencia_id, admin_id, monto, motivo, estado)
  VALUES (p_transferencia_id, auth.uid(), p_monto, TRIM(p_motivo), 'pendiente')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.aprobar_solicitud_reembolso(
  p_solicitud_id UUID,
  p_visible_mensaje TEXT
)
RETURNS public.solicitudes_reembolso
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s public.solicitudes_reembolso;
  v_reembolso public.reembolsos;
BEGIN
  IF NOT public.es_admin_plataforma() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_s FROM public.solicitudes_reembolso WHERE id = p_solicitud_id FOR UPDATE;
  IF v_s.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud no está pendiente';
  END IF;

  IF TRIM(p_visible_mensaje) = '' THEN
    RAISE EXCEPTION 'Indicá el mensaje visible para el admin del complejo';
  END IF;

  v_reembolso := public.registrar_reembolso_service(
    v_s.transferencia_id,
    v_s.monto,
    v_s.motivo,
    TRIM(p_visible_mensaje),
    auth.uid()
  );

  UPDATE public.solicitudes_reembolso
  SET
    estado = 'aprobada',
    respuesta_plataforma = TRIM(p_visible_mensaje),
    reembolso_id = v_reembolso.id,
    revisado_por = auth.uid(),
    revisado_at = TIMEZONE('utc'::text, NOW()),
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_solicitud_id
  RETURNING * INTO v_s;

  RETURN v_s;
END;
$$;

CREATE OR REPLACE FUNCTION public.rechazar_solicitud_reembolso(
  p_solicitud_id UUID,
  p_respuesta TEXT
)
RETURNS public.solicitudes_reembolso
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s public.solicitudes_reembolso;
BEGIN
  IF NOT public.es_admin_plataforma() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_s FROM public.solicitudes_reembolso WHERE id = p_solicitud_id FOR UPDATE;
  IF v_s.estado <> 'pendiente' THEN
    RAISE EXCEPTION 'La solicitud no está pendiente';
  END IF;

  IF TRIM(p_respuesta) = '' THEN
    RAISE EXCEPTION 'Indicá el motivo del rechazo';
  END IF;

  UPDATE public.solicitudes_reembolso
  SET
    estado = 'rechazada',
    respuesta_plataforma = TRIM(p_respuesta),
    revisado_por = auth.uid(),
    revisado_at = TIMEZONE('utc'::text, NOW()),
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_solicitud_id
  RETURNING * INTO v_s;

  RETURN v_s;
END;
$$;

GRANT EXECUTE ON FUNCTION public.solicitar_reembolso(UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aprobar_solicitud_reembolso(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rechazar_solicitud_reembolso(UUID, TEXT) TO authenticated;

COMMENT ON TABLE public.solicitudes_reembolso IS
  'Solicitudes de reembolso del admin complejo; la plataforma aprueba y ejecuta el reembolso bancario manual';
