# 🔧 Solución para Error de Build de Android

## Error
```
Execution failed for task ':app:mergeDebugResources'
Resource compilation failed (Failed to compile values resource file)
Can not extract resource from com.android.aaptcompiler.ParsedResource
```

## Causa Probable
Este error generalmente ocurre cuando hay:
1. **Conflictos de recursos** entre dependencias (especialmente Google Play Services)
2. **Caché corrupta** de Gradle o Expo
3. **Recursos duplicados** en archivos XML
4. **Necesidad de prebuild limpio** después de agregar `expo-maps`

## Soluciones (en orden de prioridad)

### 1. Prebuild Limpio (RECOMENDADO)

Después de agregar `expo-maps`, necesitas hacer un prebuild limpio:

```bash
# Limpiar carpetas nativas
pnpm prebuild:clean

# O si estás usando EAS Build, simplemente haz un nuevo build
eas build --profile development --platform android --clear-cache
```

### 2. Limpiar Caché de Gradle (si tienes acceso local)

Si estás compilando localmente:

```bash
cd android
./gradlew clean
./gradlew cleanBuildCache
cd ..
```

### 3. Verificar Configuración de expo-maps

Asegúrate de que `app.json` tenga la configuración correcta:

```json
{
  "expo": {
    "plugins": [
      // ... otros plugins
      [
        "expo-maps",
        {
          "googleMapsApiKey": "TU_API_KEY_AQUI"
        }
      ]
    ],
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "TU_API_KEY_AQUI"
        }
      }
    }
  }
}
```

### 4. Verificar API Key de Google Maps

Asegúrate de que:
- La API key esté correctamente configurada
- La API key tenga habilitado **Maps SDK for Android** en Google Cloud Console
- La API key tenga las restricciones correctas (si aplica)

### 5. Actualizar Dependencias

Si hay dependencias desactualizadas, actualízalas:

```bash
npx expo install --fix
```

**Nota**: Esto puede tomar tiempo y requerir cerrar procesos de Node.js si hay errores de permisos.

### 6. Verificar Conflictos con Google Sign-In

Si el problema persiste, podría haber un conflicto entre `@react-native-google-signin/google-signin` y `expo-maps` (ambos usan Google Play Services).

**Solución temporal**: Comentar temporalmente el plugin de Google Sign-In para verificar:

```json
// Comentar temporalmente para probar
// [
//   "@react-native-google-signin/google-signin",
//   {
//     "iosUrlScheme": "com.googleusercontent.apps.dummy"
//   }
// ],
```

Si esto resuelve el problema, entonces hay un conflicto y necesitarás:
- Actualizar ambas dependencias a versiones compatibles
- O usar una solución alternativa para autenticación con Google

### 7. Build con EAS (Recomendado para producción)

Si estás usando EAS Build, el build limpio debería resolver el problema:

```bash
eas build --profile development --platform android --clear-cache
```

## Pasos Inmediatos

1. **Haz un prebuild limpio**:
   ```bash
   pnpm prebuild:clean
   ```

2. **Si usas EAS Build, haz un build con caché limpia**:
   ```bash
   eas build --profile development --platform android --clear-cache
   ```

3. **Si el problema persiste**, verifica los logs detallados:
   ```bash
   eas build --profile development --platform android --clear-cache --verbose
   ```

## Verificación

Después de aplicar las soluciones, verifica que:
- ✅ El build se complete sin errores
- ✅ La app se instale correctamente
- ✅ El mapa se muestre cuando uses el selector de ubicación

## Notas Adicionales

- Este error es común cuando se agregan nuevas dependencias nativas
- Siempre haz un prebuild limpio después de agregar plugins nativos
- EAS Build maneja mejor estos problemas que builds locales
- Si el problema persiste, considera crear un issue en el repositorio de expo-maps

