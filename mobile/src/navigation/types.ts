import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { PendingDialogButton } from '../utils/appDialogStore';
import type { Product } from '../types';

export type RootStackParamList = {
  Main: undefined;
  AppDialog: {
    dialogKey: string;
    title: string;
    message: string;
    buttons: PendingDialogButton[];
    cancelable?: boolean;
  };
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
};

export type CustomerTabParamList = {
  Inicio: undefined;
  Pedidos: undefined;
  Carrito: undefined;
  Perfil: undefined;
};

export type CustomerStackParamList = {
  Main: NavigatorScreenParams<CustomerTabParamList> | undefined;
  Comida: undefined;
  Servicios: undefined;
  Menu: { restaurantId: number; restaurantName: string };
  ProductDetail: { product: Product; restaurantName?: string };
  OrderDetail: { orderId: number; promptReview?: boolean };
  ParticipantProfile: { orderId: number; participant: 'driver' | 'customer' };
  Ofertas: undefined;
  RestaurantReviews: { restaurantId: number; restaurantName: string };
};

export type RestaurantTabParamList = {
  Pedidos: undefined;
  MiNegocio: undefined;
  Perfil: undefined;
};

export type RestaurantStackParamList = {
  Main: undefined;
  OrderDetail: { orderId: number };
  ParticipantProfile: { orderId: number; participant: 'driver' | 'customer' };
};

export type DriverTabParamList = {
  Disponibles: undefined;
  Entregas: undefined;
  Perfil: undefined;
};

export type DriverStackParamList = {
  Main: undefined;
  OrderDetail: { orderId: number; promptReview?: boolean };
  ParticipantProfile: { orderId: number; participant: 'driver' | 'customer' };
  DriverMap: { orderId: number };
};

export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type RegisterScreenProps = NativeStackScreenProps<AuthStackParamList, 'Register'>;
export type ForgotPasswordScreenProps = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;
export type ResetPasswordScreenProps = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>;
export type DriverMapScreenProps = NativeStackScreenProps<DriverStackParamList, 'DriverMap'>;
export type MyDeliveriesScreenProps = CompositeScreenProps<
  BottomTabScreenProps<DriverTabParamList, 'Entregas'>,
  NativeStackScreenProps<DriverStackParamList>
>;
export type AvailableOrdersScreenProps = CompositeScreenProps<
  BottomTabScreenProps<DriverTabParamList, 'Disponibles'>,
  NativeStackScreenProps<DriverStackParamList>
>;
export type RestaurantsScreenProps = NativeStackScreenProps<CustomerStackParamList, 'Comida'>;

export type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Inicio'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export type ServicesScreenProps = NativeStackScreenProps<CustomerStackParamList, 'Servicios'>;
export type OffersScreenProps = NativeStackScreenProps<CustomerStackParamList, 'Ofertas'>;
export type RestaurantReviewsScreenProps = NativeStackScreenProps<
  CustomerStackParamList,
  'RestaurantReviews'
>;

export type MenuScreenProps = NativeStackScreenProps<CustomerStackParamList, 'Menu'>;
export type ProductDetailScreenProps = NativeStackScreenProps<
  CustomerStackParamList,
  'ProductDetail'
>;
export type CartScreenProps = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Carrito'>,
  NativeStackScreenProps<CustomerStackParamList>
>;
export type MyOrdersScreenProps = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Pedidos'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export type OrderDetailScreenProps =
  | NativeStackScreenProps<CustomerStackParamList, 'OrderDetail'>
  | NativeStackScreenProps<RestaurantStackParamList, 'OrderDetail'>
  | NativeStackScreenProps<DriverStackParamList, 'OrderDetail'>;

export type OrderParticipantProfileScreenProps =
  | NativeStackScreenProps<CustomerStackParamList, 'ParticipantProfile'>
  | NativeStackScreenProps<DriverStackParamList, 'ParticipantProfile'>
  | NativeStackScreenProps<RestaurantStackParamList, 'ParticipantProfile'>;

export type DriverOrderDetailScreenProps = NativeStackScreenProps<
  DriverStackParamList,
  'OrderDetail'
>;
