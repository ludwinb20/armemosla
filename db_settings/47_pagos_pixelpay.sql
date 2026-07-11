-- Pagos PixelPay — cobro directo con tarjeta (sin redirección)
-- Ejecutar después de 46_paypal_merchant_customer_id.sql

CREATE TABLE IF NOT EXISTS public.pagos_pixelpay (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  factura_id UUID NOT NULL REFERENCES public.facturas_mensuales(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pixelpay_transaction_id TEXT,
  pixelpay_payment_uuid TEXT,
  monto DECIMAL(10, 2) NOT NULL CHECK (monto >= 0),
  moneda TEXT NOT NULL DEFAULT 'HNL',
  estado TEXT NOT NULL DEFAULT 'pending' CHECK (
    estado IN ('pending', 'approved', 'failed')
  ),
  error_message TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_pagos_pixelpay_factura ON public.pagos_pixelpay(factura_id);
CREATE INDEX IF NOT EXISTS idx_pagos_pixelpay_admin ON public.pagos_pixelpay(admin_id);
CREATE INDEX IF NOT EXISTS idx_pagos_pixelpay_estado ON public.pagos_pixelpay(estado);

ALTER TABLE public.facturas_mensuales
  ADD COLUMN IF NOT EXISTS pixelpay_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS pixelpay_payment_uuid TEXT;

DROP TRIGGER IF EXISTS set_pagos_pixelpay_updated_at ON public.pagos_pixelpay;
CREATE TRIGGER set_pagos_pixelpay_updated_at
  BEFORE UPDATE ON public.pagos_pixelpay
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.pagos_pixelpay ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own pagos pixelpay"
  ON public.pagos_pixelpay
  FOR SELECT
  USING (auth.uid() = admin_id);

COMMENT ON TABLE public.pagos_pixelpay IS
  'Cobros PixelPay procesados en Edge Functions (sale API)';

-- Métodos de pago guardados (tokens PixelPay — nunca PAN/CVV)
CREATE TABLE IF NOT EXISTS public.metodos_pago_pixelpay (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pixelpay_token TEXT NOT NULL,
  marca TEXT,
  ultimos_digitos TEXT,
  exp_mes INTEGER CHECK (exp_mes IS NULL OR (exp_mes >= 1 AND exp_mes <= 12)),
  exp_anio INTEGER CHECK (exp_anio IS NULL OR exp_anio >= 2020),
  es_predeterminado BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT metodos_pago_pixelpay_token_unique UNIQUE (admin_id, pixelpay_token)
);

CREATE INDEX IF NOT EXISTS idx_metodos_pago_pixelpay_admin ON public.metodos_pago_pixelpay(admin_id);

DROP TRIGGER IF EXISTS set_metodos_pago_pixelpay_updated_at ON public.metodos_pago_pixelpay;
CREATE TRIGGER set_metodos_pago_pixelpay_updated_at
  BEFORE UPDATE ON public.metodos_pago_pixelpay
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.metodos_pago_pixelpay ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own pixelpay methods"
  ON public.metodos_pago_pixelpay FOR SELECT
  USING (auth.uid() = admin_id);

CREATE POLICY "Admins can update own pixelpay methods"
  ON public.metodos_pago_pixelpay FOR UPDATE
  USING (auth.uid() = admin_id);

CREATE POLICY "Admins can delete own pixelpay methods"
  ON public.metodos_pago_pixelpay FOR DELETE
  USING (auth.uid() = admin_id);

COMMENT ON TABLE public.metodos_pago_pixelpay IS
  'Tokens PixelPay por administrador. Solo referencias; nunca número de tarjeta.';
