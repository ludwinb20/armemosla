-- Tabla de reservas
-- Ejecutar después de 07_canchas.sql

-- Tabla de reservas
CREATE TABLE IF NOT EXISTS public.reservas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cancha_id UUID REFERENCES public.canchas(id) ON DELETE CASCADE NOT NULL,
  fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  made_by_player BOOLEAN NOT NULL DEFAULT true,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'completada', 'cancelada')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  -- Constraint: Si made_by_player es true, user_id debe estar presente
  -- Si made_by_player es false, user_id debe ser null
  CONSTRAINT reserva_user_check CHECK (
    (made_by_player = true AND user_id IS NOT NULL) OR
    (made_by_player = false AND user_id IS NULL)
  )
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_reservas_cancha_id ON public.reservas(cancha_id);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_hora ON public.reservas(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_reservas_user_id ON public.reservas(user_id);
CREATE INDEX IF NOT EXISTS idx_reservas_estado ON public.reservas(estado);
CREATE INDEX IF NOT EXISTS idx_reservas_cancha_fecha ON public.reservas(cancha_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_reservas_made_by_player ON public.reservas(made_by_player);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para reservas
-- Los administradores pueden ver reservas de sus canchas
CREATE POLICY "Admins can view own reservas"
  ON public.reservas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      WHERE canchas.id = reservas.cancha_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden insertar reservas en sus canchas
CREATE POLICY "Admins can insert own reservas"
  ON public.reservas
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      WHERE canchas.id = reservas.cancha_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden actualizar reservas de sus canchas
CREATE POLICY "Admins can update own reservas"
  ON public.reservas
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      WHERE canchas.id = reservas.cancha_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los administradores pueden eliminar reservas de sus canchas
CREATE POLICY "Admins can delete own reservas"
  ON public.reservas
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.canchas
      INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
      WHERE canchas.id = reservas.cancha_id
      AND complejos.admin_id = auth.uid()
    )
  );

-- Los jugadores pueden ver sus propias reservas
CREATE POLICY "Players can view own reservas"
  ON public.reservas
  FOR SELECT
  USING (
    user_id = auth.uid() AND made_by_player = true
  );

-- Los jugadores pueden insertar sus propias reservas
CREATE POLICY "Players can insert own reservas"
  ON public.reservas
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND made_by_player = true
  );

-- Los jugadores pueden actualizar sus propias reservas (solo si están pendientes)
CREATE POLICY "Players can update own reservas"
  ON public.reservas
  FOR UPDATE
  USING (
    user_id = auth.uid() AND made_by_player = true AND estado = 'pendiente'
  );

-- Los jugadores pueden cancelar sus propias reservas
CREATE POLICY "Players can cancel own reservas"
  ON public.reservas
  FOR UPDATE
  USING (
    user_id = auth.uid() AND made_by_player = true AND estado = 'pendiente'
  )
  WITH CHECK (
    user_id = auth.uid() AND made_by_player = true AND (estado = 'cancelada' OR estado = 'pendiente')
  );

-- Trigger para actualizar updated_at en reservas
DROP TRIGGER IF EXISTS set_reservas_updated_at ON public.reservas;
CREATE TRIGGER set_reservas_updated_at
  BEFORE UPDATE ON public.reservas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE public.reservas IS 'Reservas de canchas deportivas';
COMMENT ON COLUMN public.reservas.fecha_hora IS 'Fecha y hora de inicio de la reserva (duración fija de 1 hora)';
COMMENT ON COLUMN public.reservas.user_id IS 'ID del usuario que hizo la reserva (null si fue registrada por el dueño)';
COMMENT ON COLUMN public.reservas.made_by_player IS 'Indica si la reserva fue hecha por un jugador (true) o registrada por el dueño (false)';
COMMENT ON COLUMN public.reservas.estado IS 'Estado de la reserva: pendiente, completada, cancelada';

