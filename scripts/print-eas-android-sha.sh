#!/usr/bin/env bash
# Imprime SHA-1 y SHA-256 del keystore Android de EAS (preview/production).
# Uso (desde la raíz del monorepo):
#   bash scripts/print-eas-android-sha.sh jugador
#   bash scripts/print-eas-android-sha.sh dueno
#
# Luego agregá esos SHA en Firebase Console → Project settings → Your apps
# para el package correspondiente, descargá google-services.json y rebuild.

set -euo pipefail

APP="${1:-}"
if [[ "$APP" != "jugador" && "$APP" != "dueno" ]]; then
  echo "Uso: bash scripts/print-eas-android-sha.sh <jugador|dueno>"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/apps/$APP"
OUT_DIR="$APP_DIR/credentials-tmp"
mkdir -p "$OUT_DIR"

cd "$APP_DIR"

echo "→ Descargando keystore de EAS para @armemosla/$APP ..."
echo "  (si pide menú interactivo, elegí: credentials → Keystore → Download)"
echo

# eas credentials es interactivo; guía al usuario si no hay EXPO_TOKEN automation
if ! pnpm exec eas whoami >/dev/null 2>&1; then
  echo "No hay sesión EAS. Corré: pnpm exec eas login"
  exit 1
fi

cat <<EOF

Abrí esta URL (ahí EAS muestra SHA-1 / SHA-256):

  https://expo.dev/accounts/ludwinb/projects/armemosla-${APP}/credentials

Package Android esperado:
  - jugador → com.armemosla.jugador
  - dueno   → com.armemosla.dueno

En Firebase (https://console.firebase.google.com/project/armemosla/settings/general):
  1. Agregá/edita la app Android con ese package name
  2. Pegá SHA-1 y SHA-256 del keystore de EAS (Build Credentials)
  3. Descargá google-services.json
  4. Reemplazá:
       apps/${APP}/google-services.json
       apps/${APP}/android/app/google-services.json
  5. Rebuild:
       pnpm --filter @armemosla/${APP} exec eas build -p android --profile preview

EOF

PACKAGE="com.armemosla.${APP}"
if [[ "$APP" == "dueno" ]]; then PACKAGE="com.armemosla.dueno"; fi
echo "Package: $PACKAGE"
