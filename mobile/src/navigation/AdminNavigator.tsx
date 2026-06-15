import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useAuth } from '../context/AuthContext';

import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminOrdersScreen from '../screens/admin/AdminOrdersScreen';
import RestaurantsScreen from '../screens/customer/RestaurantsScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import OrderDetailScreen from '../screens/shared/OrderDetailScreen';
import { colors } from '../theme/colors';
import type { AdminStackParamList, AdminTabParamList } from './types';

const MenuScreen = React.lazy(() => import('../screens/customer/MenuScreen'));

const Tab = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<AdminStackParamList>();

function LazyMenuScreen(props: React.ComponentProps<typeof MenuScreen>) {
  return (
    <React.Suspense
      fallback={
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      }
    >
      <MenuScreen {...props} />
    </React.Suspense>
  );
}

function AdminTabs() {
  const { logout } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => (
          <Pressable onPress={logout} style={{ padding: 8, marginRight: 12 }}>
            <Ionicons name="log-out-outline" size={24} color={colors.primary} />
          </Pressable>
        ),
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdminDashboardScreen}
        options={{
          title: 'Admin',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Pedidos"
        component={AdminOrdersScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Restaurantes"
        component={RestaurantsScreen as React.ComponentType}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="restaurant" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Main" component={AdminTabs} />
      <Stack.Screen
        name="Menu"
        component={LazyMenuScreen}
        options={{ headerShown: true, title: 'Menú', headerTintColor: colors.primary }}
      />
      <Stack.Screen
        name="OrderDetail"
        component={OrderDetailScreen}
        options={{ headerShown: true, title: 'Pedido', headerTintColor: colors.primary }}
      />
    </Stack.Navigator>
  );
}
