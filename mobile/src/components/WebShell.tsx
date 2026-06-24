import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../theme/colors';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { WEB_MOBILE_FRAME_MAX } from '../utils/responsive';
import { isWebPlatform } from '../utils/webPlatform';

interface Props {
  children: React.ReactNode;
}

/**
 * Móvil web: columna centrada tipo teléfono.
 * Laptop/desktop: ocupa todo el ancho de la ventana.
 */
export default function WebShell({ children }: Props) {
  if (!isWebPlatform()) {
    return <>{children}</>;
  }

  const { isDesktopWeb } = useResponsiveLayout();

  return (
    <View style={[styles.page, isDesktopWeb ? styles.pageDesktop : styles.pageMobile]}>
      <View style={[styles.frame, isDesktopWeb ? styles.frameDesktop : styles.frameMobile]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: '100dvh',
  },
  pageMobile: {
    alignItems: 'center',
    backgroundColor: '#dbeafe',
  },
  pageDesktop: {
    alignItems: 'stretch',
    backgroundColor: colors.background,
  },
  frame: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background,
    overflow: 'hidden',
    height: '100%',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '100dvh',
  },
  frameMobile: {
    maxWidth: WEB_MOBILE_FRAME_MAX,
    boxShadow: '0 12px 48px rgba(15, 23, 42, 0.12)',
  },
  frameDesktop: {
    maxWidth: '100%',
    width: '100%',
  },
});
