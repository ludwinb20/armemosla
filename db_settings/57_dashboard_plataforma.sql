-- Estadísticas agregadas para panel superadmin (dashboard)
-- Ejecutar después de 56_prospectos_venues.sql

CREATE OR REPLACE FUNCTION public.obtener_estadisticas_plataforma()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
  v_tz TEXT := 'America/Tegucigalpa';
  v_inicio_mes TIMESTAMPTZ :=
    (DATE_TRUNC('month', (v_now AT TIME ZONE v_tz)::DATE)::TIMESTAMP AT TIME ZONE v_tz);
  v_fin_mes TIMESTAMPTZ :=
    ((DATE_TRUNC('month', (v_now AT TIME ZONE v_tz)::DATE) + INTERVAL '1 month')::TIMESTAMP AT TIME ZONE v_tz)
    - INTERVAL '1 microsecond';
  v_inicio_hoy TIMESTAMPTZ :=
    ((v_now AT TIME ZONE v_tz)::DATE::TIMESTAMP AT TIME ZONE v_tz);
  v_fin_hoy TIMESTAMPTZ := v_inicio_hoy + INTERVAL '1 day' - INTERVAL '1 microsecond';
  v_hace_30d TIMESTAMPTZ := v_now - INTERVAL '30 days';
  v_hace_7d TIMESTAMPTZ := v_now - INTERVAL '7 days';
BEGIN
  IF NOT public.es_admin_plataforma() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN jsonb_build_object(
    'generado_en', v_now,
    'usuarios', jsonb_build_object(
      'jugadores', (
        SELECT COUNT(*)::INT FROM public.profiles
        WHERE user_type = 'Jugador' AND COALESCE(es_admin_plataforma, false) = false
      ),
      'admins_cancha', (
        SELECT COUNT(*)::INT FROM public.profiles
        WHERE user_type = 'Administrador de Cancha'
      ),
      'nuevos_30_dias', (
        SELECT COUNT(*)::INT FROM public.profiles
        WHERE created_at >= v_hace_30d
          AND COALESCE(es_admin_plataforma, false) = false
      ),
      'nuevos_7_dias', (
        SELECT COUNT(*)::INT FROM public.profiles
        WHERE created_at >= v_hace_7d
          AND COALESCE(es_admin_plataforma, false) = false
      )
    ),
    'infraestructura', jsonb_build_object(
      'complejos_total', (SELECT COUNT(*)::INT FROM public.complejos),
      'complejos_visibles', (
        SELECT COUNT(*)::INT FROM public.complejos WHERE COALESCE(oculto, false) = false
      ),
      'complejos_ocultos', (
        SELECT COUNT(*)::INT FROM public.complejos WHERE COALESCE(oculto, false) = true
      ),
      'canchas_total', (SELECT COUNT(*)::INT FROM public.canchas),
      'canchas_activas', (
        SELECT COUNT(*)::INT FROM public.canchas WHERE COALESCE(activo, true) = true
      )
    ),
    'reservas', jsonb_build_object(
      'hoy', (
        SELECT COUNT(*)::INT FROM public.reservas r
        WHERE r.fecha_hora >= v_inicio_hoy AND r.fecha_hora <= v_fin_hoy
          AND r.estado <> 'cancelada'
      ),
      'mes_calendario', (
        SELECT COUNT(*)::INT FROM public.reservas r
        WHERE r.fecha_hora >= v_inicio_mes AND r.fecha_hora <= v_fin_mes
          AND r.estado <> 'cancelada'
      ),
      'completadas_mes', (
        SELECT COUNT(*)::INT FROM public.reservas r
        WHERE r.estado = 'completada'
          AND r.fecha_hora >= v_inicio_mes AND r.fecha_hora <= v_fin_mes
      ),
      'pendientes_futuras', (
        SELECT COUNT(*)::INT FROM public.reservas r
        WHERE r.estado = 'pendiente' AND r.fecha_hora >= v_now
      ),
      'nuevas_7_dias', (
        SELECT COUNT(*)::INT FROM public.reservas r
        WHERE r.created_at >= v_hace_7d AND r.estado <> 'cancelada'
      ),
      'volumen_completadas_mes', COALESCE((
        SELECT SUM(c.precio_por_hora)::NUMERIC(14, 2)
        FROM public.reservas r
        INNER JOIN public.canchas c ON c.id = r.cancha_id
        WHERE r.estado = 'completada'
          AND r.fecha_hora >= v_inicio_mes AND r.fecha_hora <= v_fin_mes
      ), 0)
    ),
    'pagos', jsonb_build_object(
      'transferencias_pendientes', (
        SELECT COUNT(*)::INT FROM public.transferencias
        WHERE estado = 'pendiente_revision'
      ),
      'reembolsos_pendientes', (
        SELECT COUNT(*)::INT FROM public.solicitudes_reembolso
        WHERE estado = 'pendiente'
      ),
      'facturas_pendientes', (
        SELECT COUNT(*)::INT FROM public.facturas_mensuales
        WHERE estado_pago IN ('pendiente', 'retrasado', 'en_revision')
          AND fecha_pago IS NULL
      ),
      'comision_pendiente_total', COALESCE((
        SELECT SUM(
          COALESCE(f.comision_neta, f.comision, 0) + COALESCE(f.monto_mora, 0)
        )::NUMERIC(14, 2)
        FROM public.facturas_mensuales f
        WHERE f.fecha_pago IS NULL
          AND f.estado_pago IN ('pendiente', 'retrasado', 'en_revision')
      ), 0),
      'comision_cobrada_mes', COALESCE((
        SELECT SUM(
          COALESCE(f.comision_neta, f.comision, 0) + COALESCE(f.monto_mora, 0)
        )::NUMERIC(14, 2)
        FROM public.facturas_mensuales f
        WHERE f.fecha_pago IS NOT NULL
          AND f.fecha_pago >= v_inicio_mes AND f.fecha_pago <= v_fin_mes
      ), 0)
    ),
    'crm', jsonb_build_object(
      'prospectos_total', (SELECT COUNT(*)::INT FROM public.prospectos_venues),
      'por_estado', COALESCE((
        SELECT jsonb_object_agg(estado_comercial, cnt)
        FROM (
          SELECT estado_comercial, COUNT(*)::INT AS cnt
          FROM public.prospectos_venues
          GROUP BY estado_comercial
        ) s
      ), '{}'::JSONB)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_estadisticas_plataforma() TO authenticated;

COMMENT ON FUNCTION public.obtener_estadisticas_plataforma IS
  'KPIs agregados para dashboard superadmin. Requiere es_admin_plataforma().';
