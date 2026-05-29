# Logros: error `evaluar_logros_jugador` no encontrada (PGRST202)

Si en la consola de la app ves:

```text
Could not find the function public.evaluar_logros_jugador(p_user_id) in the schema cache
```

**La base remota no tiene aplicada la migración de evaluación.** La app sigue mostrando Logros, pero el progreso puede estar desactualizado hasta que ejecutes el SQL.

## Orden en Supabase → SQL Editor

Ejecutá **en este orden** (cada archivo completo, una vez):

| # | Archivo |
|---|---------|
| 1 | `30_logros_recompensas.sql` |
| 2 | `31_factura_descuentos_canje.sql` |
| 3 | `32_logros_evaluacion.sql` ← crea `evaluar_logros_jugador` |
| 4 | `33_seed_logros_iniciales.sql` |
| 5 | `37_logros_sync_grants.sql` ← opcional (permisos; también en 32/38) |
| 6 | **`38_auto_completar_con_logros.sql`** ← **cron + evaluación de logros** |

Opcional: `34_seed_logro_fiel_19_de_20.sql` (datos de prueba).

## Recargar API de Supabase

Después del paso 3, en el SQL Editor:

```sql
NOTIFY pgrst, 'reload schema';
```

(O esperá 1–2 minutos; a veces el caché se actualiza solo.)

## Recalcular tu progreso (una vez)

```sql
DO $$
DECLARE v_uid UUID;
BEGIN
  SELECT id INTO v_uid FROM public.profiles
  WHERE lower(trim(email)) = lower(trim('TU_CORREO@gmail.com'));
  IF v_uid IS NOT NULL THEN
    PERFORM public.evaluar_logros_jugador(v_uid);
  END IF;
END $$;
```

## Comprobar que existe la función

```sql
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE proname = 'evaluar_logros_jugador';
```

Deberías ver: `evaluar_logros_jugador | p_user_id uuid`.
