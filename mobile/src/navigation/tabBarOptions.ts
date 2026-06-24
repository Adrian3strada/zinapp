import type { EdgeInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { webTabBarStyle } from '../utils/webPlatform';

export function tabBarScreenOptions(insets: EdgeInsets, isDesktopWeb = false) {
  const tabBarHeight = spacing.tabBar + insets.bottom + 4;
  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.tabInactive,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
      elevation: 0,
      shadowOpacity: 0,
      paddingTop: 10,
      paddingBottom: insets.bottom + 6,
      height: tabBarHeight,
      ...webTabBarStyle(isDesktopWeb),
    },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const, marginTop: 4 },
    tabBarItemStyle: { paddingVertical: 2 },
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerTitleStyle: { fontWeight: '700' as const },
    headerShadowVisible: false,
  };
}
