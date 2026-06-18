import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppErrorBoundary from './src/components/AppErrorBoundary';
import AppDialogBridge from './src/components/AppDialogBridge';
import BackendWake from './src/components/BackendWake';
import { AppDialogProvider } from './src/context/AppDialogContext';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { prefetchAppConfig } from './src/hooks/useAppConfig';
import { navigationRef } from './src/navigation/navigationRef';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  React.useEffect(() => {
    void prefetchAppConfig();
  }, []);

  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <AppDialogProvider>
          <AppDialogBridge />
          <AuthProvider>
            <BackendWake />
            <CartProvider>
              <NavigationContainer ref={navigationRef}>
                <StatusBar style="light" />
                <RootNavigator />
              </NavigationContainer>
            </CartProvider>
          </AuthProvider>
        </AppDialogProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}
