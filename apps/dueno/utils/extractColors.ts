/**
 * Utilidad para extraer colores del logo
 * 
 * INSTRUCCIONES:
 * 1. Abre tu logo en una herramienta de diseño (Figma, Photoshop, etc.)
 * 2. Usa el cuentagotas para identificar los colores principales
 * 3. Actualiza los valores en constants/theme.ts con los colores reales de tu logo
 * 
 * Colores comunes a identificar:
 * - Color principal (más usado en el logo)
 * - Color secundario (si hay)
 * - Color de acento (si hay)
 * - Color del texto (si el logo tiene texto)
 */

export const extractColorsFromLogo = () => {
  // Esta función es solo una guía
  // Los colores reales deben extraerse manualmente del logo
  
  console.log(`
    Para extraer los colores de tu logo:
    
    1. Abre el logo en una herramienta de diseño
    2. Identifica los colores principales usando el cuentagotas
    3. Actualiza constants/theme.ts con los valores hexadecimales
    
    Ejemplo:
    - Si el color principal es #FF5733, actualiza Colors.primary
    - Si hay un color secundario #33C3F0, actualiza Colors.secondary
    - etc.
  `);
};

/**
 * Convierte un color RGB a hexadecimal
 */
export const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

/**
 * Convierte un color hexadecimal a RGB
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

