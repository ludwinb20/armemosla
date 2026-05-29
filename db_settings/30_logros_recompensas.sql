-- Logros, progreso, recompensas y canjes
-- Ejecutar después de 13_facturas_mensuales.sql

-- Catálogo de logros (seed en 33; v1 sin UI de plataforma)
CREATE TABLE IF NOT EXISTS public.logros (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  icono TEXT NOT NULL DEFAULT 'trophy',
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  criterio_tipo TEXT NOT NULL CHECK (
    criterio_tipo IN (
      'reservas_completadas_misma_cancha',
      'canchas_distintas_jugadas'
    )
  ),
  criterio_params JSONB NOT NULL DEFAULT '{"cantidad": 1}'::jsonb,
  recompensa_tipo TEXT NOT NULL CHECK (
    recompensa_tipo IN ('porcentaje', 'monto_fijo', 'reserva_gratis')
  ),
  recompensa_valor DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (recompensa_valor >= 0),
  recompensa_restricciones JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.jugador_logro_progreso (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logro_id UUID NOT NULL REFERENCES public.logros(id) ON DELETE CASCADE,
  valor_actual INTEGER NOT NULL DEFAULT 0 CHECK (valor_actual >= 0),
  valor_meta INTEGER NOT NULL CHECK (valor_meta > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  completado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE (user_id, logro_id)
);

CREATE TABLE IF NOT EXISTS public.jugador_recompensas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  logro_id UUID NOT NULL REFERENCES public.logros(id) ON DELETE RESTRICT,
  estado TEXT NOT NULL DEFAULT 'disponible' CHECK (
    estado IN ('disponible', 'canjeada', 'expirada')
  ),
  canje_token UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  recompensa_tipo TEXT NOT NULL,
  recompensa_valor DECIMAL(10, 2) NOT NULL DEFAULT 0,
  recompensa_restricciones JSONB NOT NULL DEFAULT '{}'::jsonb,
  cancha_id_restriccion UUID REFERENCES public.canchas(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.canjes_recompensa (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  recompensa_id UUID NOT NULL REFERENCES public.jugador_recompensas(id) ON DELETE RESTRICT,
  logro_id UUID NOT NULL REFERENCES public.logros(id) ON DELETE RESTRICT,
  reserva_id UUID NOT NULL REFERENCES public.reservas(id) ON DELETE RESTRICT,
  cancha_id UUID NOT NULL REFERENCES public.canchas(id) ON DELETE RESTRICT,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  jugador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  monto_descontado DECIMAL(10, 2) NOT NULL CHECK (monto_descontado >= 0),
  logro_titulo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS canje_recompensa_id UUID REFERENCES public.jugador_recompensas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jugador_logro_progreso_user ON public.jugador_logro_progreso(user_id);
CREATE INDEX IF NOT EXISTS idx_jugador_recompensas_user ON public.jugador_recompensas(user_id);
CREATE INDEX IF NOT EXISTS idx_jugador_recompensas_token ON public.jugador_recompensas(canje_token);
CREATE INDEX IF NOT EXISTS idx_jugador_recompensas_estado ON public.jugador_recompensas(user_id, estado);
CREATE INDEX IF NOT EXISTS idx_canjes_recompensa_admin_mes ON public.canjes_recompensa(admin_id, created_at);

DROP TRIGGER IF EXISTS set_logros_updated_at ON public.logros;
CREATE TRIGGER set_logros_updated_at
  BEFORE UPDATE ON public.logros
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_jugador_logro_progreso_updated_at ON public.jugador_logro_progreso;
CREATE TRIGGER set_jugador_logro_progreso_updated_at
  BEFORE UPDATE ON public.jugador_logro_progreso
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_jugador_recompensas_updated_at ON public.jugador_recompensas;
CREATE TRIGGER set_jugador_recompensas_updated_at
  BEFORE UPDATE ON public.jugador_recompensas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.logros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jugador_logro_progreso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jugador_recompensas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canjes_recompensa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view active logros" ON public.logros;
CREATE POLICY "Authenticated can view active logros"
  ON public.logros FOR SELECT
  USING (auth.uid() IS NOT NULL AND activo = true);

DROP POLICY IF EXISTS "Players view own logro progreso" ON public.jugador_logro_progreso;
CREATE POLICY "Players view own logro progreso"
  ON public.jugador_logro_progreso FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Players view own recompensas" ON public.jugador_recompensas;
CREATE POLICY "Players view own recompensas"
  ON public.jugador_recompensas FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view own canjes" ON public.canjes_recompensa;
CREATE POLICY "Admins view own canjes"
  ON public.canjes_recompensa FOR SELECT
  USING (admin_id = auth.uid());

COMMENT ON TABLE public.logros IS 'Catálogo de logros y recompensas (v1 vía SQL seed)';
COMMENT ON TABLE public.jugador_logro_progreso IS 'Progreso del jugador hacia cada logro';
COMMENT ON TABLE public.jugador_recompensas IS 'Recompensas otorgadas pendientes de canje vía QR';
COMMENT ON TABLE public.canjes_recompensa IS 'Historial de canjes; base para descuentos en factura';
