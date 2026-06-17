import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRestaurantPendingCount } from '../hooks/useRestaurantPendingCount';
import RestaurantManageScreen from '../screens/restaurant/RestaurantManageScreen';
import RestaurantOrdersScreen from '../screens/restaurant/RestaurantOrdersScreen';
import OrderDetailScreen from '../screens/shared/OrderDetailScreen';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { modalPresentationOptions, stackScreenDefaults } from './modalOptions';
import type { RestaurantStackParamList, RestaurantTabParamList } from './types';

const ProfileScreen = React.lazy(() => import('../screens/shared/ProfileScreen'));

function TabFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function LazyProfileScreen() {
  return (
    <Suspense fallback={<TabFallback />}>
      <ProfileScreen />
    </Suspense>
  );
}

const Tab = createBottomTabNavigator<RestaurantTabParamList>();
const Stack = createNativeStackNavigator<RestaurantStackParamList>();

function RestaurantTabs() {
  const insets = useSafeAreaInsets();
  const pendingCount = useRestaurantPendingCount();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        tabBarStyle: {
          height: spacing.tabBar + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
        },
      }}
    >
      <Tab.Screen
        name="Pedidos"
        component={RestaurantOrdersScreen}
        options={{
          headerShown: false,
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MiNegocio"
        component={RestaurantManageScreen}
        options={{
          title: 'Menú',
          headerShown: false,
          tabBarLabel: 'Menú',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="restaurant" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={LazyProfileScreen}
        options={{
          title: 'Mi perfil',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function RestaurantNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenDefaults}>
      <Stack.Screen
        name="Main"
        component={RestaurantTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{ ...modalPresentationOptions, title: 'Detalle' }}
      />
    </Stack.Navigator>
  );
}
