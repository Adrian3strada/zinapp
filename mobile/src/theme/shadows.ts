import { Platform, ViewStyle } from 'react-native';

import { colors } from './colors';

export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
  },
  android: { elevation: 3 },
  default: {},
}) as ViewStyle;

export const elevatedShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  android: { elevation: 8 },
  default: {},
}) as ViewStyle;

export const softShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
  default: {},
}) as ViewStyle;
