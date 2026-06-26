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
  OrderParticipantProfileScreenProps,
  RestaurantsScreenProps,
  ServicesScreenProps,
} from './types';

const MyOrdersScreen = React.lazy(() => import('../screens/customer/MyOrdersScreen'));
const RestaurantsScreen = React.lazy(() => import('../screens/customer/RestaurantsScreen'));
const ServicesScreen = React.lazy(() => import('../screens/customer/ServicesScreen'));
const OrderDetailScreen = React.lazy(() => import('../screens/shared/OrderDetailScreen'));
const OrderParticipantProfileScreen = React.lazy(() => import('../screens/shared/OrderParticipantProfileScreen'));
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
      <AppErrorBoundary>
        <MyOrdersScreen {...props} />
      </AppErrorBoundary>
    </Suspense>
  );
}

function LazyProfileScreen() {
  return (
    <Suspense fallback={<TabFallback />}>
      <AppErrorBoundary>
        <ProfileScreen />
      </AppErrorBoundary>
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

function LazyOrderParticipantProfileScreen(props: OrderParticipantProfileScreenProps) {
  return (
    <Suspense fallback={<TabFallback />}>
      <AppErrorBoundary>
        <OrderParticipantProfileScreen {...props} />
      </AppErrorBoundary>
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

function LazyRestaurantsScreen(props: RestaurantsScreenProps) {
  return (
    <Suspense fallback={<TabFallback />}>
      <RestaurantsScreen {...props} />
    </Suspense>
  );
}

function LazyServicesScreen(props: ServicesScreenProps) {
  return (
    <Suspense fallback={<TabFallback />}>
      <ServicesScreen {...props} />
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
          name="Servicios"
          component={LazyServicesScreen}
          options={{ ...modalPresentationOptions, title: 'Servicios' }}
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
          name="ParticipantProfile"
          component={LazyOrderParticipantProfileScreen}
          options={({ route }) => ({
            ...modalPresentationOptions,
            title: route.params.participant === 'driver' ? 'Repartidor' : 'Cliente',
          })}
        />
      </Stack.Navigator>
    </CustomerActiveDeliveriesProvider>
  );
}
