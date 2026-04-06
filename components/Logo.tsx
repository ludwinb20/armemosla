import React from 'react';
import { Image, ImageStyle, View, ViewStyle } from 'react-native';

type LogoVariant = 'full' | 'icon' | 'text';
type LogoFormat = 'png' | 'svg';

interface LogoProps {
  variant?: LogoVariant;
  format?: LogoFormat;
  width?: number;
  height?: number;
  style?: ViewStyle | ImageStyle;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
}

/**
 * Componente Logo que renderiza diferentes variantes del logo de Armemosla
 * 
 * @param variant - 'full' (logo completo), 'icon' (solo icono), 'text' (solo texto)
 * @param format - 'png' o 'svg' (por defecto usa png)
 * @param width - Ancho del logo
 * @param height - Alto del logo
 * @param style - Estilos adicionales
 * @param resizeMode - Modo de redimensionamiento
 */
export const Logo: React.FC<LogoProps> = ({
  variant = 'full',
  format = 'png',
  width,
  height,
  style,
  resizeMode = 'contain',
}) => {
  const getLogoSource = () => {
    switch (variant) {
      case 'icon':
        return format === 'svg' 
          ? require('../assets/icono.svg')
          : require('../assets/icono.png');
      case 'text':
        return format === 'svg'
          ? require('../assets/texto.svg')
          : require('../assets/texto.png');
      case 'full':
      default:
        return format === 'svg'
          ? require('../assets/logo.svg')
          : require('../assets/logopng.png');
    }
  };

  return (
    <View className="items-center justify-center" style={style}>
      <Image
        source={getLogoSource()}
        className={`w-full h-full ${!width && !height ? 'w-[200px] h-[60px]' : ''}`}
        style={[
          width && { width },
          height && { height },
        ]}
        resizeMode={resizeMode}
      />
    </View>
  );
};


export default Logo;

