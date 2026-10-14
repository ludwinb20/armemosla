# Sistema de Estilos con Tailwind CSS

Este proyecto usa **NativeWind** (Tailwind CSS para React Native) para gestionar todos los estilos de manera centralizada.

## Configuración

- **Tailwind Config**: `tailwind.config.js` - Contiene todos los colores, espaciados y valores del sistema de diseño
- **Estilos Centrales**: `styles/index.ts` - Exporta clases predefinidas de Tailwind
- **CSS Global**: `global.css` - Importa las directivas de Tailwind

## Uso Básico

### Opción 1: Usar clases de Tailwind directamente

```tsx
import { View, Text } from 'react-native';

export default function MyComponent() {
  return (
    <View className="flex-1 bg-background p-md">
      <Text className="text-text text-lg font-bold">
        Hola Mundo
      </Text>
    </View>
  );
}
```

### Opción 2: Usar el archivo central de estilos

```tsx
import { View, Text } from 'react-native';
import { styles } from '../styles';

export default function MyComponent() {
  return (
    <View className={`${styles.layout.flex['1']} ${styles.colors.bg.background} ${styles.spacing.md}`}>
      <Text className={`${styles.colors.text.primary} ${styles.typography.size.lg} ${styles.typography.weight.bold}`}>
        Hola Mundo
      </Text>
    </View>
  );
}
```

### Opción 3: Combinar ambos enfoques

```tsx
import { View, Text } from 'react-native';
import { styles } from '../styles';

export default function MyComponent() {
  return (
    <View className={`flex-1 ${styles.colors.bg.background} ${styles.spacing.md}`}>
      <Text className={`${styles.colors.text.primary} text-lg font-bold`}>
        Hola Mundo
      </Text>
    </View>
  );
}
```

## Clases Disponibles

### Colores

```tsx
// Backgrounds
styles.colors.bg.primary
styles.colors.bg.secondary
styles.colors.bg.background
styles.colors.bg.surface
styles.colors.bg.error
styles.colors.bg.success
styles.colors.bg.warning

// Text colors
styles.colors.text.primary
styles.colors.text.secondary
styles.colors.text.tertiary
styles.colors.text.inverse

// Border colors
styles.colors.border.default
styles.colors.border.light
styles.colors.border.dark
```

### Espaciado

```tsx
// Padding
styles.spacing.xs    // 4px
styles.spacing.sm    // 8px
styles.spacing.md    // 16px
styles.spacing.lg    // 24px
styles.spacing.xl    // 32px

// Padding específico
styles.spacing.px.md  // padding horizontal
styles.spacing.py.md  // padding vertical

// Margin
styles.spacing.m.md
styles.spacing.mx.md
styles.spacing.my.md
```

### Tipografía

```tsx
// Tamaños
styles.typography.size.xs
styles.typography.size.sm
styles.typography.size.md
styles.typography.size.lg
styles.typography.size.xl

// Pesos
styles.typography.weight.regular
styles.typography.weight.medium
styles.typography.weight.semibold
styles.typography.weight.bold
```

### Layout

```tsx
// Flex
styles.layout.flex.row
styles.layout.flex.col
styles.layout.flex['1']
styles.layout.flex.wrap

// Justify
styles.layout.justify.center
styles.layout.justify.between
styles.layout.justify.around

// Items
styles.layout.items.center
styles.layout.items.start
styles.layout.items.end
```

### Componentes Predefinidos

```tsx
// Botones
styles.components.button.primary
styles.components.button.secondary
styles.components.button.outline
styles.components.button.danger

// Cards
styles.components.card

// Inputs
styles.components.input

// Container
styles.components.container
```

## Migración desde StyleSheet

### Antes (StyleSheet)

```tsx
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.md,
  },
  text: {
    fontSize: Typography.fontSize.lg,
    color: Colors.text,
    fontWeight: Typography.fontWeight.bold,
  },
});

<View style={styles.container}>
  <Text style={styles.text}>Hola</Text>
</View>
```

### Después (Tailwind)

```tsx
<View className="flex-1 bg-background p-md">
  <Text className="text-lg text-text font-bold">Hola</Text>
</View>
```

O usando el archivo central:

```tsx
import { styles } from '../styles';

<View className={`${styles.layout.flex['1']} ${styles.colors.bg.background} ${styles.spacing.md}`}>
  <Text className={`${styles.typography.size.lg} ${styles.colors.text.primary} ${styles.typography.weight.bold}`}>
    Hola
  </Text>
</View>
```

## Notas Importantes

1. **className vs style**: En React Native con NativeWind, usa `className` en lugar de `style` para clases de Tailwind
2. **Combinar estilos**: Puedes combinar `className` con `style` si necesitas valores dinámicos:
   ```tsx
   <View className="flex-1" style={{ width: dynamicWidth }}>
   ```
3. **Valores del tema**: Todos los colores y espaciados están definidos en `tailwind.config.js` y mapean los valores de `constants/theme.ts`

## Recursos

- [NativeWind Documentation](https://www.nativewind.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

