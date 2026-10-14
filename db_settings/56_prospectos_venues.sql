-- CRM de venues / prospectos para panel superadmin
-- Estados comerciales para mapa de San Pedro Sula

CREATE TABLE IF NOT EXISTS public.prospectos_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  direccion_texto TEXT,
  direccion_lat DOUBLE PRECISION NOT NULL,
  direccion_lng DOUBLE PRECISION NOT NULL,
  estado_comercial TEXT NOT NULL DEFAULT 'existente'
    CHECK (estado_comercial IN (
      'existente',
      'en_app',
      'ofrecido_rechazado',
      'ofrecido_en_proceso'
    )),
  complejo_id UUID REFERENCES public.complejos(id) ON DELETE SET NULL,
  notas TEXT,
  contacto_nombre TEXT,
  contacto_telefono TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospectos_venues_estado
  ON public.prospectos_venues (estado_comercial);

CREATE INDEX IF NOT EXISTS idx_prospectos_venues_complejo
  ON public.prospectos_venues (complejo_id);

CREATE TABLE IF NOT EXISTS public.prospectos_canchas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_id UUID NOT NULL REFERENCES public.prospectos_venues(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospectos_canchas_prospecto
  ON public.prospectos_canchas (prospecto_id);

CREATE OR REPLACE FUNCTION public.set_updated_at_prospectos()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prospectos_venues_updated ON public.prospectos_venues;
CREATE TRIGGER trg_prospectos_venues_updated
  BEFORE UPDATE ON public.prospectos_venues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_prospectos();

DROP TRIGGER IF EXISTS trg_prospectos_canchas_updated ON public.prospectos_canchas;
CREATE TRIGGER trg_prospectos_canchas_updated
  BEFORE UPDATE ON public.prospectos_canchas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_prospectos();

-- Al vincular un complejo, forzar estado en_app
CREATE OR REPLACE FUNCTION public.prospecto_sync_en_app()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.complejo_id IS NOT NULL THEN
    NEW.estado_comercial := 'en_app';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prospecto_sync_en_app ON public.prospectos_venues;
CREATE TRIGGER trg_prospecto_sync_en_app
  BEFORE INSERT OR UPDATE OF complejo_id ON public.prospectos_venues
  FOR EACH ROW EXECUTE FUNCTION public.prospecto_sync_en_app();

ALTER TABLE public.prospectos_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospectos_canchas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospectos_venues_admin_all ON public.prospectos_venues;
CREATE POLICY prospectos_venues_admin_all
  ON public.prospectos_venues
  FOR ALL
  TO authenticated
  USING (public.es_admin_plataforma())
  WITH CHECK (public.es_admin_plataforma());

DROP POLICY IF EXISTS prospectos_canchas_admin_all ON public.prospectos_canchas;
CREATE POLICY prospectos_canchas_admin_all
  ON public.prospectos_canchas
  FOR ALL
  TO authenticated
  USING (public.es_admin_plataforma())
  WITH CHECK (public.es_admin_plataforma());

-- Lectura de complejos/canchas para vincular en CRM (admin plataforma)
DROP POLICY IF EXISTS complejos_select_admin_plataforma ON public.complejos;
CREATE POLICY complejos_select_admin_plataforma
  ON public.complejos
  FOR SELECT
  TO authenticated
  USING (public.es_admin_plataforma());

DROP POLICY IF EXISTS canchas_select_admin_plataforma ON public.canchas;
CREATE POLICY canchas_select_admin_plataforma
  ON public.canchas
  FOR SELECT
  TO authenticated
  USING (public.es_admin_plataforma());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospectos_venues TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospectos_canchas TO authenticated;

COMMENT ON TABLE public.prospectos_venues IS
  'CRM de venues SPS: inventario, pipeline comercial y vínculo a complejos onboarded';
COMMENT ON COLUMN public.prospectos_venues.estado_comercial IS
  'existente | en_app | ofrecido_rechazado | ofrecido_en_proceso';
