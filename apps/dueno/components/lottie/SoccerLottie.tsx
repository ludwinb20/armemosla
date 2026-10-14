import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import LottieView, { type AnimationObject } from 'lottie-react-native';
import { getLottieSource, LottieVariant } from '../../constants/lottieAssets';

type Props = {
  variant: LottieVariant;
  size?: number;
  loop?: boolean;
  autoPlay?: boolean;
  style?: StyleProp<ViewStyle>;
  opacity?: number;
};

export default function SoccerLottie({
  variant,
  size = 96,
  loop = true,
  autoPlay = true,
  style,
  opacity = 0.92,
}: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size, opacity }, style]}>
      <LottieView
        source={getLottieSource(variant)}
        autoPlay={autoPlay}
        loop={loop}
        style={styles.lottie}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
});
