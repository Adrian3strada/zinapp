import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerActiveDeliveriesProvider, useCustomerActiveDeliveries } from '../context/CustomerActiveDeliveriesContext';
import AppErrorBoundary from '../components/AppErrorBoundary';
import CustomerWebLayout from '../components/CustomerWebLayout';
import { useCart } from '../context/CartContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import CartScreen from '../screens/customer/CartScreen';
import MenuScreen from '../screens/customer/MenuScreen';
import HomeScreen from '../screens/customer/HomeScreen';
import { colors } from '../theme/colors';
import { modalPresentationOptions, stackScreenDefaults } from './modalOptions';
import { tabBarScreenOptions } from './tabBarOptions';
import { useCustomerPendingNavigation } from './useCustomerPendingNavigation';
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

function CartScreenWithBoundary(props: CartScreenProps) {
  return (
    <AppErrorBoundary>
      <CartScreen {...props} />
    </AppErrorBoundary>
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

function MenuScreenWithBoundary(props: MenuScreenProps) {
  return (
    <AppErrorBoundary>
      <MenuScreen {...props} />
    </AppErrorBoundary>
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
  const { isDesktopWeb } = useResponsiveLayout();

  return (
    <Tab.Navigator
      screenLayout={({ children }) => <CustomerWebLayout>{children}</CustomerWebLayout>}
      screenOptions={{
        ...tabBarScreenOptions(insets, isDesktopWeb),
        lazy: true,
      }}
      tabBar={isDesktopWeb ? () => null : undefined}
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
        component={CartScreenWithBoundary}
        options={{
          title: 'Mi carrito',
          tabBarBadge: itemCount > 0 ? String(itemCount) : undefined,
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
  useCustomerPendingNavigation();

  return (
    <CustomerActiveDeliveriesProvider>
      <Stack.Navigator screenOptions={stackScreenDefaults}>
        <Stack.Screen
          name="Main"
          component={CustomerTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Comida"
          component={LazyRestaurantsScreen}
          options={{ ...modalPresentationOptions, title: 'Comida' }}
        />
        <Stack.Screen
          name="Ofertas"
          component={LazyOffersScreen}
          options={{ ...modalPresentationOptions, title: 'Ofertas' }}
        />
        <Stack.Screen
          name="Envios"
          component={LazyShipmentsScreen}
          options={{ ...modalPresentationOptions, title: 'Envíos' }}
        />
        <Stack.Screen
          name="Menu"
          component={MenuScreenWithBoundary}
          options={{ ...modalPresentationOptions, title: 'Menú' }}
        />
        <Stack.Screen
          name="OrderDetail"
          component={LazyOrderDetailScreen}
          options={{ ...modalPresentationOptions, title: 'Seguimiento' }}
        />
        <Stack.Screen
          name="ShipmentDetail"
          component={LazyShipmentDetailScreen}
          options={{ ...modalPresentationOptions, title: 'Seguimiento de envío' }}
        />
      </Stack.Navigator>
    </CustomerActiveDeliveriesProvider>
  );
}
