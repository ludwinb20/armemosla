# Configuración de Storage - Complejos Deportivos

## 📦 Crear el Bucket en Supabase

### Paso 1: Crear el bucket desde la interfaz web

1. Ve a tu proyecto de Supabase
2. Navega a **Storage** en el menú lateral
3. Haz clic en **"Create a new bucket"**
4. Configura el bucket con estos valores:
   - **Name**: `complejos`
   - **Public bucket**: ✅ **Sí** (marca esta opción para que las imágenes sean accesibles públicamente)
   - **File size limit**: `5242880` (5MB) o el tamaño que prefieras
   - **Allowed MIME types**: `image/jpeg, image/png` (opcional, pero recomendado)

5. Haz clic en **"Create bucket"**

### Paso 2: Configurar las políticas RLS

Después de crear el bucket, ejecuta el script SQL `04_storage_bucket_complejos.sql` en el **SQL Editor** de Supabase.

Este script creará las políticas de seguridad que permiten:
- ✅ Los administradores pueden subir imágenes
- ✅ Los administradores pueden ver sus imágenes
- ✅ Los administradores pueden actualizar sus imágenes
- ✅ Los administradores pueden eliminar sus imágenes
- ✅ Las imágenes son públicas (cualquiera puede verlas)

## 🔒 Políticas de Seguridad

Las políticas RLS aseguran que:
- Solo usuarios autenticados con tipo "Administrador de Cancha" pueden subir/editar/eliminar imágenes
- Las imágenes son públicas para visualización (para que se muestren en la app)
- Cada administrador solo puede gestionar sus propias imágenes

## 📁 Estructura de archivos

Las imágenes se guardan con esta estructura:
```
complejos/
  └── [complejo_id]/
      ├── logo-[timestamp].jpg
      └── fotos/
          ├── [timestamp]-0.jpg
          ├── [timestamp]-1.jpg
          └── ...
```

## ✅ Verificación

Para verificar que todo funciona:
1. Crea un complejo desde la app
2. Sube un logo o foto
3. Verifica en Storage que el archivo se haya creado en el bucket `complejos`
4. Verifica que puedas acceder a la URL pública de la imagen

## 🐛 Solución de problemas

### Error: "Bucket not found"
- Verifica que el bucket `complejos` esté creado en Storage
- Verifica que el nombre sea exactamente `complejos` (sin espacios, minúsculas)

### Error: "new row violates row-level security policy"
- Ejecuta el script SQL `04_storage_bucket_complejos.sql`
- Verifica que el usuario tenga el tipo "Administrador de Cancha" en su perfil

### Las imágenes no se muestran
- Verifica que el bucket sea público
- Verifica que las políticas RLS permitan SELECT público
- Revisa la consola del navegador para ver errores de CORS

