import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';

import AppErrorBoundary from './src/components/AppErrorBoundary';
import BackendWake from './src/components/BackendWake';
import WebShell from './src/components/WebShell';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { prefetchAppConfig } from './src/hooks/useAppConfig';
import { navigationRef } from './src/navigation/navigationRef';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme/colors';
import { loadWebFonts } from './src/utils/loadWebFonts';
import { isWebPlatform, webNavigationRootStyle } from './src/utils/webPlatform';

if (isWebPlatform()) {
  enableScreens(false);
}

function WebBootScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function navStateKey(state: unknown): string {
  if (!state || typeof state !== 'object') return 'root';
  const parts: string[] = [];
  let current = state as {
    index?: number;
    routes: { name?: string; state?: unknown }[];
  };
  while (current?.routes?.length) {
    const idx = current.index ?? 0;
    const route = current.routes[idx];
    parts.push(`${route?.name ?? '?'}:${idx}`);
    current = route?.state as typeof current;
  }
  return parts.join('>') || 'root';
}

export default function App() {
  const [webFontsReady, setWebFontsReady] = React.useState(Platform.OS !== 'web');
  const [navResetKey, setNavResetKey] = React.useState('root');

  React.useEffect(() => {
    void prefetchAppConfig();
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    void loadWebFonts().finally(() => setWebFontsReady(true));
  }, []);

  if (!webFontsReady) {
    return (
      <AppErrorBoundary>
        <SafeAreaProvider>
          <WebShell>
            <WebBootScreen />
          </WebShell>
        </SafeAreaProvider>
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <WebShell>
          <AuthProvider>
            <BackendWake />
            <CartProvider>
              <View style={webNavigationRootStyle()}>
                <NavigationContainer
                  ref={navigationRef}
                  onStateChange={(state) => setNavResetKey(navStateKey(state))}
                >
                  <AppErrorBoundary resetKey={navResetKey}>
                    <StatusBar style="light" />
                    <RootNavigator />
                  </AppErrorBoundary>
                </NavigationContainer>
              </View>
            </CartProvider>
          </AuthProvider>
        </WebShell>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
