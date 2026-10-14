#!/usr/bin/env bash
# Imprime SHA-1 y SHA-256 del debug.keystore (emulador / expo run:android).
# Uso: bash scripts/print-debug-android-sha.sh [jugador|dueno]

set -euo pipefail

APP="${1:-jugador}"
if [[ "$APP" != "jugador" && "$APP" != "dueno" ]]; then
  echo "Uso: bash scripts/print-debug-android-sha.sh [jugador|dueno]"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYSTORE="$ROOT/apps/$APP/android/app/debug.keystore"
JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"

if [[ ! -f "$KEYSTORE" ]]; then
  echo "❌ No existe $KEYSTORE — corré prebuild primero."
  exit 1
fi

echo "Debug keystore: apps/$APP/android/app/debug.keystore"
echo "Package: com.armemosla.$APP"
echo
"$JAVA_HOME/bin/keytool" -list -v \
  -keystore "$KEYSTORE" \
  -alias androiddebugkey \
  -storepass android -keypass android \
  | rg "SHA1:|SHA256:"

cat <<'EOF'

Agregá esos SHA en Firebase → Project settings → app Android com.armemosla.<app>:
  https://console.firebase.google.com/project/armemosla/settings/general

Luego descargá google-services.json y copiá a:
  apps/<app>/google-services.json
  apps/<app>/android/app/google-services.json

Reinstalá: adb uninstall com.armemosla.<app> && pnpm <app>:android
EOF
