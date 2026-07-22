import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, Platform, StatusBar as RNStatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';

import AppErrorBoundary from './src/components/AppErrorBoundary';
import BackendWake from './src/components/BackendWake';
import ImageCropHost from './src/components/ImageCropHost';
import WebShell from './src/components/WebShell';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { prefetchAppConfig } from './src/hooks/useAppConfig';
import { navigationRef } from './src/navigation/navigationRef';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme/colors';
import './src/utils/googleAuth';
import { loadWebFonts } from './src/utils/loadWebFonts';
import { configureNativeChrome } from './src/utils/nativeChrome';
import { isWebPlatform, webNavigationRootStyle } from './src/utils/webPlatform';

if (isWebPlatform()) {
  enableScreens(false);
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
  },
};

function BootScreen() {
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
  const [nativeFontsLoaded] = useFonts(Ionicons.font);
  const [webFontsReady, setWebFontsReady] = React.useState(Platform.OS !== 'web');
  const [navResetKey, setNavResetKey] = React.useState('root');

  const fontsReady = Platform.OS === 'web' ? webFontsReady : nativeFontsLoaded;

  React.useEffect(() => {
    void configureNativeChrome();
    void prefetchAppConfig();
  }, []);

  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    require('./src/tasks/driverLocationTask');
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    void loadWebFonts().finally(() => setWebFontsReady(true));
  }, []);

  if (!fontsReady) {
    return (
      <AppErrorBoundary>
        <SafeAreaProvider>
          <WebShell>
            <BootScreen />
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
              <View style={webNavigationRootStyle() ?? { flex: 1, backgroundColor: colors.background }}>
                <NavigationContainer ref={navigationRef} theme={navTheme} onStateChange={(state) => setNavResetKey(navStateKey(state))}>
                  <AppErrorBoundary resetKey={navResetKey}>
                    {Platform.OS === 'android' ? (
                      <RNStatusBar
                        barStyle="dark-content"
                        backgroundColor={colors.background}
                        translucent={false}
                      />
                    ) : null}
                    <StatusBar style="dark" />
                    <RootNavigator />
                    <ImageCropHost />
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

