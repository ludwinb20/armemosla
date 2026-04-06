-- Tabla de facturas mensuales
-- Ejecutar después de 11_reservas.sql

-- Tabla de facturas mensuales
CREATE TABLE IF NOT EXISTS public.facturas_mensuales (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  año INTEGER NOT NULL,
  total_facturado DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (total_facturado >= 0),
  comision DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (comision >= 0),
  estado_pago TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'pagado', 'vencido')),
  fecha_limite_pago TIMESTAMP WITH TIME ZONE NOT NULL,
  fecha_pago TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  -- Constraint: una factura única por admin/mes/año
  CONSTRAINT factura_unique_admin_mes_año UNIQUE (admin_id, mes, año)
);

-- Tabla de detalle de factura por cancha
CREATE TABLE IF NOT EXISTS public.factura_detalle_cancha (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  factura_id UUID REFERENCES public.facturas_mensuales(id) ON DELETE CASCADE NOT NULL,
  cancha_id UUID REFERENCES public.canchas(id) ON DELETE CASCADE NOT NULL,
  total_reservas INTEGER NOT NULL DEFAULT 0 CHECK (total_reservas >= 0),
  total_facturado DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (total_facturado >= 0),
  comision DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (comision >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_facturas_admin_id ON public.facturas_mensuales(admin_id);
CREATE INDEX IF NOT EXISTS idx_facturas_mes_año ON public.facturas_mensuales(admin_id, año, mes);
CREATE INDEX IF NOT EXISTS idx_facturas_estado_pago ON public.facturas_mensuales(estado_pago);
CREATE INDEX IF NOT EXISTS idx_factura_detalle_factura_id ON public.factura_detalle_cancha(factura_id);
CREATE INDEX IF NOT EXISTS idx_factura_detalle_cancha_id ON public.factura_detalle_cancha(cancha_id);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.facturas_mensuales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factura_detalle_cancha ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para facturas_mensuales
-- Los administradores pueden ver sus propias facturas
CREATE POLICY "Admins can view own facturas"
  ON public.facturas_mensuales
  FOR SELECT
  USING (auth.uid() = admin_id);

-- Los administradores pueden insertar sus propias facturas
CREATE POLICY "Admins can insert own facturas"
  ON public.facturas_mensuales
  FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

-- Los administradores pueden actualizar sus propias facturas
CREATE POLICY "Admins can update own facturas"
  ON public.facturas_mensuales
  FOR UPDATE
  USING (auth.uid() = admin_id);

-- Políticas RLS para factura_detalle_cancha
-- Los administradores pueden ver detalles de sus facturas
CREATE POLICY "Admins can view own factura detalles"
  ON public.factura_detalle_cancha
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.facturas_mensuales
      WHERE facturas_mensuales.id = factura_detalle_cancha.factura_id
      AND facturas_mensuales.admin_id = auth.uid()
    )
  );

-- Los administradores pueden insertar detalles de sus facturas
CREATE POLICY "Admins can insert own factura detalles"
  ON public.factura_detalle_cancha
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.facturas_mensuales
      WHERE facturas_mensuales.id = factura_detalle_cancha.factura_id
      AND facturas_mensuales.admin_id = auth.uid()
    )
  );

-- Los administradores pueden eliminar detalles de sus facturas
CREATE POLICY "Admins can delete own factura detalles"
  ON public.factura_detalle_cancha
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.facturas_mensuales
      WHERE facturas_mensuales.id = factura_detalle_cancha.factura_id
      AND facturas_mensuales.admin_id = auth.uid()
    )
  );

