/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Colores principales - Verde logo (#00C56E)
        primary: {
          DEFAULT: '#00C56E',
          dark: '#00A05A',
          light: '#00E07D',
        },
        // Colores secundarios - Variante del verde
        secondary: {
          DEFAULT: '#00A05A',
          dark: '#008045',
          light: '#00C56E',
        },
        // Colores de acento - Variante del verde
        accent: {
          DEFAULT: '#00E07D',
          dark: '#00C56E',
          light: '#1AE88F',
        },
        // Colores neutros - Fondo negro (#000000)
        background: '#000000',
        surface: '#121212',
        'surface-dark': '#0A0A0A',
        'surface-light': '#1A1A1A',
        // Colores de texto - Blanco (#FFFFFF)
        text: {
          DEFAULT: '#FFFFFF',
          secondary: '#CCCCCC',
          tertiary: '#999999',
          inverse: '#000000',
        },
        // Colores de estado
        success: '#00C56E',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#00C56E',
        // Colores de borde - Gris grafito (#2A2A2A)
        border: {
          DEFAULT: '#2A2A2A',
          light: '#3A3A3A',
          dark: '#1A1A1A',
        },
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
        xxxl: '64px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        xxl: '24px',
        full: '9999px',
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        md: '16px',
        lg: '18px',
        xl: '20px',
        xxl: '24px',
        xxxl: '32px',
        display: '40px',
      },
      fontWeight: {
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
  },
  plugins: [],
}
