import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DriverProfileProvider, useDriverProfileContext } from '../context/DriverProfileContext';
import { useDriverActiveDeliveries } from '../hooks/useDriverHasActiveDelivery';
import { useDriverLocationSharing } from '../hooks/useDriverLocationSharing';
import AvailableOrdersScreen from '../screens/driver/AvailableOrdersScreen';
import DriverMapScreen from '../screens/driver/DriverMapScreen';
import MyDeliveriesScreen from '../screens/driver/MyDeliveriesScreen';
import OrderDetailScreen from '../screens/shared/OrderDetailScreen';
import ShipmentDetailScreen from '../screens/shared/ShipmentDetailScreen';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type { DriverStackParamList, DriverTabParamList } from './types';

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

const Tab = createBottomTabNavigator<DriverTabParamList>();
const Stack = createNativeStackNavigator<DriverStackParamList>();

function DriverTabs() {
  const insets = useSafeAreaInsets();
  const { hasActiveDelivery, activeCount } = useDriverActiveDeliveries();
  const { isAvailable } = useDriverProfileContext();
  useDriverLocationSharing(true, hasActiveDelivery, isAvailable || hasActiveDelivery);

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          height: spacing.tabBar + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
        },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen
        name="Disponibles"
        component={AvailableOrdersScreen}
        options={{
          title: 'Disponibles',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Entregas"
        component={MyDeliveriesScreen}
        options={{
          title: 'Mis entregas',
          tabBarBadge: activeCount > 0 ? activeCount : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="bicycle" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={LazyProfileScreen}
        options={{
          title: 'Mi perfil',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function DriverNavigator() {
  return (
    <DriverProfileProvider>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Main" component={DriverTabs} />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{
          headerShown: true,
          title: 'Entrega',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
        }}
      />
      <Stack.Screen
        name="ShipmentDetail"
        component={ShipmentDetailScreen}
        options={{
          headerShown: true,
          title: 'Envío',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
        }}
      />
      <Stack.Screen
        name="DriverMap"
        component={DriverMapScreen}
        options={{
          headerShown: true,
          title: 'Mapa de entrega',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
        }}
      />
    </Stack.Navigator>
    </DriverProfileProvider>
  );
}
