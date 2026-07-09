import * as NavigationBar from 'expo-navigation-bar';
import * as SystemUI from 'expo-system-ui';
import { Platform } from 'react-native';

import { colors } from '../theme/colors';

/** Alinea barras del sistema con el tema de la app (evita franjas negras en Android). */
export async function configureNativeChrome(): Promise<void> {
  if (Platform.OS === 'web') return;

  await SystemUI.setBackgroundColorAsync(colors.background);

  if (Platform.OS === 'android') {
    await NavigationBar.setBackgroundColorAsync(colors.surface);
    await NavigationBar.setButtonStyleAsync('dark');
  }
}
