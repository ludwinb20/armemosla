import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../../constants/theme';

type Props = {
  size?: number;
};

/**
 * Loader de balón rebotando (Reanimated). Más legible que el Lottie mínimo en RN.
 */
export default function BouncingSoccerBallLoader({ size = 56 }: Props) {
  const bounce = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    bounce.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 420, easing: Easing.in(Easing.quad) })
      ),
      -1,
      false
    );
    spin.value = withRepeat(
      withTiming(360, { duration: 840, easing: Easing.linear }),
      -1,
      false
    );
  }, [bounce, spin]);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -bounce.value * 22 },
      { rotate: `${spin.value}deg` },
    ],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + bounce.value * 0.14,
    transform: [{ scaleX: 0.55 + bounce.value * 0.35 }, { scaleY: 0.35 + bounce.value * 0.15 }],
  }));

  const box = Math.max(size + 48, 104);

  return (
    <View style={[styles.stage, { width: box, height: box }]}>
      <Animated.View style={[styles.shadow, shadowStyle]} />
      <Animated.View style={[styles.ballWrap, ballStyle]}>
        <Ionicons name="football" size={size} color={Colors.primary} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 8,
  },
  shadow: {
    position: 'absolute',
    bottom: 10,
    width: 52,
    height: 14,
    borderRadius: 26,
    backgroundColor: '#000000',
  },
  ballWrap: {
    marginBottom: 18,
  },
});
