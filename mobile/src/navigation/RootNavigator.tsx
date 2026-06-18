import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { Suspense } from 'react';
import { ActivityIndicator, InteractionManager, View } from 'react-native';

import BrandLogo from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { usePushNotifications } from '../hooks/useNotifications';
import { modalPresentationOptions, stackScreenDefaults } from './modalOptions';
import { colors } from '../theme/colors';
import LoginScreen from '../screens/auth/LoginScreen';
import type { AuthStackParamList } from './types';

const CustomerNavigator = React.lazy(() => import('./CustomerNavigator'));
const DriverNavigator = React.lazy(() => import('./DriverNavigator'));
const RestaurantNavigator = React.lazy(() => import('./RestaurantNavigator'));
const AdminNavigator = React.lazy(() => import('./AdminNavigator'));
const RegisterScreen = React.lazy(() => import('../screens/auth/RegisterScreen'));
const ForgotPasswordScreen = React.lazy(() => import('../screens/auth/ForgotPasswordScreen'));
const ResetPasswordScreen = React.lazy(() => import('../screens/auth/ResetPasswordScreen'));

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function LoadingScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <BrandLogo variant="dark" width={240} />
      <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 28 }} />
    </View>
  );
}

function RoleNavigator({ role }: { role: string }) {
  switch (role) {
    case 'restaurant':
      return <RestaurantNavigator />;
    case 'driver':
      return <DriverNavigator />;
    case 'admin':
      return <AdminNavigator />;
    case 'customer':
    default:
      return <CustomerNavigator />;
  }
}

export default function RootNavigator() {
  const { user, isLoading } = useAuth();
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

  if (!user) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AuthStack.Navigator screenOptions={stackScreenDefaults}>
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
            options={{ ...modalPresentationOptions, headerShown: true, title: 'Nueva contraseña' }}
          />
        </AuthStack.Navigator>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <RoleNavigator role={user.role} />
    </Suspense>
  );
}
