# 🔐 Configuración de Google Sign-In

## Pasos para configurar Google Sign-In

### 1. Crear proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Google Sign-In:
   - Ve a **APIs & Services > Library**
   - Busca "Google Sign-In API" y habilítala

### 2. Configurar OAuth 2.0

1. Ve a **APIs & Services > Credentials**
2. Haz clic en **Create Credentials > OAuth client ID**
3. Configura la pantalla de consentimiento si es la primera vez
4. Crea credenciales para cada plataforma:

#### iOS:
- **Application type**: iOS
- **Bundle ID**: `com.armemosla.app`
- Copia el **Client ID** (formato: `xxxxx.apps.googleusercontent.com`)

#### Android:
- **Application type**: Android
- **Package name**: `com.armemosla.app`
- **SHA-1 certificate fingerprint**: Necesitas obtenerlo (ver abajo)
- Copia el **Client ID**

#### Web:
- **Application type**: Web application
- **Authorized redirect URIs**: 
  - `https://auth.expo.io/@tu-usuario/armemosla`
  - `exp://localhost:8081`
- Copia el **Client ID**

### 3. Obtener SHA-1 para Android

#### Para desarrollo (debug):
```bash
# Windows
cd android
gradlew signingReport

# Mac/Linux
cd android
./gradlew signingReport
```

Busca el SHA-1 en la salida y agrégalo en Google Cloud Console.

#### Para producción:
Necesitarás el SHA-1 del keystore de producción cuando generes el build.

### 4. Descargar archivos de configuración

#### iOS - GoogleService-Info.plist:
1. En Google Cloud Console, ve a tu proyecto
2. Ve a **APIs & Services > Credentials**
3. Descarga el archivo `GoogleService-Info.plist`
4. Colócalo en la raíz del proyecto: `./GoogleService-Info.plist`

#### Android - google-services.json:
1. En Google Cloud Console, ve a tu proyecto
2. Ve a **APIs & Services > Credentials**
3. Descarga el archivo `google-services.json`
4. Colócalo en la raíz del proyecto: `./google-services.json`

### 5. Configurar variables de entorno

Agrega a tu archivo `.env`:

```env
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=tu_ios_client_id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=tu_android_client_id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=tu_web_client_id.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.armemosla.app
```

### 6. Configurar Supabase para Google Auth

1. Ve a tu proyecto en Supabase
2. Ve a **Authentication > Providers**
3. Habilita **Google**
4. Agrega:
   - **Client ID (for OAuth)**: Tu Web Client ID
   - **Client Secret**: Tu Client Secret (obtenerlo de Google Cloud Console)

### 7. Generar build de desarrollo

Después de configurar todo, necesitas generar un nuevo build porque Google Sign-In requiere código nativo:

```bash
# Para iOS
npx expo prebuild --platform ios
npx expo run:ios

# Para Android
npx expo prebuild --platform android
npx expo run:android
```

O usa EAS Build:

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

## ⚠️ Notas Importantes

1. **Los archivos GoogleService-Info.plist y google-services.json son sensibles** - No los subas a Git si contienen información de producción
2. **SHA-1 cambia** - Necesitarás agregar el SHA-1 de producción cuando generes builds de producción
3. **Web Client ID** - Es el mismo que usas en Supabase
4. **Testing** - Puedes probar en desarrollo, pero necesitas un build nativo (no funciona en Expo Go)

## 🧪 Probar Google Sign-In

1. Genera un build de desarrollo
2. Abre la app
3. Ve a la pantalla de login
4. Presiona el botón de Google Sign-In
5. Deberías ver la pantalla de selección de cuenta de Google

## 📚 Recursos

- [Documentación de @react-native-google-signin](https://github.com/react-native-google-signin/google-signin)
- [Configuración de OAuth en Google Cloud](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google)

