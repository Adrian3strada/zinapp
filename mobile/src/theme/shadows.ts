import { Platform, ViewStyle } from 'react-native';

import { colors } from './colors';

export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  android: { elevation: 4 },
  default: {},
}) as ViewStyle;
