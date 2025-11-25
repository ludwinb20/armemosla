# 🗺️ Configuración de Google Maps

Esta guía te ayudará a configurar Google Maps en tu aplicación para que puedas usar el selector de ubicación con coordenadas.

**Nota**: Esta aplicación usa `expo-maps`, la solución oficial de Expo para mapas, que es más compatible y fácil de configurar que `react-native-maps`.

## 📋 Requisitos Previos

- Una cuenta de Google Cloud Platform
- Un proyecto en Google Cloud Console
- Acceso a la consola de Google Cloud

## 🔧 Pasos de Configuración

### 1. Crear/Seleccionar Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Selecciona tu proyecto existente o crea uno nuevo
3. Asegúrate de que la facturación esté habilitada (Google Maps requiere facturación activa)

### 2. Habilitar Google Maps SDK

1. En la consola, ve a **APIs & Services** > **Library**
2. Busca y habilita las siguientes APIs:
   - **Maps SDK for Android** (para Android)
   - **Maps SDK for iOS** (para iOS)

### 3. Crear API Keys

#### Para Android:

1. Ve a **APIs & Services** > **Credentials**
2. Haz clic en **Create Credentials** > **API Key**
3. Se creará una nueva API key
4. Haz clic en **Restrict Key** para configurar restricciones:
   - **Application restrictions**: Selecciona **Android apps**
   - Haz clic en **Add an item**
   - Ingresa el **Package name**: `com.armemosla.app`
   - Para obtener el **SHA-1 certificate fingerprint**:
     ```bash
     # Para desarrollo (debug keystore)
     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
     
     # Para producción (necesitarás tu keystore de producción)
     keytool -list -v -keystore path/to/your/keystore.jks -alias your-alias
     ```
   - Copia el SHA-1 y pégalo en el campo correspondiente
   - **API restrictions**: Selecciona **Restrict key**
   - Marca solo: **Maps SDK for Android**
   - Guarda los cambios

#### Para iOS:

1. Crea otra API key (o usa la misma si no aplicas restricciones de aplicación)
2. Haz clic en **Restrict Key**:
   - **Application restrictions**: Selecciona **iOS apps**
   - Haz clic en **Add an item**
   - Ingresa el **Bundle identifier**: `com.armemosla.app`
   - **API restrictions**: Selecciona **Restrict key**
   - Marca solo: **Maps SDK for iOS**
   - Guarda los cambios

### 4. Configurar en la Aplicación

#### Android (`app.json`):

Ya está configurado en `app.json`:

```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "TU_API_KEY_DE_ANDROID_AQUI"
    }
  }
}
```

**Reemplaza** `"apiKey": ""` con tu API key de Android.

#### iOS (`app.json`):

Para iOS, necesitas agregar la API key en el archivo `GoogleService-Info.plist`:

1. Abre `GoogleService-Info.plist`
2. Agrega o actualiza la clave `API_KEY` con tu API key de iOS:

```xml
<key>API_KEY</key>
<string>TU_API_KEY_DE_IOS_AQUI</string>
```

**Nota**: Si ya tienes un `API_KEY` en `GoogleService-Info.plist`, asegúrate de que sea la misma API key que configuraste para Maps SDK for iOS, o crea una nueva específica para Maps.

### 5. Configuración Alternativa (Variables de Entorno)

Si prefieres usar variables de entorno, puedes agregar en `app.json`:

```json
"extra": {
  "googleMapsAndroidApiKey": "TU_API_KEY_ANDROID",
  "googleMapsIosApiKey": "TU_API_KEY_IOS"
}
```

Y luego actualizar el código para leerlas desde `expo-constants`.

### 6. Rebuild de la Aplicación

**IMPORTANTE**: Después de agregar las API keys, necesitas hacer un rebuild nativo:

```bash
# Limpiar y regenerar carpetas nativas
pnpm prebuild:clean

# O si prefieres usar EAS Build
eas build --profile development --platform android
eas build --profile development --platform ios
```

**No funcionará en Expo Go** - necesitas un build nativo porque `expo-maps` requiere código nativo.

## ✅ Verificación

1. Ejecuta la app en un dispositivo/emulador con el build nativo
2. Ve al formulario de complejo deportivo
3. Selecciona "Coordenadas" como modo de dirección
4. Toca "Seleccionar ubicación en el mapa"
5. Deberías ver el mapa de Google Maps cargándose

## 🔒 Seguridad

- **Nunca** subas tus API keys a repositorios públicos
- Usa restricciones de API keys (solo las APIs necesarias)
- Usa restricciones de aplicación (solo tu bundle ID/package name)
- Para producción, considera usar diferentes API keys para desarrollo y producción

## 🐛 Solución de Problemas

### El mapa no se carga / Muestra error

1. Verifica que las APIs estén habilitadas en Google Cloud Console
2. Verifica que la API key esté correctamente configurada
3. Verifica que la facturación esté habilitada
4. Revisa los logs de la consola para errores específicos
5. Asegúrate de haber hecho un rebuild nativo después de agregar la API key

### Error: "API key not valid"

- Verifica que la API key sea correcta
- Verifica que las restricciones de aplicación coincidan con tu bundle ID/package name
- Verifica que las restricciones de API incluyan Maps SDK

### El mapa se ve gris

- Verifica que la facturación esté habilitada en Google Cloud
- Verifica que las APIs de Maps estén habilitadas
- Verifica que la API key tenga los permisos correctos

## 📚 Recursos Adicionales

- [Documentación de react-native-maps](https://github.com/react-native-maps/react-native-maps)
- [Google Maps Platform](https://developers.google.com/maps)
- [Configuración de API Keys](https://developers.google.com/maps/api-security-best-practices)

