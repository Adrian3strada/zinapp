import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { Suspense, useEffect } from 'react';
import { ActivityIndicator, InteractionManager, Platform, View } from 'react-native';

import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { usePushNotifications } from '../hooks/useNotifications';
import { modalPresentationOptions, stackScreenDefaults } from './modalOptions';
import { colors } from '../theme/colors';
import LoginScreen from '../screens/auth/LoginScreen';
import AppDialogScreen from '../screens/shared/AppDialogScreen';
import AdminNavigator from './AdminNavigator';
import CustomerNavigator from './CustomerNavigator';
import DriverNavigator from './DriverNavigator';
import RestaurantNavigator from './RestaurantNavigator';
import type { AuthStackParamList, RootStackParamList } from './types';
import { openAppDialog } from './navigationRef';
import { registerDialogNavigator } from '../utils/appDialogStore';
import { getWebResetToken } from '../utils/webDeepLink';

const RegisterScreen = React.lazy(() => import('../screens/auth/RegisterScreen'));
const ForgotPasswordScreen = React.lazy(() => import('../screens/auth/ForgotPasswordScreen'));
const ResetPasswordScreen = React.lazy(() => import('../screens/auth/ResetPasswordScreen'));

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <BrandLogo variant="dark" width={240} showTagline={false} compact />
      <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 28 }} />
    </View>
  );
}

function RoleNavigator({ role }: { role: string }) {
  if (role === 'admin') {
    return <AdminNavigator />;
  }
  switch (role) {
    case 'restaurant':
      return <RestaurantNavigator />;
    case 'driver':
      return <DriverNavigator />;
    case 'customer':
    default:
      return <CustomerNavigator />;
  }
}

function MainRoutes() {
  const { user, isGuest, isLoading, requestLogin } = useAuth();
  const [deferPush, setDeferPush] = React.useState(false);

  React.useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setDeferPush(true);
    });
    return () => task.cancel();
  }, []);

  usePushNotifications(!!user && deferPush);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user && !isGuest) {
    const resetToken = Platform.OS === 'web' ? getWebResetToken() : null;
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AuthStack.Navigator
          screenOptions={stackScreenDefaults}
          initialRouteName={resetToken ? 'ResetPassword' : 'Login'}
        >
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <AuthStack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ ...modalPresentationOptions, headerShown: true, title: 'Crear cuenta' }}
          />
          <AuthStack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ ...modalPresentationOptions, headerShown: true, title: 'Recuperar contraseña' }}
          />
          <AuthStack.Screen
            name="ResetPassword"
            component={ResetPasswordScreen}
            initialParams={resetToken ? { token: resetToken } : undefined}
            options={{ ...modalPresentationOptions, headerShown: true, title: 'Nueva contraseña' }}
          />
        </AuthStack.Navigator>
      </Suspense>
    );
  }

  if (isGuest) {
    return <CustomerNavigator guestMode onRequestLogin={requestLogin} />;
  }

  return <RoleNavigator role={user.role} />;
}

export default function RootNavigator() {
  useEffect(() => {
    registerDialogNavigator(openAppDialog);
    return () => registerDialogNavigator(() => {});
  }, []);

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Main" component={MainRoutes} />
      <RootStack.Screen
        name="AppDialog"
        component={AppDialogScreen}
        options={{
          presentation: 'transparentModal',
          animation: 'fade',
          headerShown: false,
          gestureEnabled: false,
          contentStyle: { backgroundColor: 'transparent' },
          ...(Platform.OS === 'web' ? { animationDuration: 150 } : {}),
        }}
      />
    </RootStack.Navigator>
  );
}
