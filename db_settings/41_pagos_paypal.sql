-- Pagos PayPal (Orders API v2) — tracking server-side
-- Ejecutar después de 40_pagos_mora_complejos_ocultos.sql

CREATE TABLE IF NOT EXISTS public.pagos_paypal (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  factura_id UUID NOT NULL REFERENCES public.facturas_mensuales(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paypal_order_id TEXT NOT NULL,
  paypal_capture_id TEXT,
  monto DECIMAL(10, 2) NOT NULL CHECK (monto >= 0),
  moneda TEXT NOT NULL DEFAULT 'USD',
  estado TEXT NOT NULL DEFAULT 'created' CHECK (
    estado IN ('created', 'approved', 'captured', 'failed', 'cancelled')
  ),
  approval_url TEXT,
  error_message TEXT,
  raw_create_response JSONB,
  raw_capture_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT pagos_paypal_order_unique UNIQUE (paypal_order_id)
);

CREATE INDEX IF NOT EXISTS idx_pagos_paypal_factura ON public.pagos_paypal(factura_id);
CREATE INDEX IF NOT EXISTS idx_pagos_paypal_admin ON public.pagos_paypal(admin_id);
CREATE INDEX IF NOT EXISTS idx_pagos_paypal_estado ON public.pagos_paypal(estado);

ALTER TABLE public.facturas_mensuales
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT;

DROP TRIGGER IF EXISTS set_pagos_paypal_updated_at ON public.pagos_paypal;
CREATE TRIGGER set_pagos_paypal_updated_at
  BEFORE UPDATE ON public.pagos_paypal
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.pagos_paypal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own pagos paypal"
  ON public.pagos_paypal
  FOR SELECT
  USING (auth.uid() = admin_id);

COMMENT ON TABLE public.pagos_paypal IS
  'Intentos de pago PayPal iniciados desde la app y procesados en Edge Functions';

-- Marcar factura pagada desde Edge Functions (service role / webhook; sin auth.uid())
CREATE OR REPLACE FUNCTION public.marcar_factura_pagada_service(p_factura_id UUID)
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
  RETURNING * INTO v_factura;

  IF v_factura.id IS NULL THEN
    RAISE EXCEPTION 'Factura no encontrada';
  END IF;

  PERFORM public.sincronizar_visibilidad_complejos_admin(v_factura.admin_id);

  RETURN v_factura;
END;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_factura_pagada_service(UUID) TO service_role;
