import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

import { colors } from '../theme/colors';

/** Opciones base del stack principal. */
export const stackScreenDefaults: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.primary,
  headerTitleStyle: { fontWeight: '700', color: colors.text },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

/** Pantallas secundarias: suben desde abajo como hoja modal. */
export const modalPresentationOptions: NativeStackNavigationOptions = {
  ...stackScreenDefaults,
  presentation: 'modal',
  animation: Platform.select({
    ios: 'default',
    android: 'slide_from_bottom',
    default: 'slide_from_bottom',
  }),
  gestureEnabled: true,
  gestureDirection: 'vertical',
};
