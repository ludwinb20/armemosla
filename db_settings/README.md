# Configuración Inicial de Supabase - Armemosla

## 🚀 Configuración Básica

### 1. Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Inicia sesión o crea una cuenta
3. Crea un nuevo proyecto
4. Espera a que se complete la configuración (puede tomar unos minutos)

### 2. Configurar Variables de Entorno

1. Ve a **Settings > API** en tu proyecto de Supabase
2. Copia los siguientes valores:
   - **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public key** → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Crea un archivo `.env` en la raíz del proyecto:
```env
EXPO_PUBLIC_SUPABASE_URL=tu_url_de_supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

O configura las variables en `app.config.js` en la sección `extra`.

### 3. Ejecutar Script SQL

1. Ve a **SQL Editor** en el panel de Supabase
2. Abre el archivo `01_setup_basico.sql`
3. Copia y pega el contenido
4. Ejecuta el script
5. Verifica que no haya errores

### 4. Configurar Autenticación

1. Ve a **Authentication > Providers**
2. Habilita los proveedores que necesites:
   - **Email** (recomendado para empezar)
   - **Google** (si vas a usar Google Sign-In)
3. Configura las opciones de email:
   - **Enable email confirmations**: Activar si quieres verificar emails
   - **Enable email change confirmations**: Activar para seguridad

### 5. Probar la Conexión

Desde tu app, puedes probar la conexión:

```typescript
import { supabase } from './lib/supabase';

// Probar conexión
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .limit(1);

if (error) {
  console.error('Error de conexión:', error);
} else {
  console.log('Conexión exitosa!');
}
```

## ✅ ¿Qué se configuró?

- ✅ Tabla `profiles` - Perfiles de usuario básicos
- ✅ Row Level Security (RLS) - Seguridad a nivel de fila
- ✅ Trigger automático - Crea perfil cuando se registra un usuario
- ✅ Trigger automático - Actualiza `updated_at` automáticamente

## 📝 Próximos Pasos

Una vez que tengas esto funcionando, puedes:
- Agregar más tablas según las necesites
- Configurar Storage para imágenes
- Configurar funciones adicionales
- Agregar más políticas de seguridad

## 🆘 Solución de Problemas

### Error: "permission denied for schema public"
- Asegúrate de estar ejecutando los scripts como superuser o con permisos adecuados

### Error: "relation already exists"
- La tabla ya existe, puedes eliminarla primero o usar `DROP TABLE IF EXISTS`

### Error: "function does not exist"
- Verifica que ejecutaste el script completo

## 📚 Recursos

- [Documentación de Supabase](https://supabase.com/docs)
- [Guía de RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [SQL Editor](https://supabase.com/docs/guides/database/tables)
