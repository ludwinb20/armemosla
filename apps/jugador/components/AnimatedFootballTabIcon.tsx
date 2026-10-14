import React, { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type Props = {
  color: string;
  size: number;
};

/**
 * Icono de balón con rotación suave para la pestaña Armemosla.
 */
export default function AnimatedFootballTabIcon({ color, size }: Props) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withSequence(
        withTiming(18, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(-18, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name="football" size={size} color={color} />
    </Animated.View>
  );
}
