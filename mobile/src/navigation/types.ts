import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
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
  Ofertas: undefined;
  Envios: undefined;
  Menu: { restaurantId: number; restaurantName: string };
  OrderDetail: { orderId: number; promptReview?: boolean };
  ShipmentDetail: { shipmentId: number };
};

export type RestaurantTabParamList = {
  Pedidos: undefined;
  MiNegocio: undefined;
  Perfil: undefined;
};

export type RestaurantStackParamList = {
  Main: undefined;
  OrderDetail: { orderId: number };
};

export type DriverTabParamList = {
  Disponibles: undefined;
  Entregas: undefined;
  Perfil: undefined;
};

export type DriverStackParamList = {
  Main: undefined;
  OrderDetail: { orderId: number; promptReview?: boolean };
  ShipmentDetail: { shipmentId: number };
  DriverMap: { orderId?: number; shipmentId?: number };
};

export type AdminTabParamList = {
  Dashboard: undefined;
  Pedidos: undefined;
  Restaurantes: undefined;
  Perfil: undefined;
};

export type AdminStackParamList = {
  Main: undefined;
  Menu: { restaurantId: number; restaurantName: string };
  OrderDetail: { orderId: number };
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
export type AdminOrdersScreenProps = CompositeScreenProps<
  BottomTabScreenProps<AdminTabParamList, 'Pedidos'>,
  NativeStackScreenProps<AdminStackParamList>
>;

export type RestaurantsScreenProps = NativeStackScreenProps<CustomerStackParamList, 'Comida'>;

export type HomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'Inicio'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export type OffersScreenProps = NativeStackScreenProps<CustomerStackParamList, 'Ofertas'>;

export type ShipmentsScreenProps = NativeStackScreenProps<CustomerStackParamList, 'Envios'>;

export type ShipmentDetailScreenProps =
  | NativeStackScreenProps<CustomerStackParamList, 'ShipmentDetail'>
  | NativeStackScreenProps<DriverStackParamList, 'ShipmentDetail'>;

export type MenuScreenProps = NativeStackScreenProps<CustomerStackParamList, 'Menu'>;
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

export type DriverOrderDetailScreenProps = NativeStackScreenProps<
  DriverStackParamList,
  'OrderDetail'
>;
