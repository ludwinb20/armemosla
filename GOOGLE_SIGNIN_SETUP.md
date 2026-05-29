# Google Sign-In en Android e iOS (React Native + Supabase)

Esta app usa `@react-native-google-signin/google-signin` y autentica en Supabase con `signInWithIdToken`.  
Por eso, el `clientId` que se usa en la app debe ser el **OAuth Client ID de tipo Web**.

## 1) Requisitos base

- Proyecto Firebase/Google Cloud creado.
- Paquete Android exacto: `com.armemosla.app`.
- Bundle ID iOS exacto: `com.armemosla.app`.
- Provider Google habilitado en Supabase Auth.

## 2) Android: registrar huellas SHA

En Firebase Console, abre tu app Android y agrega:

- SHA-1 de debug local.
- SHA-256 de debug local.
- SHA-1 y SHA-256 de release (builds de EAS/produccion).

Para debug local:

1. Ir a `android/`.
2. Ejecutar `./gradlew signingReport`.
3. Copiar SHA-1 y SHA-256 de la variante `debug`.

Si agregas o cambias SHA, descarga otra vez `google-services.json`.

## 3) Descargar y usar `google-services.json`

1. En Firebase Console > Project settings > Android app.
2. Descargar `google-services.json`.
3. Reemplazar el archivo del proyecto en `google-services.json`.

Si este archivo no coincide con package/SHA actuales, Android suele fallar con `DEVELOPER_ERROR (code 10)`.

## 4) Crear credenciales OAuth correctas

En Google Cloud Console > APIs & Services > Credentials:

- Crear o usar un **OAuth 2.0 Client ID tipo Web**.
- Crear o usar un **OAuth 2.0 Client ID tipo iOS** (solo para URL scheme de iOS).

Importante:

- El flujo de esta app usa el **Web client ID** para Android e iOS al pedir el ID token.
- El client ID Android no se usa en `GoogleSignin.configure` para este flujo con Supabase.

## 5) Variables de entorno

Configurar en `.env`:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<oauth_web_client_id>`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<oauth_ios_client_id>`

La app usa `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` en `GoogleSignin.configure({ webClientId })`.

## 6) Configuración de Supabase

En Supabase > Authentication > Providers > Google:

- Activar Google provider.
- Cargar Client ID y Client Secret del OAuth **Web**.

Si Supabase tiene otro Web client ID distinto al de la app, el login falla.

## 7) Regenerar nativo

Cada cambio en plugins/config nativa requiere regenerar y reinstalar:

1. `pnpm prebuild:clean`
2. `pnpm android` (o build de EAS para release)

## 8) Checklist de verificación

1. Android abre selector de cuentas Google.
2. No aparece `DEVELOPER_ERROR (10)`.
3. Se obtiene `idToken`.
4. `supabase.auth.signInWithIdToken` devuelve `session`.
5. La app redirige después del login.
6. iOS sigue funcionando.

## 9) Errores comunes

- `DEVELOPER_ERROR (10)`: SHA faltante o `google-services.json` desactualizado.
- `No se pudo obtener el token`: credencial incorrecta o sesión Google inconsistente.
- Error en Supabase Google Provider: Web client ID/secret mal cargados.
