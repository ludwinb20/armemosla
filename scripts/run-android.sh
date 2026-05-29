#!/usr/bin/env bash
# Build e instala la app en el emulador/dispositivo Android con Metro accesible desde el emulador.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "❌ No se encontró Java en JAVA_HOME=$JAVA_HOME"
  echo "   Instalá Android Studio o definí JAVA_HOME manualmente."
  exit 1
fi

# El emulador Android accede al Metro del Mac vía localhost + port forwarding
adb reverse tcp:8081 tcp:8081 2>/dev/null || true
export REACT_NATIVE_PACKAGER_HOSTNAME=localhost

# Reanimated 4 depende de libworklets.so; con --configure-on-demand a veces no se compila a tiempo.
WORKLETS_SO_PATH="$ROOT/node_modules/react-native-worklets/android/build/intermediates/cmake/debug/obj/arm64-v8a/libworklets.so"

clean_native_cmake_cache() {
  rm -rf \
    "$ROOT/node_modules/react-native-worklets/android/.cxx" \
    "$ROOT/node_modules/react-native-worklets/android/build" \
    "$ROOT/node_modules/react-native-reanimated/android/.cxx" \
    "$ROOT/node_modules/react-native-reanimated/android/build"
  find "$ROOT/node_modules/.pnpm" -type d -path "*/react-native-worklets*/node_modules/react-native-worklets/android/.cxx" -prune -exec rm -rf {} + 2>/dev/null || true
  find "$ROOT/node_modules/.pnpm" -type d -path "*/react-native-worklets*/node_modules/react-native-worklets/android/build" -prune -exec rm -rf {} + 2>/dev/null || true
  find "$ROOT/node_modules/.pnpm" -type d -path "*/react-native-reanimated*/node_modules/react-native-reanimated/android/.cxx" -prune -exec rm -rf {} + 2>/dev/null || true
}

# pnpm hoisted: Gradle compila worklets dentro de .pnpm pero Reanimated busca libworklets.so en node_modules/ raíz.
sync_worklets_build_to_hoisted() {
  local pnpm_worklets_dir
  pnpm_worklets_dir="$(find "$ROOT/node_modules/.pnpm" -type d -path "*/node_modules/react-native-worklets/android/build" 2>/dev/null | head -1 || true)"
  if [[ -z "$pnpm_worklets_dir" ]]; then
    return 0
  fi
  pnpm_worklets_dir="$(dirname "$pnpm_worklets_dir")"
  mkdir -p "$ROOT/node_modules/react-native-worklets/android"
  rm -rf "$ROOT/node_modules/react-native-worklets/android/build"
  ln -sfn "$pnpm_worklets_dir/build" "$ROOT/node_modules/react-native-worklets/android/build"
  echo "🔗 Sincronizado android/build de worklets (pnpm → node_modules hoisted)"
}

build_native_animation_libs() {
  echo "🔧 Compilando worklets + reanimated (nativo)..."
  (
    cd "$ROOT/android"
    ./gradlew \
      ':react-native-worklets:buildCMakeDebug[arm64-v8a][worklets]' \
      -PreactNativeArchitectures=arm64-v8a \
      --no-configure-on-demand \
      --no-build-cache
  )
  sync_worklets_build_to_hoisted
  (
    cd "$ROOT/android"
    ./gradlew \
      ':react-native-reanimated:buildCMakeDebug[arm64-v8a][reanimated]' \
      -PreactNativeArchitectures=arm64-v8a \
      --no-configure-on-demand \
      --no-build-cache
  )
}

if [[ "${1:-}" == "--clean-native" ]]; then
  clean_native_cmake_cache
  build_native_animation_libs
  shift
fi

# Si falló antes por libworklets.so faltante, forzar rebuild nativo una vez
if [[ ! -f "$WORKLETS_SO_PATH" ]]; then
  echo "⚠️  libworklets.so no encontrada; limpiando y recompilando módulos nativos..."
  clean_native_cmake_cache
  build_native_animation_libs
fi

exec pnpm exec expo run:android "$@"
