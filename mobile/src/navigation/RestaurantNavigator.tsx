import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppErrorBoundary from '../components/AppErrorBoundary';
import { RestaurantProvider } from '../context/RestaurantContext';
import { useRestaurantPendingNavigation } from './useRestaurantPendingNavigation';
import { useRestaurantPendingCount } from '../hooks/useRestaurantPendingCount';
import RestaurantManageScreen from '../screens/restaurant/RestaurantManageScreen';
import RestaurantOrdersScreen from '../screens/restaurant/RestaurantOrdersScreen';
import OrderDetailScreen from '../screens/shared/OrderDetailScreen';
import OrderParticipantProfileScreen from '../screens/shared/OrderParticipantProfileScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import { modalPresentationOptions, stackScreenDefaults } from './modalOptions';
import { tabBarScreenOptions } from './tabBarOptions';
import type { RestaurantStackParamList, RestaurantTabParamList } from './types';

function ProfileScreenWithBoundary() {
  return (
    <AppErrorBoundary>
      <ProfileScreen />
    </AppErrorBoundary>
  );
}

const Tab = createBottomTabNavigator<RestaurantTabParamList>();
const Stack = createNativeStackNavigator<RestaurantStackParamList>();

function RestaurantTabs() {
  const insets = useSafeAreaInsets();
  const pendingCount = useRestaurantPendingCount();

  return (
    <RestaurantProvider>
      <RestaurantTabsInner insets={insets} pendingCount={pendingCount} />
    </RestaurantProvider>
  );
}

function RestaurantTabsInner({
  insets,
  pendingCount,
}: {
  insets: { top: number; bottom: number; left: number; right: number };
  pendingCount: number;
}) {
  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions(insets)}>
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
        component={ProfileScreenWithBoundary}
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
  useRestaurantPendingNavigation();

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
      <Stack.Screen
        name="ParticipantProfile"
        component={OrderParticipantProfileScreen}
        options={({ route }) => ({
          ...modalPresentationOptions,
          title: route.params.participant === 'driver' ? 'Repartidor' : 'Cliente',
        })}
      />
    </Stack.Navigator>
  );
}
