# Google Sign-In Android (DEVELOPER_ERROR / “Google no reconoce esta compilación”)

## Causa

Google Sign-In falla con `DEVELOPER_ERROR (10)` cuando el **package + SHA** de la build instalada no están registrados en Firebase/Google Cloud para esa app Android.

Hay **dos keystores distintos**:

| Origen | Keystore | Cuándo aplica |
|--------|----------|---------------|
| **Emulador / `pnpm jugador:android`** | `android/app/debug.keystore` (debug) | Desarrollo local |
| **APK preview EAS** | Keystore de EAS | Celular con build de Expo |

### SHA — emulador (debug)

| App | Package | SHA-1 | SHA-256 |
|-----|---------|-------|---------|
| Jugador | `com.armemosla.jugador` | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` | `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C` |

Imprimir de nuevo: `bash scripts/print-debug-android-sha.sh jugador`

### SHA — EAS preview (celular)

| App | Package | SHA-1 (keystore EAS preview) | SHA-256 |
|-----|---------|------------------------------|---------|
| Jugador | `com.armemosla.jugador` | `F9:A1:AD:41:04:54:BF:82:CC:39:93:F5:EA:43:1B:22:F3:C7:67:40` | `86:EE:C7:7D:56:FC:C9:CB:93:02:4C:A1:BC:AC:E7:E9:F7:0F:61:E2:EB:12:3B:7D:F9:67:EE:81:05:D3:CD:61` |
| Dueño | `com.armemosla.dueno` | `1B:C2:FA:15:FC:92:3B:2D:06:61:CB:4B:05:32:F7:BF:2E:92:C1:63` | `04:4A:A5:6F:3B:16:6B:05:32:F7:15:4A:BE:7B:E9:9A:24:C0:23:32:A7:1B:D3:1F:D6:48:EB:18:81:CB:DE:0C` |

Imprimir EAS: `bash scripts/print-eas-android-sha.sh jugador`

## Pasos

### 1. Firebase

https://console.firebase.google.com/project/armemosla/settings/general

1. **Add app** Android (o edita):
   - Jugador → `com.armemosla.jugador` + SHA-1/SHA-256 de la tabla
   - Dueño → `com.armemosla.dueno` + SHA-1/SHA-256 de la tabla
2. Descargá el `google-services.json` de **cada** app.

### 2. Google Cloud OAuth (Android)

https://console.cloud.google.com/apis/credentials

Creá un cliente OAuth **tipo Android** por package con el SHA-1 de arriba (si Firebase no lo creó solo).

El Web client (`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`) se deja igual.

### 3. Copiar JSON y rebuild

```bash
cp ~/Downloads/google-services.json apps/jugador/google-services.json
cp ~/Downloads/google-services.json apps/jugador/android/app/google-services.json
# (usar el JSON de la app dueño para dueno)
cp ~/Downloads/google-services-dueno.json apps/dueno/google-services.json
cp ~/Downloads/google-services-dueno.json apps/dueno/android/app/google-services.json

pnpm build:android:preview:jugador
pnpm build:android:preview:dueno
```

Sin rebuild, el APK instalado sigue con el JSON viejo.

## Si regenerás el keystore en EAS

Los SHA cambian. Volvé a sacar huellas:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
"$HOME/Library/Android/sdk/build-tools/37.0.0/apksigner" verify --print-certs ruta.apk
```

O mirá https://expo.dev/accounts/ludwinb/projects/armemosla-jugador/credentials (y lo mismo para `armemosla-dueno`).
