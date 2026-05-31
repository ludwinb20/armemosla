-- Métodos de pago guardados (tokens PayPal Vault — nunca PAN/CVV)
-- Ejecutar después de 41_pagos_paypal.sql

CREATE TABLE IF NOT EXISTS public.metodos_pago_paypal (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paypal_vault_id TEXT NOT NULL,
  marca TEXT,
  ultimos_digitos TEXT,
  exp_mes INTEGER CHECK (exp_mes IS NULL OR (exp_mes >= 1 AND exp_mes <= 12)),
  exp_anio INTEGER CHECK (exp_anio IS NULL OR exp_anio >= 2020),
  es_predeterminado BOOLEAN NOT NULL DEFAULT false,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT metodos_pago_paypal_vault_unique UNIQUE (admin_id, paypal_vault_id)
);

CREATE INDEX IF NOT EXISTS idx_metodos_pago_admin ON public.metodos_pago_paypal(admin_id);

DROP TRIGGER IF EXISTS set_metodos_pago_updated_at ON public.metodos_pago_paypal;
CREATE TRIGGER set_metodos_pago_updated_at
  BEFORE UPDATE ON public.metodos_pago_paypal
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.metodos_pago_paypal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own payment methods"
  ON public.metodos_pago_paypal FOR SELECT
  USING (auth.uid() = admin_id);

CREATE POLICY "Admins can update own payment methods"
  ON public.metodos_pago_paypal FOR UPDATE
  USING (auth.uid() = admin_id);

CREATE POLICY "Admins can delete own payment methods"
  ON public.metodos_pago_paypal FOR DELETE
  USING (auth.uid() = admin_id);

COMMENT ON TABLE public.metodos_pago_paypal IS
  'Tokens de vault PayPal por administrador. Solo referencias; nunca número de tarjeta.';
