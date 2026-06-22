import { Platform, ViewStyle } from 'react-native';

import { colors } from './colors';

/** Sombra ligera para cards — borde + elevación mínima, sin efecto “flotando”. */
export const cardShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  android: { elevation: 1 },
  default: {},
}) as ViewStyle;

/** Modales y campos destacados — un poco más que card, sin exagerar. */
export const elevatedShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  android: { elevation: 2 },
  default: {},
}) as ViewStyle;

/** Elementos pequeños (chips, badges). */
export const softShadow: ViewStyle = Platform.select({
  ios: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  android: { elevation: 0 },
  default: {},
}) as ViewStyle;
