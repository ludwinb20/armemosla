# Armemosla

App de alquiler de canchas construida con React Native, Expo y Supabase.

## 🚀 Tecnologías

- **React Native** - Framework para desarrollo móvil
- **Expo** - Plataforma para desarrollo React Native
- **Supabase** - Backend como servicio (BaaS)
- **TypeScript** - Tipado estático
- **pnpm** - Gestor de paquetes

## 📋 Requisitos Previos

- Node.js (versión 18 o superior)
- pnpm instalado globalmente (`npm install -g pnpm`)
- Cuenta de Supabase (gratuita en [supabase.com](https://supabase.com))

## 🛠️ Instalación

1. Clona el repositorio:
```bash
git clone <url-del-repositorio>
cd armemosla
```

2. Instala las dependencias:
```bash
pnpm install
```

3. Configura las variables de entorno:
   - Crea un archivo `.env` en la raíz del proyecto
   - Agrega tus credenciales de Supabase:
```
EXPO_PUBLIC_SUPABASE_URL=tu_url_de_supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
```

   O configura las variables en `app.config.js` en la sección `extra`.

## 🏃 Ejecutar el Proyecto

- **Iniciar el servidor de desarrollo:**
```bash
pnpm start
```

- **Ejecutar en Android:**
```bash
pnpm android
```

- **Ejecutar en iOS:**
```bash
pnpm ios
```

- **Ejecutar en Web:**
```bash
pnpm web
```

## 📁 Estructura del Proyecto

```
armemosla/
├── App.tsx              # Componente principal
├── index.js             # Punto de entrada
├── app.config.js        # Configuración de Expo
├── lib/
│   ├── supabase.ts      # Cliente de Supabase
│   └── auth.example.ts  # Ejemplos de autenticación
└── assets/              # Recursos (imágenes, fuentes, etc.)
```

## 🔐 Configuración de Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ve a Settings > API
3. Copia la URL del proyecto y la clave anónima (anon key)
4. Agrega estas credenciales a tu archivo `.env` o `app.config.js`

## 📚 Uso de Supabase

El cliente de Supabase está configurado en `lib/supabase.ts`. Puedes importarlo en cualquier componente:

```typescript
import { supabase } from './lib/supabase';

// Ejemplo: Consultar datos
const { data, error } = await supabase
  .from('tu_tabla')
  .select('*');
```

Revisa `lib/auth.example.ts` para ejemplos de autenticación.

## 📝 Scripts Disponibles

- `pnpm start` - Inicia el servidor de desarrollo de Expo
- `pnpm android` - Ejecuta la app en Android
- `pnpm ios` - Ejecuta la app en iOS
- `pnpm web` - Ejecuta la app en el navegador

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor, abre un issue o un pull request.

## 📄 Licencia

ISC
