import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerActiveDeliveriesProvider, useCustomerActiveDeliveries } from '../context/CustomerActiveDeliveriesContext';
import { useCart } from '../context/CartContext';
import HomeScreen from '../screens/customer/HomeScreen';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import type {
  CartScreenProps,
  CustomerStackParamList,
  CustomerTabParamList,
  MenuScreenProps,
  MyOrdersScreenProps,
  OrderDetailScreenProps,
  OffersScreenProps,
  RestaurantsScreenProps,
  ShipmentsScreenProps,
} from './types';

const CartScreen = React.lazy(() => import('../screens/customer/CartScreen'));
const MenuScreen = React.lazy(() => import('../screens/customer/MenuScreen'));
const MyOrdersScreen = React.lazy(() => import('../screens/customer/MyOrdersScreen'));
const OffersScreen = React.lazy(() => import('../screens/customer/OffersScreen'));
const RestaurantsScreen = React.lazy(() => import('../screens/customer/RestaurantsScreen'));
const ShipmentsScreen = React.lazy(() => import('../screens/customer/ShipmentsScreen'));
const OrderDetailScreen = React.lazy(() => import('../screens/shared/OrderDetailScreen'));
const ShipmentDetailScreen = React.lazy(() => import('../screens/shared/ShipmentDetailScreen'));
const ProfileScreen = React.lazy(() => import('../screens/shared/ProfileScreen'));

const Tab = createBottomTabNavigator<CustomerTabParamList>();
const Stack = createNativeStackNavigator<CustomerStackParamList>();

function TabFallback() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function LazyCartScreen(props: CartScreenProps) {
  return (
    <Suspense fallback={<TabFallback />}>
      <CartScreen {...props} />
    </Suspense>
  );
}

function LazyMyOrdersScreen(props: MyOrdersScreenProps) {
  return (
    <Suspense fallback={<TabFallback />}>
      <MyOrdersScreen {...props} />
    </Suspense>
  );
}

function LazyProfileScreen() {
  return (
    <Suspense fallback={<TabFallback />}>
      <ProfileScreen />
    </Suspense>
  );
}

function LazyMenuScreen(props: MenuScreenProps) {
  return (
    <Suspense fallback={<TabFallback />}>
      <MenuScreen {...props} />
    </Suspense>
  );
}

function LazyOrderDetailScreen(props: OrderDetailScreenProps) {
  return (
    <Suspense fallback={<TabFallback />}>
      <OrderDetailScreen {...props} />
    </Suspense>
  );
}

function LazyOffersScreen(props: OffersScreenProps) {
  return (
    <Suspense fallback={<TabFallback />}>
      <OffersScreen {...props} />
    </Suspense>
  );
}

function LazyRestaurantsScreen(props: RestaurantsScreenProps) {
  return (
    <Suspense fallback={<TabFallback />}>
      <RestaurantsScreen {...props} />
    </Suspense>
  );
}

function LazyShipmentsScreen(props: ShipmentsScreenProps) {
  return (
    <Suspense fallback={<TabFallback />}>
      <ShipmentsScreen {...props} />
    </Suspense>
  );
}

function CustomerTabs() {
  const { itemCount } = useCart();
  const { activeOrderCount } = useCustomerActiveDeliveries();
  const insets = useSafeAreaInsets();
  const tabBarHeight = spacing.tabBar + insets.bottom;

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          height: tabBarHeight,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
        tabBarItemStyle: { paddingVertical: 2 },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        lazy: true,
      }}
    >
      <Tab.Screen
        name="Inicio"
        component={HomeScreen}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Pedidos"
        component={LazyMyOrdersScreen}
        options={{
          title: 'Mis pedidos',
          tabBarBadge: activeOrderCount > 0 ? activeOrderCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Carrito"
        component={LazyCartScreen}
        options={{
          title: 'Mi carrito',
          tabBarBadge: itemCount > 0 ? itemCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart" size={size} color={color} />
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

function LazyShipmentDetailScreen(props: import('./types').ShipmentDetailScreenProps) {
  return (
    <Suspense fallback={<TabFallback />}>
      <ShipmentDetailScreen {...props} />
    </Suspense>
  );
}

export default function CustomerNavigator() {
  return (
    <CustomerActiveDeliveriesProvider>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontWeight: '700', color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Main"
          component={CustomerTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Comida"
          component={LazyRestaurantsScreen}
          options={{ title: 'Comida' }}
        />
        <Stack.Screen
          name="Ofertas"
          component={LazyOffersScreen}
          options={{ title: 'Ofertas' }}
        />
        <Stack.Screen
          name="Envios"
          component={LazyShipmentsScreen}
          options={{ title: 'Envíos' }}
        />
        <Stack.Screen
          name="Menu"
          component={LazyMenuScreen}
          options={{ title: 'Menú' }}
        />
        <Stack.Screen
          name="OrderDetail"
          component={LazyOrderDetailScreen}
          options={{ title: 'Seguimiento' }}
        />
        <Stack.Screen
          name="ShipmentDetail"
          component={LazyShipmentDetailScreen}
          options={{ title: 'Seguimiento de envío' }}
        />
      </Stack.Navigator>
    </CustomerActiveDeliveriesProvider>
  );
}
