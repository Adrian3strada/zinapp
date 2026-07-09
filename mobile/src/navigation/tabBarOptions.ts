import type { EdgeInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { webTabBarStyle } from '../utils/webPlatform';

export function tabBarScreenOptions(insets: EdgeInsets, isDesktopWeb = false) {
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);
  const tabBarHeight = spacing.tabBar + bottomInset;

  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.tabInactive,
    tabBarHideOnKeyboard: Platform.OS === 'android',
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      elevation: 8,
      shadowOpacity: 0,
      paddingTop: 8,
      paddingBottom: bottomInset,
      height: tabBarHeight,
      ...webTabBarStyle(isDesktopWeb),
    },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const, marginTop: 4 },
    tabBarItemStyle: { paddingVertical: 2 },
    sceneContainerStyle: { backgroundColor: colors.background },
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: '700' as const },
    headerShadowVisible: false,
  };
}
