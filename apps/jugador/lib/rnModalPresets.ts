import { Dimensions, ViewStyle } from 'react-native';
import { Spacing } from '../constants/theme';

/** Props de backdrop coherentes en toda la app (pantalla completa, Android status bar). */
export function getRModalBackdropProps() {
  const { width, height } = Dimensions.get('screen');
  return {
    backdropOpacity: 0.5,
    useNativeDriverForBackdrop: true as const,
    hideModalContentWhileAnimating: true as const,
    statusBarTranslucent: true as const,
    coverScreen: true as const,
    deviceWidth: width,
    deviceHeight: height,
  };
}

/** Modal centrado tipo tarjeta (entrada desde la izquierda). */
export function getRModalCenterSheetStyle(): ViewStyle {
  return {
    flex: 1,
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  };
}

/** Panel anclado abajo (time/date pickers). */
export function getRModalBottomSheetStyle(): ViewStyle {
  return {
    flex: 1,
    margin: 0,
    justifyContent: 'flex-end',
  };
}

/** Altura máxima del panel y zona scroll del cuerpo (header/footer ~200). */
export function getRModalCardLayout() {
  const windowH = Dimensions.get('window').height;
  const modalMaxHeight = Math.round(windowH * 0.88);
  const modalScrollAreaMaxHeight = Math.max(160, modalMaxHeight - 200);
  return { modalMaxHeight, modalScrollAreaMaxHeight };
}

export const rModalAnimCenter = {
  animationIn: 'fadeIn' as const,
  animationOut: 'fadeOut' as const,
};

export const rModalAnimLeft = {
  animationIn: 'slideInLeft' as const,
  animationOut: 'slideOutLeft' as const,
};

export const rModalAnimSheet = {
  animationIn: 'slideInUp' as const,
  animationOut: 'slideOutDown' as const,
};

export const rModalAnimFade = {
  animationIn: 'fadeIn' as const,
  animationOut: 'fadeOut' as const,
};
