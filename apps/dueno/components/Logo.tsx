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

  const imageStyle: ImageStyle = {
    ...(width ? { width } : { width: 200 }),
    ...(height ? { height } : { height: 60 }),
  };

  return (
    <View className="items-center justify-center" style={style}>
      <Image
        source={getLogoSource()}
        style={imageStyle}
        resizeMode={resizeMode}
      />
    </View>
  );
};

export default Logo;
