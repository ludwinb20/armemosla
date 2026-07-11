# Pagos por transferencia bancaria

Flujo operativo para cobro de comisiones mensuales a administradores de complejos en Honduras.

## Resumen

1. El admin de complejo ve su factura en **Pagos** (mes anterior, disponible desde el día 1).
2. Transfiere a una cuenta bancaria de Armemosla (BAC, Ficohsa o Atlántida en seed).
3. En la app: **Reportar transferencia** → monto, referencia bancaria, opcional factura RTN.
4. La factura pasa a estado `en_revision` (sin mora ni ocultamiento de complejos).
5. Un **Admin Plataforma** revisa en la tab **Revisión pagos** y confirma o rechaza.
6. Cuando la suma de transferencias confirmadas ≥ total, la factura queda `pagado`.
7. Si solicitó RTN y tiene datos fiscales, se genera `facturas_fiscales` (PDF descargable).

## Cuentas de prueba recomendadas

Usá **dos usuarios distintos** (no mezclar roles en la misma cuenta):

| Rol | Email sugerido | Configuración |
|-----|----------------|---------------|
| Admin plataforma | Tu email personal o `demo.plataforma@armemosla.test` | `es_admin_plataforma = true` |
| Admin de complejo | `demo.admin@armemosla.test` | `user_type = Administrador de Cancha`, seed `50_seed_admin_complejo_demo_pagos.sql` |

Contraseña demo sugerida al crear en Auth: `Demo1234!`

### Setup rápido

1. Supabase → Authentication → Users → crear `demo.admin@armemosla.test`
2. Ejecutar `db_settings/50_seed_admin_complejo_demo_pagos.sql` (requiere `demo.jugador1` del seed 22)
3. En tu cuenta de plataforma:
   ```sql
   UPDATE public.profiles SET es_admin_plataforma = true WHERE email = 'tu-email@...';
   ```

El admin demo queda con factura de **abril 2026** (~L 400 de comisión por 5 reservas completadas).

## Despliegue SQL

Ejecutar en orden en Supabase SQL Editor:

1. `db_settings/48_pagos_transferencias.sql`
2. `db_settings/49_seed_pagos_transferencias.sql`
3. `db_settings/50_seed_admin_complejo_demo_pagos.sql` (opcional, demo)
4. `db_settings/52_solicitudes_reembolso.sql`
5. `db_settings/53_seed_revision_pagos_demo.sql` (opcional, demo cola de revisión)

## Reembolsos

### ¿Cómo se devuelve el dinero?

**Hoy no hay devolución bancaria automática** desde la app. El flujo operativo es:

1. Armemosla transfiere manualmente al admin del complejo (misma vía bancaria que usó para pagar).
2. En la app, el admin plataforma **registra** el reembolso para que el sistema ajuste la factura.
3. La transferencia pasa a `reembolsada` y deja de contar como pago confirmado.
4. Si el total confirmado ya no cubre la factura, vuelve a `en_revision` o impaga.

**No se descuenta automáticamente de facturas futuras.** Eso podría agregarse como fase 2 (saldo a favor / crédito en próxima factura), pero no está implementado.

### Dos flujos (coexisten)

| Flujo | Quién inicia | Uso |
|-------|--------------|-----|
| **Solicitud** | Admin complejo en Pagos → "Solicitar reembolso" | Plataforma aprueba o rechaza en **Por revisar**. |
| **Directo** | Admin plataforma en **Reembolso directo** | Casos detectados por Armemosla sin solicitud previa. |

Al aprobar una solicitud o registrar un reembolso directo, el admin complejo ve el mensaje en su historial de Pagos.


Solo vía SQL (no configurable desde la app):

```sql
UPDATE public.profiles
SET es_admin_plataforma = true
WHERE email = 'tu-email@ejemplo.com';
```

Verificar:

```sql
SELECT id, email, es_admin_plataforma FROM public.profiles WHERE es_admin_plataforma = true;
```

El usuario verá solo las tabs **Inicio** (revisión de pagos) y **Perfil**, aunque no tenga `user_type` definido. Al iniciar sesión aterriza directamente en esa vista.

## Edge Functions

Desplegar notificaciones push:

```bash
pnpm supabase:functions:deploy:push
```

Incluye `dispatch-notification`, `cron-push-notifications` y el wrapper legacy `notify-admins-pago-pendiente`.

Configurar cron de `cron-push-notifications` cada 15 min con `CRON_SECRET` (ver [`docs/PUSH_NOTIFICATIONS.md`](PUSH_NOTIFICATIONS.md)).

Ejecutar SQL: `db_settings/54_push_notifications.sql`

## Push al admin complejo (outbound)

Tras acciones de plataforma, el admin complejo recibe push automático:

| Evento | Cuándo |
|--------|--------|
| Pago confirmado / rechazado | Revisión pagos |
| Factura pagada | Al cubrir el total o pago con tarjeta |
| Reembolso aprobado / rechazado / directo | Revisión pagos |

Tras reportar transferencia o solicitar reembolso, los **admins plataforma** reciben push (cola de revisión).

## Push tokens

Los dispositivos registran tokens en `push_tokens` al obtener el token Expo y tener sesión activa (`usePushNotifications`). Las edge functions leen esos tokens para enviar notificaciones.

## Pagos parciales

- Se permiten múltiples transferencias por factura.
- La factura permanece `en_revision` hasta cubrir el total.
- El admin puede reportar montos menores al pendiente.

## Datos fiscales (RTN)

- El admin configura razón social y RTN en **Perfil → Datos de facturación**.
- Tras emitir la primera factura fiscal, los datos quedan bloqueados.
- Emisor (Armemosla): tabla `emisor_fiscal_config` — solo SQL.

### Renovar CAI

Cuando venza el CAI del emisor:

```sql
-- Desactivar emisor anterior
UPDATE public.emisor_fiscal_config SET activo = false WHERE activo = true;

-- Insertar nuevo emisor con CAI y fechas vigentes
INSERT INTO public.emisor_fiscal_config (
  razon_social, rtn, cai, fecha_emision, fecha_limite_emision, activo
) VALUES (
  'Armemosla S.A. de C.V.',
  '08019999001234',
  'NUEVO-CAI-AQUI',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '365 days',
  true
);

INSERT INTO public.emisor_fiscal_correlativo (emisor_fiscal_id, ultimo_numero)
SELECT id, 0 FROM public.emisor_fiscal_config WHERE activo = true
ON CONFLICT (emisor_fiscal_id) DO NOTHING;
```

El correlativo continúa en `emisor_fiscal_correlativo` por emisor.

## PixelPay / PayPal

El código de PixelPay y PayPal se mantiene en el repositorio pero **sin entrada en la UI** de pagos. Para reactivarlo en el futuro, restaurar navegación a `app/pagar-factura.tsx`.

## Estados de factura

| Estado       | Descripción                                      |
|-------------|---------------------------------------------------|
| pendiente   | Disponible para pago, antes del día 20           |
| retrasado   | Pasó el día 20, acumula mora                     |
| en_revision | Transferencia reportada, en revisión manual      |
| pagado      | Total cubierto con transferencias confirmadas    |
