import { type AnimationObject } from 'lottie-react-native';

export type LottieVariant =
  | 'loading'
  | 'emptyField'
  | 'waitingPlayers'
  | 'trophy'
  | 'team';

const LOTTIE_SOURCES: Record<LottieVariant, AnimationObject> = {
  loading: require('../assets/lottie/soccer-ball-loading.json'),
  emptyField: require('../assets/lottie/soccer-field-empty.json'),
  waitingPlayers: require('../assets/lottie/players-waiting.json'),
  trophy: require('../assets/lottie/trophy-idle.json'),
  team: require('../assets/lottie/team-jersey.json'),
};

export function getLottieSource(variant: LottieVariant): AnimationObject {
  return LOTTIE_SOURCES[variant];
}