-- Trigger para actualizar updated_at en facturas_mensuales
DROP TRIGGER IF EXISTS set_facturas_updated_at ON public.facturas_mensuales;
CREATE TRIGGER set_facturas_updated_at
  BEFORE UPDATE ON public.facturas_mensuales
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Función para calcular y crear/actualizar factura mensual
CREATE OR REPLACE FUNCTION public.calcular_factura_mensual(
  p_admin_id UUID,
  p_mes INTEGER,
  p_año INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_factura_id UUID;
  v_total_facturado DECIMAL(10, 2) := 0;
  v_comision DECIMAL(10, 2) := 0;
  v_fecha_limite TIMESTAMP WITH TIME ZONE;
  v_inicio_mes TIMESTAMP WITH TIME ZONE;
  v_fin_mes TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calcular rango de fechas del mes
  v_inicio_mes := DATE_TRUNC('month', MAKE_DATE(p_año, p_mes, 1));
  v_fin_mes := (DATE_TRUNC('month', MAKE_DATE(p_año, p_mes, 1)) + INTERVAL '1 month - 1 day')::DATE + INTERVAL '23 hours 59 minutes 59 seconds';
  
  -- Calcular fecha límite de pago (día 20 del mes siguiente)
  v_fecha_limite := (DATE_TRUNC('month', MAKE_DATE(p_año, p_mes, 1)) + INTERVAL '1 month' + INTERVAL '19 days')::DATE + INTERVAL '23 hours 59 minutes 59 seconds';
  
  -- Calcular total facturado desde reservas completadas del mes
  SELECT COALESCE(SUM(canchas.precio_por_hora), 0)
  INTO v_total_facturado
  FROM public.reservas
  INNER JOIN public.canchas ON canchas.id = reservas.cancha_id
  INNER JOIN public.complejos ON complejos.id = canchas.complejo_id
  WHERE complejos.admin_id = p_admin_id
    AND reservas.estado = 'completada'
    AND reservas.fecha_hora >= v_inicio_mes
    AND reservas.fecha_hora <= v_fin_mes;
  
  -- Calcular comisión (10% del total facturado)
  v_comision := v_total_facturado * 0.10;
  
  -- Buscar o crear factura
  INSERT INTO public.facturas_mensuales (
    admin_id,
    mes,
    año,
    total_facturado,
    comision,
    fecha_limite_pago
  )
  VALUES (
    p_admin_id,
    p_mes,
    p_año,
    v_total_facturado,
    v_comision,
    v_fecha_limite
  )
  ON CONFLICT (admin_id, mes, año)
  DO UPDATE SET
    total_facturado = EXCLUDED.total_facturado,
    comision = EXCLUDED.comision,
    updated_at = TIMEZONE('utc'::text, NOW())
  RETURNING id INTO v_factura_id;
  
  -- Eliminar detalles anteriores
  DELETE FROM public.factura_detalle_cancha
  WHERE factura_id = v_factura_id;
  
  -- Crear detalles por cancha
  INSERT INTO public.factura_detalle_cancha (
    factura_id,
    cancha_id,
    total_reservas,
    total_facturado,
    comision
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
  
  -- Actualizar estado de pago si es necesario
  UPDATE public.facturas_mensuales
  SET estado_pago = CASE
    WHEN fecha_pago IS NOT NULL THEN 'pagado'
    WHEN TIMEZONE('utc'::text, NOW()) > fecha_limite_pago THEN 'vencido'
    ELSE 'pendiente'
  END
  WHERE id = v_factura_id;
  
  RETURN v_factura_id;
END;
$$;

-- Función para actualizar estados de pago vencidos
CREATE OR REPLACE FUNCTION public.actualizar_estados_pago_vencidos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.facturas_mensuales
  SET estado_pago = 'vencido',
      updated_at = TIMEZONE('utc'::text, NOW())
  WHERE estado_pago = 'pendiente'
    AND fecha_pago IS NULL
    AND TIMEZONE('utc'::text, NOW()) > fecha_limite_pago;
END;
$$;

-- Comentarios para documentación
COMMENT ON TABLE public.facturas_mensuales IS 'Facturas mensuales de comisiones para administradores';
COMMENT ON COLUMN public.facturas_mensuales.mes IS 'Mes de la factura (1-12)';
COMMENT ON COLUMN public.facturas_mensuales.año IS 'Año de la factura';
COMMENT ON COLUMN public.facturas_mensuales.total_facturado IS 'Total facturado en el mes (suma de precios de reservas completadas)';
COMMENT ON COLUMN public.facturas_mensuales.comision IS 'Comisión del 10% que debe pagar el administrador a la plataforma';
COMMENT ON COLUMN public.facturas_mensuales.estado_pago IS 'Estado del pago: pendiente, pagado, vencido';
COMMENT ON COLUMN public.facturas_mensuales.fecha_limite_pago IS 'Fecha límite para realizar el pago (día 20 del mes siguiente)';
COMMENT ON COLUMN public.facturas_mensuales.fecha_pago IS 'Fecha en que se realizó el pago (null si aún no se ha pagado)';

COMMENT ON TABLE public.factura_detalle_cancha IS 'Desglose de factura mensual por cancha';
COMMENT ON COLUMN public.factura_detalle_cancha.total_reservas IS 'Número total de reservas completadas de la cancha en el mes';
COMMENT ON COLUMN public.factura_detalle_cancha.total_facturado IS 'Total facturado de la cancha en el mes';
COMMENT ON COLUMN public.factura_detalle_cancha.comision IS 'Comisión correspondiente a la cancha (10% del total facturado)';

COMMENT ON FUNCTION public.calcular_factura_mensual IS 'Calcula y crea/actualiza una factura mensual para un administrador';
COMMENT ON FUNCTION public.actualizar_estados_pago_vencidos IS 'Actualiza automáticamente los estados de pago de facturas vencidas';
