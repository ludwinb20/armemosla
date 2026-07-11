# Notificaciones push (Expo)

Infraestructura de push remota para **armemosla** usando **Expo Push Notifications**. No hay Firebase Messaging SDK en el cliente móvil.

## Stack

| Componente | Valor |
|------------|-------|
| Servicio | [Expo Push API](https://docs.expo.dev/push-notifications/overview/) |
| Token esperado | `ExponentPushToken[...]` |
| iOS | APNs (vía Expo) |
| Android | FCM (vía Expo) |
| Envío backend | `POST https://exp.host/--/api/v2/push/send` |
| Bundle iOS | `com.armemosla.app` |
| Package Android | `com.armemosla.app` |
| Expo owner | `ludwinb` |
| EAS projectId | `845ee3c3-eebd-4ae8-a15a-a2060ccc3d77` |

## Configuración en el repo

- Plugin: `expo-notifications` en [`app.json`](../app.json)
- `newArchEnabled: true`
- iOS: `UIBackgroundModes` incluye `remote-notification`
- Android: `useNextNotificationsApi: true`, `google-services.json`
- Setup de cliente: [`lib/push/setup.ts`](../lib/push/setup.ts)
- Hook raíz: [`hooks/usePushNotifications.ts`](../hooks/usePushNotifications.ts) (llamado desde [`app/_layout.tsx`](../app/_layout.tsx))

Al arrancar en **dispositivo físico**, la consola debe mostrar:

```
✅ Expo Push Token: ExponentPushToken[xxxxxxxxxxxxxx]
```

## Lo que NO usamos en móvil

- `@react-native-firebase/messaging`
- Tokens APNs nativos enviados directo a FCM
- Expo Go para validar push en producción (usar **EAS Build** / dev client)

## Credenciales EAS (obligatorio para recibir pushes)

### iOS — APNs Key

```bash
pnpm exec eas credentials
# Seleccionar iOS → Push Notifications → configurar APNs Key (.p8)
```

Sin APNs Key en EAS, iOS puede generar token pero **no recibirá** notificaciones.

### Android — FCM

1. Firebase Console → proyecto `armemosla` → descargar `google-services.json`
2. Colocarlo en la raíz del repo (ya referenciado en `app.json`)
3. Vincular FCM en EAS:

```bash
pnpm exec eas credentials
# Android → Push Notifications (FCM)
```

## Build

Perfiles en [`eas.json`](../eas.json):

| Perfil | Uso |
|--------|-----|
| `development` | Dev client, distribución internal |
| `preview` | QA en dispositivo físico |
| `production` | Store (AAB iOS + app-bundle Android) |

```bash
pnpm exec eas build --platform ios --profile preview
pnpm build:android:apk
# equivalente: pnpm exec eas build --platform android --profile preview
```

### Instalar APK en tu teléfono Android

1. **Credenciales FCM** (una vez): `pnpm exec eas credentials` → Android → Push Notifications.
2. **Generar APK**:
   ```bash
   pnpm build:android:apk
   ```
3. Cuando termine el build, EAS muestra un **enlace de descarga** (también en [expo.dev](https://expo.dev) → Projects → armemosla → Builds).
4. Abrí ese enlace **desde el teléfono** (o descargá el `.apk` y transferilo).
5. Android puede pedir **“Instalar apps desconocidas”** para el navegador o gestor de archivos — habilitalo.
6. Instalá, abrí la app, aceptá notificaciones y copiá el `ExponentPushToken[...]` del log.
7. Probá push:
   ```bash
   pnpm test:push ExponentPushToken[TU_TOKEN] "Prueba" "Hola desde armemosla"
   ```

El perfil `preview` usa `buildType: apk` (instalable directo). `production` genera **AAB** para Play Store, no APK sideload.

**Importante:** no uses `pnpm exec eas build` sin flags — EAS puede elegir el perfil `production` y generar `.aab`. Para APK siempre:

```bash
pnpm build:android:apk
# equivalente directo:
pnpm exec eas build --platform android --profile preview
```

No uses `pnpm exec eas build` sin `--profile preview` (EAS puede elegir `production` → `.aab`).
No uses `pnpm exec eas-cli` — el binario se llama **`eas`**, no `eas-cli`.

Tras cambios en `app.json` que afecten nativo, regenerar con `pnpm prebuild` o dejar que EAS Build lo haga en la nube.

## Probar envío

### Script en el repo

1. Instalá la app en **dispositivo físico** y copiá el token del log.
2. Enviá una push de prueba:

```bash
pnpm test:push ExponentPushToken[TU_TOKEN] "Título" "Mensaje de prueba"
```

Con opciones:

```bash
pnpm test:push --token ExponentPushToken[TU_TOKEN] --title "Hola" --body "Desde terminal" --data '{"type":"test"}'
```

También podés exportar el token:

```bash
export EXPO_PUSH_TOKEN='ExponentPushToken[...]'
pnpm test:push --title "Prueba" --body "Hola"
```

### Herramienta web

1. Instalar build preview/dev en **dispositivo físico**
2. Abrir app y copiar el token del log (`ExponentPushToken[...]`)
3. Ir a https://expo.dev/notifications
4. Pegar token, título y cuerpo → Send

También podés enviar con curl:

```bash
curl -H "Content-Type: application/json" \
  -X POST https://exp.host/--/api/v2/push/send \
  -d '{
    "to": "ExponentPushToken[REEMPLAZAR]",
    "title": "Prueba armemosla",
    "body": "Push de prueba desde Expo",
    "sound": "default"
  }'
```

## Checklist de éxito

- [ ] Log con `ExponentPushToken[...]` (no hex de 64 chars APNs)
- [ ] Push de prueba llega con app en foreground
- [ ] Push de prueba llega con app en background
- [ ] Probado en dispositivo físico (no simulador)
- [ ] Token guardado en `push_tokens` tras login
- [ ] Tocar notificación navega a la pantalla correcta

## Despliegue backend

### SQL

Ejecutar en Supabase SQL Editor (después de migraciones anteriores):

```
db_settings/54_push_notifications.sql
```

### Edge Functions

```bash
pnpm supabase:functions:deploy:push
```

Despliega:

- `dispatch-notification` — eventos inmediatos desde la app
- `cron-push-notifications` — recordatorios, mora, outbox SQL (requiere `--no-verify-jwt`)
- `notify-admins-pago-pendiente` — wrapper legacy (compatibilidad)

### Cron (Supabase Dashboard)

Configurá **dos** crons si aún no existen (`auto-completar-reservas` y push):

#### A) `cron-push-notifications` (notificaciones programadas)

1. Supabase → **Edge Functions** → `cron-push-notifications` → **Schedules** (o Cron Jobs)
2. Crear schedule:
   - **Nombre:** `push-notifications-15m`
   - **Cron:** `*/15 * * * *` (cada 15 minutos)
   - **HTTP method:** `POST`
   - **URL:** `https://<TU_PROJECT_REF>.supabase.co/functions/v1/cron-push-notifications`
   - **Headers:**
     ```
     Authorization: Bearer <CRON_SECRET>
     ```
     (alternativa: header `x-cron-secret: <CRON_SECRET>`)

#### B) Secret `CRON_SECRET`

1. Supabase → **Project Settings** → **Edge Functions** → **Secrets**
2. Si no existe, agregar:
   - **Name:** `CRON_SECRET`
   - **Value:** token largo aleatorio (mismo que uses para `auto-completar-reservas`)

#### C) Qué hace el cron de push

- Procesa cola `push_notification_outbox` (logros, canje QR)
- Mora / facturas retrasadas / nuevas / por vencer
- Recordatorios de reserva (24h y 2h antes)
- Recordatorio partido confirmado (2h antes)
- Digest admins plataforma (9:00 AM Honduras, items > 24h en revisión)

#### D) SQL adicional retos directos

Ejecutar también:

```
db_settings/55_retos_directos_respuesta.sql
```

(RPCs aceptar/rechazar/cancelar; la respuesta push va desde la app, no desde cron.)

#### Prueba manual del cron

```bash
curl -X POST "https://<PROJECT_REF>.supabase.co/functions/v1/cron-push-notifications" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Respuesta esperada: `{"ok":true,"sent":0}` (o `sent` > 0 si había pendientes).

## Catálogo de notificaciones

Cliente: [`lib/push/dispatchNotification.ts`](../lib/push/dispatchNotification.ts) → edge `dispatch-notification`.

| `data.type` | Evento | Destinatario |
|-------------|--------|--------------|
| `pago_pendiente` | Admin complejo reporta transferencia | Admins plataforma |
| `solicitud_reembolso_nueva` | Admin complejo solicita reembolso | Admins plataforma |
| `pago_confirmado` | Plataforma confirma transferencia | Admin complejo |
| `pago_rechazado` | Plataforma rechaza transferencia | Admin complejo |
| `factura_pagada` | Factura cubierta / pagada | Admin complejo |
| `pago_tarjeta_ok` | PayPal / PixelPay exitoso | Admin complejo |
| `reembolso_aprobado` / `reembolso_rechazado` | Respuesta a solicitud reembolso | Admin complejo |
| `reembolso_directo` | Reembolso registrado por plataforma | Admin complejo |
| `reserva_nueva` | Jugador reserva cancha | Dueño del complejo |
| `reserva_cancelada` | Jugador cancela reserva | Dueño del complejo |
| `reserva_cancelada_admin` | Admin cancela reserva de jugador | Jugador |
| `solicitud_partido_nueva` | Reto a partido en piscina | Creador del partido |
| `solicitud_aceptada` / `solicitud_rechazada` | Respuesta a solicitud | Miembros del equipo solicitante |
| `mensaje_solicitud` | Nuevo mensaje en chat de solicitud | Contraparte |
| `reto_directo_nuevo` | Invitación directa a jugador | Jugador objetivo |
| `reto_directo_respuesta` | Acepta/rechaza reto (SQL trigger) | Creador del reto |
| `match_encontrado` | Rivales compatibles al publicar | Creador del partido |
| `logro_desbloqueado` | Logro completado (SQL trigger) | Jugador |
| `recompensa_canjeada` | Admin escanea QR (RPC) | Jugador |
| `factura_retrasada` / `factura_nueva` / `factura_por_vencer` | Cron mora / día 1 / vencimiento | Admin complejo |
| `complejos_ocultos` | Cron impago | Admin complejo |
| `recordatorio_reserva` | Cron 24h / 2h antes | Jugador |
| `recordatorio_partido` | Cron partido confirmado 2h antes | Ambos lados |
| `revision_pendiente_digest` | Cron diario 9:00 | Admins plataforma |

Navegación al tocar: [`lib/push/navigation.ts`](../lib/push/navigation.ts).

## Troubleshooting

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| No aparece token | Simulador/emulador | Usar dispositivo físico |
| Warning `aps-environment` | Build sin capability push | EAS credentials iOS + rebuild |
| Token null, sin projectId | Falta `extra.eas.projectId` | Verificar [`app.json`](../app.json) |
| Permisos denegados | Usuario rechazó notificaciones | Ajustes del sistema → Notificaciones |
| Android no muestra push | Canal no creado | Ver [`lib/push/setup.ts`](../lib/push/setup.ts) canal `default` |
| iOS dev OK, prod no | `aps-environment: development` vs production | Credenciales APNs production en EAS + build release |
| Push no llega en Android | FCM no vinculado en EAS | `eas credentials` → FCM |

## Referencias

- [Expo Push Notifications setup](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Sending notifications](https://docs.expo.dev/push-notifications/sending-notifications/)
