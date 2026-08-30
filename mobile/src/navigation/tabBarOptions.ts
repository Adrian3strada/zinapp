import type { EdgeInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

import { isSeasonalActive, SEASONAL_THEME } from '../config/seasonalTheme';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { webTabBarStyle } from '../utils/webPlatform';

export function tabBarScreenOptions(insets: EdgeInsets, isDesktopWeb = false) {
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);
  const tabBarHeight = spacing.tabBar + bottomInset;
  const festive = isSeasonalActive();

  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.tabInactive,
    tabBarHideOnKeyboard: Platform.OS === 'android',
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopWidth: festive ? 3 : 1,
      borderTopColor: festive ? SEASONAL_THEME.colors.green : colors.borderLight,
      elevation: 8,
      shadowOpacity: 0,
      paddingTop: 4,
      paddingBottom: bottomInset,
      height: undefined,
      minHeight: tabBarHeight,
      ...webTabBarStyle(isDesktopWeb),
    },
    tabBarLabelStyle: { fontSize: 12, fontWeight: '700' as const, marginTop: 2 },
    tabBarItemStyle: { paddingVertical: 2, minHeight: 44 },
    tabBarIconStyle: { marginTop: 2 },
    sceneContainerStyle: { backgroundColor: colors.background },
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: '700' as const },
    headerShadowVisible: false,
  };
}
