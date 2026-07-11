-- Seed: cuentas bancarias, emisor fiscal dummy, instrucciones admin plataforma
-- Ejecutar después de 48_pagos_transferencias.sql

INSERT INTO public.cuentas_bancarias_armemosla (banco_nombre, logo_url, numero_cuenta, titular, activo, orden)
SELECT * FROM (VALUES
  (
    'BAC Credomatic'::TEXT,
    'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/BAC_Credomatic_logo.svg/320px-BAC_Credomatic_logo.svg.png'::TEXT,
    '1234567890123456'::TEXT,
    'Armemosla S.A. de C.V.'::TEXT,
    true,
    1
  ),
  (
    'Banco Ficohsa'::TEXT,
    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Ficohsa_logo.svg/320px-Ficohsa_logo.svg.png'::TEXT,
    '9876543210987654'::TEXT,
    'Armemosla S.A. de C.V.'::TEXT,
    true,
    2
  ),
  (
    'Banco Atlántida'::TEXT,
    'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Banco_Atl%C3%A1ntida_logo.svg/320px-Banco_Atl%C3%A1ntida_logo.svg.png'::TEXT,
    '5555666677778888'::TEXT,
    'Armemosla S.A. de C.V.'::TEXT,
    true,
    3
  )
) AS v(banco_nombre, logo_url, numero_cuenta, titular, activo, orden)
WHERE NOT EXISTS (SELECT 1 FROM public.cuentas_bancarias_armemosla LIMIT 1);

-- Emisor fiscal dummy (renovar CAI insertando nuevo registro activo y desactivando el anterior)
INSERT INTO public.emisor_fiscal_config (
  razon_social, rtn, cai, fecha_emision, fecha_limite_emision, activo
)
SELECT
  'Armemosla S.A. de C.V.',
  '08019999001234',
  'A1B2-C3D4-E5F6-G7H8-I9J0-K1L2',
  (CURRENT_DATE - INTERVAL '30 days')::DATE,
  (CURRENT_DATE + INTERVAL '335 days')::DATE,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.emisor_fiscal_config WHERE activo = true
);

INSERT INTO public.emisor_fiscal_correlativo (emisor_fiscal_id, ultimo_numero)
SELECT id, 0
FROM public.emisor_fiscal_config
WHERE activo = true
ON CONFLICT (emisor_fiscal_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Asignar Admin Plataforma (cuenta DIFERENTE a demo.admin@armemosla.test):
--
-- UPDATE public.profiles
-- SET es_admin_plataforma = true
-- WHERE email = 'tu-email-plataforma@ejemplo.com';
--
-- Para pruebas completas de pagos, ver también:
-- db_settings/50_seed_admin_complejo_demo_pagos.sql
--
-- Verificar:
-- SELECT id, email, user_type, es_admin_plataforma FROM public.profiles
-- WHERE es_admin_plataforma = true OR email = 'demo.admin@armemosla.test';
-- ---------------------------------------------------------------------------
