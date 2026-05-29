# auto-completar-reservas

Marca como `completada` las reservas `pendiente` cuyo inicio (`fecha_hora`) fue hace más de 30 minutos. Invoca la RPC `public.auto_completar_reservas` (ver `db_settings/12_reservas_auto_completar.sql` y `32_logros_evaluacion.sql`).

**La app móvil ya no llama esta lógica al abrir Mis Potras o Reservas**; debe ejecutarse solo por cron.

## Secretos (Supabase Dashboard → Edge Functions → Secrets)

| Secret | Descripción |
|--------|-------------|
| `CRON_SECRET` | Token largo; el cron lo envía en cada request |
| `SUPABASE_SERVICE_ROLE_KEY` | Suele inyectarse al desplegar; necesario para la RPC |

`SUPABASE_URL` también lo provee el runtime al desplegar.

## Desplegar

Primera vez (en la raíz del repo):

```bash
pnpm install
pnpm supabase login
pnpm supabase link --project-ref <TU_PROJECT_REF>
```

Luego:

```bash
pnpm run supabase:functions:deploy:auto-completar
```

Equivalente: `pnpm exec supabase functions deploy auto-completar-reservas --no-verify-jwt`

(O desde el dashboard: pegar el código de `index.ts` y desplegar desde la UI.)

## Cron (Supabase Dashboard)

1. **Edge Functions** → `auto-completar-reservas` → **Schedules** (o Cron Jobs / Scheduled triggers según tu plan).
2. Frecuencia sugerida: cada **10–15 minutos** (`*/15 * * * *`).
3. Método: `POST`
4. URL: `https://<PROJECT_REF>.supabase.co/functions/v1/auto-completar-reservas`
5. Headers (uno de los dos):
   - `Authorization: Bearer <CRON_SECRET>`
   - o `x-cron-secret: <CRON_SECRET>`

## Probar manualmente

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/auto-completar-reservas" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Respuesta esperada: `{"ok":true,...}`

## SQL equivalente (solo prueba en editor)

```sql
SELECT public.auto_completar_reservas();
```
