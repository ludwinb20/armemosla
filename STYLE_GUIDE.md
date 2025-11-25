# Guía de Estilos - Armemosla

Esta guía documenta el sistema de diseño de la aplicación Armemosla, basado en el logo de la marca.

## 🎨 Colores

Los colores están definidos en `constants/theme.ts`. **IMPORTANTE**: Debes personalizar estos colores basándote en los colores reales de tu logo.

### Cómo extraer colores del logo:

1. Abre tu logo en una herramienta de diseño (Figma, Photoshop, GIMP, etc.)
2. Usa la herramienta cuentagotas para identificar los colores principales
3. Actualiza los valores en `constants/theme.ts`:

```typescript
export const Colors = {
  primary: '#TU_COLOR_PRINCIPAL',      // Color más usado en el logo
  primaryDark: '#VARIACION_OSCURA',    // Versión oscura del color principal
  primaryLight: '#VARIACION_CLARA',    // Versión clara del color principal
  // ... etc
};
```

### Paleta de colores actual (valores por defecto - ajustar según tu logo):

- **Primary**: Color principal de la marca
- **Secondary**: Color secundario (si existe en el logo)
- **Accent**: Color de acento para destacar elementos
- **Neutros**: Grises para fondos, textos y bordes
- **Estados**: Colores para success, warning, error, info

## 📐 Espaciado

El sistema de espaciado usa una escala de 4px:

```typescript
Spacing = {
  xs: 4,   // 4px
  sm: 8,   // 8px
  md: 16,  // 16px
  lg: 24,  // 24px
  xl: 32,  // 32px
  xxl: 48, // 48px
  xxxl: 64 // 64px
}
```

## 🔤 Tipografía

### Tamaños de fuente:

- `display`: 40px - Títulos principales
- `xxxl`: 32px - Títulos grandes
- `xxl`: 24px - Títulos medianos
- `xl`: 20px - Títulos pequeños
- `lg`: 18px - Texto grande
- `md`: 16px - Texto normal (body)
- `sm`: 14px - Texto pequeño
- `xs`: 12px - Texto muy pequeño (captions)

### Pesos de fuente:

- `regular`: 400
- `medium`: 500
- `semibold`: 600
- `bold`: 700

## 🎯 Componentes de Estilo

### Uso de estilos globales:

```typescript
import { globalStyles } from '../styles/globalStyles';

// En tu componente
<View style={globalStyles.container}>
  <Text style={globalStyles.heading1}>Título</Text>
  <Text style={globalStyles.body}>Texto normal</Text>
</View>
```

### Estilos disponibles:

#### Contenedores:
- `container` - Contenedor principal
- `safeArea` - SafeAreaView con fondo
- `content` - Contenido con padding
- `contentCentered` - Contenido centrado

#### Tipografía:
- `heading1`, `heading2`, `heading3`, `heading4`
- `body`, `bodySmall`
- `caption`

#### Botones:
- `button`, `buttonPrimary`, `buttonSecondary`, `buttonOutline`
- `buttonText`, `buttonTextOutline`

#### Cards:
- `card`, `cardElevated`

#### Inputs:
- `input`, `inputFocused`, `inputError`

#### Utilidades:
- `row`, `rowBetween`, `rowCenter`
- `centerContent`
- `divider`, `dividerVertical`
- `badge`, `badgeText`

## 🖼️ Componente Logo

El componente `Logo` permite usar diferentes variantes del logo:

```typescript
import { Logo } from './components/Logo';

// Logo completo
<Logo variant="full" format="png" width={250} height={80} />

// Solo el icono
<Logo variant="icon" format="png" width={60} height={60} />

// Solo el texto
<Logo variant="text" format="svg" width={200} height={50} />
```

### Props:

- `variant`: 'full' | 'icon' | 'text'
- `format`: 'png' | 'svg'
- `width`: número (opcional)
- `height`: número (opcional)
- `style`: estilos adicionales
- `resizeMode`: 'contain' | 'cover' | 'stretch' | 'center'

## 📱 Ejemplos de Uso

### Botón primario:

```typescript
import { TouchableOpacity, Text } from 'react-native';
import { globalStyles } from '../styles/globalStyles';

<TouchableOpacity style={globalStyles.buttonPrimary}>
  <Text style={globalStyles.buttonText}>Presionar</Text>
</TouchableOpacity>
```

### Card con sombra:

```typescript
import { View, Text } from 'react-native';
import { globalStyles } from '../styles/globalStyles';

<View style={globalStyles.card}>
  <Text style={globalStyles.heading3}>Título de la card</Text>
  <Text style={globalStyles.body}>Contenido de la card</Text>
</View>
```

### Input de texto:

```typescript
import { TextInput } from 'react-native';
import { globalStyles } from '../styles/globalStyles';

<TextInput
  style={globalStyles.input}
  placeholder="Escribe aquí..."
  placeholderTextColor={Colors.textTertiary}
/>
```

## 🔄 Personalización

Para personalizar los estilos:

1. **Colores**: Edita `constants/theme.ts`
2. **Espaciado**: Ajusta los valores en `constants/theme.ts`
3. **Tipografía**: Modifica `Typography` en `constants/theme.ts`
4. **Estilos globales**: Agrega nuevos estilos en `styles/globalStyles.ts`

## 📚 Archivos Relacionados

- `constants/theme.ts` - Definiciones de colores, espaciado, tipografía
- `styles/globalStyles.ts` - Estilos globales reutilizables
- `components/Logo.tsx` - Componente del logo
- `utils/extractColors.ts` - Utilidades para extraer colores

