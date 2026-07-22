import Ionicons from '@expo/vector-icons/Ionicons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { Suspense, useMemo } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomerActiveDeliveriesProvider, useCustomerActiveDeliveries } from '../context/CustomerActiveDeliveriesContext';
import AppErrorBoundary from '../components/AppErrorBoundary';
import CustomerWebLayout from '../components/CustomerWebLayout';
import EmptyState from '../components/EmptyState';
import { useCart } from '../context/CartContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useTabScreenInsets } from '../hooks/useTabScreenInsets';
import CartScreen from '../screens/customer/CartScreen';
import MenuScreen from '../screens/customer/MenuScreen';
import HomeScreen from '../screens/customer/HomeScreen';
import MyOrdersScreenEager from '../screens/customer/MyOrdersScreen';
import RestaurantsScreenEager from '../screens/customer/RestaurantsScreen';
import ServicesScreenEager from '../screens/customer/ServicesScreen';
import OffersScreenEager from '../screens/customer/OffersScreen';
import ProductDetailScreenEager from '../screens/customer/ProductDetailScreen';
import RestaurantReviewsScreenEager from '../screens/customer/RestaurantReviewsScreen';
import OrderDetailScreen from '../screens/shared/OrderDetailScreen';
import OrderParticipantProfileScreen from '../screens/shared/OrderParticipantProfileScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import GuestAccountScreen from '../screens/customer/GuestAccountScreen';
import { useAuth } from '../context/AuthContext';
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
  ProductDetailScreenProps,
  RestaurantsScreenProps,
  ServicesScreenProps,
} from './types';

/** En web evitamos React.lazy (chunks Metro inestables). En nativo sí code-split. */
const MyOrdersScreen =
  Platform.OS === 'web'
    ? MyOrdersScreenEager
    : React.lazy(() => import('../screens/customer/MyOrdersScreen'));
const RestaurantsScreen =
  Platform.OS === 'web'
    ? RestaurantsScreenEager
    : React.lazy(() => import('../screens/customer/RestaurantsScreen'));
const ServicesScreen =
  Platform.OS === 'web'
    ? ServicesScreenEager
    : React.lazy(() => import('../screens/customer/ServicesScreen'));
const OffersScreen =
  Platform.OS === 'web'
    ? OffersScreenEager
    : React.lazy(() => import('../screens/customer/OffersScreen'));
const ProductDetailScreen =
  Platform.OS === 'web'
    ? ProductDetailScreenEager
    : React.lazy(() => import('../screens/customer/ProductDetailScreen'));
const RestaurantReviewsScreen =
  Platform.OS === 'web'
    ? RestaurantReviewsScreenEager
    : React.lazy(() => import('../screens/customer/RestaurantReviewsScreen'));

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

function ProfileScreenWithBoundary() {
  const { user } = useAuth();
  return (
    <AppErrorBoundary>
      {user ? <ProfileScreen /> : <GuestAccountScreen />}
    </AppErrorBoundary>
  );
}

function OrderDetailScreenWithBoundary(props: OrderDetailScreenProps) {
  return (
    <AppErrorBoundary>
      <OrderDetailScreen {...props} />
    </AppErrorBoundary>
  );
}

function OrderParticipantProfileScreenWithBoundary(props: OrderParticipantProfileScreenProps) {
  return (
    <AppErrorBoundary>
      <OrderParticipantProfileScreen {...props} />
    </AppErrorBoundary>
  );
}

function LazyOrderDetailScreen(props: OrderDetailScreenProps) {
  return <OrderDetailScreenWithBoundary {...props} />;
}

function LazyOrderParticipantProfileScreen(props: OrderParticipantProfileScreenProps) {
  return <OrderParticipantProfileScreenWithBoundary {...props} />;
}

function MenuScreenWithBoundary(props: MenuScreenProps) {
  return (
    <AppErrorBoundary>
      <MenuScreen {...props} />
    </AppErrorBoundary>
  );
}

function LazyProductDetailScreen(props: ProductDetailScreenProps) {
  if (Platform.OS === 'web') {
    return (
      <AppErrorBoundary>
        <ProductDetailScreen {...props} />
      </AppErrorBoundary>
    );
  }
  return (
    <Suspense fallback={<TabFallback />}>
      <AppErrorBoundary>
        <ProductDetailScreen {...props} />
      </AppErrorBoundary>
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

function CustomerTabs({ guestMode }: { guestMode?: boolean }) {
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
        component={guestMode ? GuestOrdersTab : LazyMyOrdersScreen}
        options={{
          title: guestMode ? 'Pedidos' : 'Mis pedidos',
          tabBarBadge: !guestMode && activeOrderCount > 0 ? activeOrderCount : undefined,
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

function LazyOffersScreen(props: import('./types').OffersScreenProps) {
  return (
    <Suspense fallback={<TabFallback />}>
      <OffersScreen {...props} />
    </Suspense>
  );
}

function LazyRestaurantReviewsScreen(props: import('./types').RestaurantReviewsScreenProps) {
  if (Platform.OS === 'web') {
    return <RestaurantReviewsScreen {...props} />;
  }
  return (
    <Suspense fallback={<TabFallback />}>
      <RestaurantReviewsScreen {...props} />
    </Suspense>
  );
}

function GuestOrdersTab() {
  const { requestLogin } = useAuth();
  const { scrollPaddingBottom, pagePadding } = useTabScreenInsets();

  return (
    <View style={{ flex: 1, paddingHorizontal: pagePadding, paddingBottom: scrollPaddingBottom().paddingBottom }}>
      <EmptyState
        emoji="🧾"
        title="Tus pedidos aparecerán aquí"
        subtitle="Inicia sesión para ver el historial y seguir entregas en vivo."
        actionLabel="Iniciar sesión"
        onAction={requestLogin}
      />
    </View>
  );
}

export default function CustomerNavigator({
  guestMode = false,
}: {
  guestMode?: boolean;
  onRequestLogin?: () => void;
}) {
  useCustomerPendingNavigation();

  const MainTabs = useMemo(
    () => function CustomerMainTabs() {
      return <CustomerTabs guestMode={guestMode} />;
    },
    [guestMode],
  );

  return (
    <CustomerActiveDeliveriesProvider enabled={!guestMode}>
      <Stack.Navigator screenOptions={stackScreenDefaults}>
        <Stack.Screen
          name="Main"
          component={MainTabs}
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
          name="Ofertas"
          component={LazyOffersScreen}
          options={{ ...modalPresentationOptions, title: 'Ofertas y cupones' }}
        />
        <Stack.Screen
          name="RestaurantReviews"
          component={LazyRestaurantReviewsScreen}
          options={{ ...modalPresentationOptions, title: 'Reseñas' }}
        />
        <Stack.Screen
          name="Menu"
          component={MenuScreenWithBoundary}
          options={{ ...modalPresentationOptions, title: 'Menú' }}
        />
        <Stack.Screen
          name="ProductDetail"
          component={LazyProductDetailScreen}
          options={{ ...modalPresentationOptions, title: 'Platillo' }}
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
