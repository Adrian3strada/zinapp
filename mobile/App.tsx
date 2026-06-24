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

export default function App() {
  const [webFontsReady, setWebFontsReady] = React.useState(Platform.OS !== 'web');

  React.useEffect(() => {
    void prefetchAppConfig();
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    void loadWebFonts().finally(() => setWebFontsReady(true));
  }, []);

  if (!webFontsReady) {
    return (
      <SafeAreaProvider>
        <WebShell>
          <WebBootScreen />
        </WebShell>
      </SafeAreaProvider>
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
                <NavigationContainer ref={navigationRef}>
                  <StatusBar style="light" />
                  <RootNavigator />
                </NavigationContainer>
              </View>
            </CartProvider>
          </AuthProvider>
        </WebShell>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
