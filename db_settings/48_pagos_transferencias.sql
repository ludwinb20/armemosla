-- Pagos por transferencia bancaria + Admin Plataforma
-- Ejecutar después de 47_pagos_pixelpay.sql

-- ---------------------------------------------------------------------------
-- Rol Admin Plataforma (solo asignable vía SQL)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS es_admin_plataforma BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.es_admin_plataforma IS
  'Operador Armemosla. Solo asignable manualmente en SQL; no configurable desde la app.';

CREATE OR REPLACE FUNCTION public.es_admin_plataforma()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT es_admin_plataforma FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.es_admin_plataforma() TO authenticated;

-- ---------------------------------------------------------------------------
-- Estado de pago: agregar en_revision
-- ---------------------------------------------------------------------------
ALTER TABLE public.facturas_mensuales
  DROP CONSTRAINT IF EXISTS facturas_mensuales_estado_pago_check;

ALTER TABLE public.facturas_mensuales
  ADD CONSTRAINT facturas_mensuales_estado_pago_check
  CHECK (estado_pago IN ('pendiente', 'pagado', 'retrasado', 'en_revision'));

-- ---------------------------------------------------------------------------
-- Cuentas bancarias Armemosla
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cuentas_bancarias_armemosla (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  banco_nombre TEXT NOT NULL,
  logo_url TEXT,
  numero_cuenta TEXT NOT NULL,
  titular TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

DROP TRIGGER IF EXISTS set_cuentas_bancarias_updated_at ON public.cuentas_bancarias_armemosla;
CREATE TRIGGER set_cuentas_bancarias_updated_at
  BEFORE UPDATE ON public.cuentas_bancarias_armemosla
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.cuentas_bancarias_armemosla ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins complejo ven cuentas activas"
  ON public.cuentas_bancarias_armemosla FOR SELECT
  USING (activo = true OR public.es_admin_plataforma());

CREATE POLICY "Admin plataforma gestiona cuentas"
  ON public.cuentas_bancarias_armemosla FOR ALL
  USING (public.es_admin_plataforma())
  WITH CHECK (public.es_admin_plataforma());

-- ---------------------------------------------------------------------------
-- Emisor fiscal (Armemosla)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emisor_fiscal_config (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  razon_social TEXT NOT NULL,
  rtn TEXT NOT NULL,
  cai TEXT NOT NULL,
  fecha_emision DATE NOT NULL,
  fecha_limite_emision DATE NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.emisor_fiscal_correlativo (
  emisor_fiscal_id UUID PRIMARY KEY REFERENCES public.emisor_fiscal_config(id) ON DELETE CASCADE,
  ultimo_numero INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.emisor_fiscal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emisor_fiscal_correlativo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura emisor fiscal autenticados"
  ON public.emisor_fiscal_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin plataforma emisor fiscal"
  ON public.emisor_fiscal_config FOR ALL
  USING (public.es_admin_plataforma())
  WITH CHECK (public.es_admin_plataforma());

CREATE POLICY "Lectura correlativo autenticados"
  ON public.emisor_fiscal_correlativo FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- Datos fiscales cliente (admin complejo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.datos_fiscales_cliente (
  admin_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  razon_social TEXT NOT NULL,
  rtn TEXT NOT NULL,
  direccion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

DROP TRIGGER IF EXISTS set_datos_fiscales_cliente_updated_at ON public.datos_fiscales_cliente;
CREATE TRIGGER set_datos_fiscales_cliente_updated_at
  BEFORE UPDATE ON public.datos_fiscales_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.datos_fiscales_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin complejo ve y edita sus datos fiscales"
  ON public.datos_fiscales_cliente FOR SELECT
  USING (auth.uid() = admin_id OR public.es_admin_plataforma());

CREATE POLICY "Admin complejo inserta datos fiscales"
  ON public.datos_fiscales_cliente FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Admin complejo actualiza datos fiscales"
  ON public.datos_fiscales_cliente FOR UPDATE
  USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

-- ---------------------------------------------------------------------------
-- Transferencias
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transferencias (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cuenta_bancaria_id UUID NOT NULL REFERENCES public.cuentas_bancarias_armemosla(id),
  numero_transaccion TEXT NOT NULL,
  monto DECIMAL(10, 2) NOT NULL CHECK (monto > 0),
  estado TEXT NOT NULL DEFAULT 'pendiente_revision' CHECK (
    estado IN ('pendiente_revision', 'confirmada', 'rechazada', 'reembolsada')
  ),
  solicita_factura_rtn BOOLEAN NOT NULL DEFAULT false,
  notas_admin TEXT,
  revisado_por UUID REFERENCES auth.users(id),
  revisado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.transferencia_facturas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transferencia_id UUID NOT NULL REFERENCES public.transferencias(id) ON DELETE CASCADE,
  factura_id UUID NOT NULL REFERENCES public.facturas_mensuales(id) ON DELETE CASCADE,
  monto_aplicado DECIMAL(10, 2) NOT NULL CHECK (monto_aplicado > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE (transferencia_id, factura_id)
);

CREATE TABLE IF NOT EXISTS public.reembolsos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transferencia_id UUID NOT NULL REFERENCES public.transferencias(id) ON DELETE CASCADE,
  monto DECIMAL(10, 2) NOT NULL CHECK (monto > 0),
  motivo TEXT NOT NULL,
  visible_mensaje TEXT NOT NULL,
  creado_por UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.facturas_fiscales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  factura_id UUID NOT NULL UNIQUE REFERENCES public.facturas_mensuales(id) ON DELETE CASCADE,
  emisor_fiscal_id UUID NOT NULL REFERENCES public.emisor_fiscal_config(id),
  transferencia_id UUID REFERENCES public.transferencias(id),
  numero_fiscal TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_transferencias_admin ON public.transferencias(admin_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_estado ON public.transferencias(estado);
CREATE INDEX IF NOT EXISTS idx_transferencia_facturas_factura ON public.transferencia_facturas(factura_id);

DROP TRIGGER IF EXISTS set_transferencias_updated_at ON public.transferencias;
CREATE TRIGGER set_transferencias_updated_at
  BEFORE UPDATE ON public.transferencias
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transferencia_facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reembolsos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas_fiscales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin complejo ve sus transferencias"
  ON public.transferencias FOR SELECT
  USING (auth.uid() = admin_id OR public.es_admin_plataforma());

CREATE POLICY "Admin plataforma actualiza transferencias"
  ON public.transferencias FOR UPDATE
  USING (public.es_admin_plataforma());

CREATE POLICY "Admin complejo ve sus transferencia_facturas"
  ON public.transferencia_facturas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transferencias t
      WHERE t.id = transferencia_facturas.transferencia_id
        AND (t.admin_id = auth.uid() OR public.es_admin_plataforma())
    )
  );

CREATE POLICY "Admin complejo ve sus reembolsos"
  ON public.reembolsos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.transferencias t
      WHERE t.id = reembolsos.transferencia_id
        AND (t.admin_id = auth.uid() OR public.es_admin_plataforma())
    )
  );

CREATE POLICY "Admin complejo ve sus facturas fiscales"
  ON public.facturas_fiscales FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.facturas_mensuales f
      WHERE f.id = facturas_fiscales.factura_id
        AND (f.admin_id = auth.uid() OR public.es_admin_plataforma())
    )
  );

-- ---------------------------------------------------------------------------
-- Push tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE (user_id, expo_push_token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario gestiona sus push tokens"
  ON public.push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Helpers montos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.monto_total_factura(p_factura_id UUID)
RETURNS DECIMAL(10, 2)
LANGUAGE sql
STABLE
AS $$
  SELECT ROUND(
    COALESCE(f.comision_neta, f.comision, 0) + COALESCE(f.monto_mora, 0),
    2
  )
  FROM public.facturas_mensuales f
  WHERE f.id = p_factura_id;
$$;

CREATE OR REPLACE FUNCTION public.monto_confirmado_factura(p_factura_id UUID)
RETURNS DECIMAL(10, 2)
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(tf.monto_aplicado), 0)
  FROM public.transferencia_facturas tf
  INNER JOIN public.transferencias t ON t.id = tf.transferencia_id
  WHERE tf.factura_id = p_factura_id
    AND t.estado = 'confirmada';
$$;

CREATE OR REPLACE FUNCTION public.monto_pendiente_factura(p_factura_id UUID)
RETURNS DECIMAL(10, 2)
LANGUAGE sql
STABLE
AS $$
  SELECT GREATEST(
    public.monto_total_factura(p_factura_id) - public.monto_confirmado_factura(p_factura_id),
    0
  );
$$;

GRANT EXECUTE ON FUNCTION public.monto_total_factura(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.monto_confirmado_factura(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.monto_pendiente_factura(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Parche ocultamiento: en_revision no oculta complejos
-- ---------------------------------------------------------------------------
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
      AND f.estado_pago NOT IN ('pagado', 'en_revision')
      AND TIMEZONE('utc'::text, NOW()) >= public.fecha_ocultar_complejos_factura(f.mes, f.año)
  )
  INTO v_debe_ocultar;

  UPDATE public.complejos
  SET oculto = v_debe_ocultar,
      updated_at = TIMEZONE('utc'::text, NOW())
  WHERE admin_id = p_admin_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Parche mora: en_revision excluida
-- ---------------------------------------------------------------------------
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
      AND estado_pago NOT IN ('pagado', 'en_revision')
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
        AND estado_pago NOT IN ('pendiente', 'en_revision');
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

-- ---------------------------------------------------------------------------
-- Generar factura fiscal (inmutable)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generar_factura_fiscal(
  p_factura_id UUID,
  p_transferencia_id UUID
)
RETURNS public.facturas_fiscales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura public.facturas_mensuales;
  v_emisor public.emisor_fiscal_config;
  v_cliente public.datos_fiscales_cliente;
  v_numero INTEGER;
  v_numero_fiscal TEXT;
  v_total DECIMAL(10, 2);
  v_base DECIMAL(10, 2);
  v_isv DECIMAL(10, 2);
  v_snapshot JSONB;
  v_result public.facturas_fiscales;
BEGIN
  IF EXISTS (SELECT 1 FROM public.facturas_fiscales WHERE factura_id = p_factura_id) THEN
    RAISE EXCEPTION 'Ya existe factura fiscal para esta factura';
  END IF;

  SELECT * INTO v_factura FROM public.facturas_mensuales WHERE id = p_factura_id;
  IF v_factura.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  SELECT * INTO v_cliente FROM public.datos_fiscales_cliente WHERE admin_id = v_factura.admin_id;
  IF v_cliente.admin_id IS NULL THEN
    RAISE EXCEPTION 'El cliente no tiene datos fiscales configurados';
  END IF;

  SELECT * INTO v_emisor
  FROM public.emisor_fiscal_config
  WHERE activo = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_emisor.id IS NULL THEN
    RAISE EXCEPTION 'No hay emisor fiscal activo configurado';
  END IF;

  INSERT INTO public.emisor_fiscal_correlativo (emisor_fiscal_id, ultimo_numero)
  VALUES (v_emisor.id, 0)
  ON CONFLICT (emisor_fiscal_id) DO NOTHING;

  UPDATE public.emisor_fiscal_correlativo
  SET ultimo_numero = ultimo_numero + 1
  WHERE emisor_fiscal_id = v_emisor.id
  RETURNING ultimo_numero INTO v_numero;

  v_numero_fiscal := LPAD(v_numero::TEXT, 8, '0');
  v_total := public.monto_total_factura(p_factura_id);
  v_base := ROUND(v_total / 1.15, 2);
  v_isv := ROUND(v_total - v_base, 2);

  v_snapshot := jsonb_build_object(
    'emisor', jsonb_build_object(
      'razon_social', v_emisor.razon_social,
      'rtn', v_emisor.rtn,
      'cai', v_emisor.cai,
      'fecha_emision', v_emisor.fecha_emision,
      'fecha_limite_emision', v_emisor.fecha_limite_emision
    ),
    'cliente', jsonb_build_object(
      'razon_social', v_cliente.razon_social,
      'rtn', v_cliente.rtn,
      'direccion', v_cliente.direccion
    ),
    'detalle', jsonb_build_array(
      jsonb_build_object(
        'descripcion', 'Comisión por servicios de plataforma Armemosla',
        'cantidad', 1,
        'precio_unitario', v_base,
        'subtotal', v_base,
        'isv', v_isv,
        'total', v_total
      )
    ),
    'totales', jsonb_build_object(
      'subtotal_gravado', v_base,
      'isv_15', v_isv,
      'total', v_total
    ),
    'periodo', jsonb_build_object('mes', v_factura.mes, 'año', v_factura.año),
    'fecha_emision_documento', CURRENT_DATE
  );

  INSERT INTO public.facturas_fiscales (
    factura_id, emisor_fiscal_id, transferencia_id, numero_fiscal, snapshot
  )
  VALUES (p_factura_id, v_emisor.id, p_transferencia_id, v_numero_fiscal, v_snapshot)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: reportar transferencia (admin complejo)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reportar_transferencia(
  p_factura_id UUID,
  p_cuenta_bancaria_id UUID,
  p_numero_transaccion TEXT,
  p_monto DECIMAL,
  p_solicita_factura_rtn BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura public.facturas_mensuales;
  v_transferencia_id UUID;
  v_pendiente DECIMAL(10, 2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_factura
  FROM public.facturas_mensuales
  WHERE id = p_factura_id AND admin_id = auth.uid();

  IF v_factura.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  IF v_factura.estado_pago = 'pagado' OR v_factura.fecha_pago IS NOT NULL THEN
    RAISE EXCEPTION 'Esta factura ya está pagada';
  END IF;

  IF NOT public.es_factura_pagable_disponible(v_factura.mes, v_factura.año) THEN
    RAISE EXCEPTION 'Esta factura aún no está disponible para pago';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'Monto inválido';
  END IF;

  IF TRIM(p_numero_transaccion) = '' THEN
    RAISE EXCEPTION 'Número de transacción requerido';
  END IF;

  IF p_solicita_factura_rtn THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.datos_fiscales_cliente d WHERE d.admin_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Configurá tus datos fiscales (RTN) en Perfil antes de solicitar factura';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.cuentas_bancarias_armemosla
    WHERE id = p_cuenta_bancaria_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'Cuenta bancaria no válida';
  END IF;

  v_pendiente := public.monto_pendiente_factura(p_factura_id);

  INSERT INTO public.transferencias (
    admin_id, cuenta_bancaria_id, numero_transaccion, monto,
    solicita_factura_rtn, estado
  )
  VALUES (
    auth.uid(), p_cuenta_bancaria_id, TRIM(p_numero_transaccion), p_monto,
    COALESCE(p_solicita_factura_rtn, false), 'pendiente_revision'
  )
  RETURNING id INTO v_transferencia_id;

  INSERT INTO public.transferencia_facturas (transferencia_id, factura_id, monto_aplicado)
  VALUES (v_transferencia_id, p_factura_id, p_monto);

  UPDATE public.facturas_mensuales
  SET
    estado_pago = 'en_revision',
    dias_retraso = 0,
    monto_mora = 0,
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_factura_id;

  PERFORM public.sincronizar_visibilidad_complejos_admin(auth.uid());

  RETURN v_transferencia_id;
END;
$$;

-- Helper disponibilidad pago (evita duplicar lógica app)
CREATE OR REPLACE FUNCTION public.es_factura_pagable_disponible(p_mes INTEGER, p_año INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT TIMEZONE('utc'::text, NOW()) >= public.fecha_disponible_pago_factura(p_mes, p_año);
$$;

-- ---------------------------------------------------------------------------
-- RPC: confirmar transferencia (admin plataforma)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirmar_transferencia(p_transferencia_id UUID)
RETURNS public.facturas_mensuales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t public.transferencias;
  v_factura_id UUID;
  v_factura public.facturas_mensuales;
  v_pendiente DECIMAL(10, 2);
  v_solicita_rtn BOOLEAN;
BEGIN
  IF NOT public.es_admin_plataforma() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_t FROM public.transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF v_t.id IS NULL THEN
    RAISE EXCEPTION 'Transferencia no encontrada';
  END IF;

  IF v_t.estado <> 'pendiente_revision' THEN
    RAISE EXCEPTION 'La transferencia no está pendiente de revisión';
  END IF;

  UPDATE public.transferencias
  SET
    estado = 'confirmada',
    revisado_por = auth.uid(),
    revisado_at = TIMEZONE('utc'::text, NOW()),
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_transferencia_id;

  SELECT tf.factura_id INTO v_factura_id
  FROM public.transferencia_facturas tf
  WHERE tf.transferencia_id = p_transferencia_id
  LIMIT 1;

  v_pendiente := public.monto_pendiente_factura(v_factura_id);

  IF v_pendiente <= 0 THEN
    SELECT * INTO v_factura FROM public.marcar_factura_pagada_service(v_factura_id);

    SELECT EXISTS (
      SELECT 1
      FROM public.transferencia_facturas tf
      INNER JOIN public.transferencias t ON t.id = tf.transferencia_id
      WHERE tf.factura_id = v_factura_id
        AND t.estado = 'confirmada'
        AND t.solicita_factura_rtn = true
    ) INTO v_solicita_rtn;

    IF v_solicita_rtn THEN
      PERFORM public.generar_factura_fiscal(v_factura_id, p_transferencia_id);
    END IF;
  ELSE
    UPDATE public.facturas_mensuales
    SET estado_pago = 'en_revision', updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = v_factura_id
    RETURNING * INTO v_factura;
  END IF;

  PERFORM public.sincronizar_visibilidad_complejos_admin(v_t.admin_id);

  SELECT * INTO v_factura FROM public.facturas_mensuales WHERE id = v_factura_id;
  RETURN v_factura;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: rechazar transferencia
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rechazar_transferencia(
  p_transferencia_id UUID,
  p_motivo TEXT
)
RETURNS public.transferencias
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t public.transferencias;
  v_factura_id UUID;
  v_pendiente DECIMAL(10, 2);
  v_confirmado DECIMAL(10, 2);
BEGIN
  IF NOT public.es_admin_plataforma() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_t FROM public.transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF v_t.estado <> 'pendiente_revision' THEN
    RAISE EXCEPTION 'La transferencia no está pendiente de revisión';
  END IF;

  UPDATE public.transferencias
  SET
    estado = 'rechazada',
    notas_admin = TRIM(p_motivo),
    revisado_por = auth.uid(),
    revisado_at = TIMEZONE('utc'::text, NOW()),
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = p_transferencia_id
  RETURNING * INTO v_t;

  SELECT tf.factura_id INTO v_factura_id
  FROM public.transferencia_facturas tf WHERE tf.transferencia_id = p_transferencia_id LIMIT 1;

  v_confirmado := public.monto_confirmado_factura(v_factura_id);
  v_pendiente := public.monto_pendiente_factura(v_factura_id);

  IF v_confirmado = 0 AND NOT EXISTS (
    SELECT 1 FROM public.transferencias t
    INNER JOIN public.transferencia_facturas tf ON tf.transferencia_id = t.id
    WHERE tf.factura_id = v_factura_id AND t.estado = 'pendiente_revision'
  ) THEN
    PERFORM public.procesar_politicas_pago_facturas();
  END IF;

  PERFORM public.sincronizar_visibilidad_complejos_admin(v_t.admin_id);
  RETURN v_t;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: registrar reembolso
-- ---------------------------------------------------------------------------
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
DECLARE
  v_t public.transferencias;
  v_reembolso public.reembolsos;
  v_factura_id UUID;
BEGIN
  IF NOT public.es_admin_plataforma() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_t FROM public.transferencias WHERE id = p_transferencia_id FOR UPDATE;
  IF v_t.id IS NULL OR v_t.estado <> 'confirmada' THEN
    RAISE EXCEPTION 'Solo se reembolsan transferencias confirmadas';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 OR p_monto > v_t.monto THEN
    RAISE EXCEPTION 'Monto de reembolso inválido';
  END IF;

  INSERT INTO public.reembolsos (transferencia_id, monto, motivo, visible_mensaje, creado_por)
  VALUES (p_transferencia_id, p_monto, TRIM(p_motivo), TRIM(p_visible_mensaje), auth.uid())
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

GRANT EXECUTE ON FUNCTION public.reportar_transferencia(UUID, UUID, TEXT, DECIMAL, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_transferencia(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rechazar_transferencia(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_reembolso(UUID, DECIMAL, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_factura_pagable_disponible(INTEGER, INTEGER) TO authenticated;

COMMENT ON TABLE public.transferencias IS 'Transferencias bancarias reportadas por admins de complejo';
COMMENT ON TABLE public.facturas_fiscales IS 'Facturas fiscales RTN/CAI emitidas (inmutables)';
