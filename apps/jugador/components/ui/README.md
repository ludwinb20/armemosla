# Librería UI — Armemosla

Componentes personalizados con estilo Glassmorphism. **Las pantallas solo importan desde aquí.**

## Uso en vistas

```tsx
import { Screen, Card, Input, Button, Text } from '@/components/ui';
```

## Reglas

- No usar clases Tailwind de apariencia en pantallas
- No importar `styles/index.ts` desde vistas
- Props semánticas: `variant="primary"`, no colores

## Componentes

| Componente | Variantes / props |
|---|---|
| `Button` | `primary`, `outline`, `ghost`, `danger` · `size`: sm/md/lg |
| `Card` | `default`, `elevated` · `onPress` opcional |
| `Input` | `label`, `error`, `helper`, iconos |
| `Text` | `h1`–`h4`, `body`, `caption`, `label` |
| `Screen` | SafeArea + fondo |
| `Modal` | `center`, `bottom` |
| `Alert` | tipos: error, success, info, warning |
| `Chip` | `active` |
| `ListRow` | fila con icono y chevron |

## Cambiar estilo en el futuro

1. Colores → `constants/uiTokens.json` + `tailwind.config.js`
2. Clases → `styles/index.ts`
3. Blur/comportamiento → `components/ui/Surface.tsx`

Las vistas no cambian.
