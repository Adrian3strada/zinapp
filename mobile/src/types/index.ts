export type UserRole = 'customer' | 'restaurant' | 'driver' | 'admin';

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cash' | 'transfer' | 'online';

export type PaymentStatus = 'pending' | 'paid' | 'failed';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  phone: string;
  address: string;
  avatar?: string | null;
  avatar_url?: string | null;
  date_joined: string;
}

export interface DeliveryProfile {
  id: number;
  vehicle_type?: 'bicycle' | 'motorcycle' | 'car';
  license_plate?: string;
  is_available: boolean;
  current_latitude?: string | null;
  current_longitude?: string | null;
}

export interface OrderDriverDeliveryProfile {
  vehicle_type?: 'bicycle' | 'motorcycle' | 'car';
  vehicle_type_display?: string;
  license_plate?: string;
}

export interface RestaurantSetupStep {
  key: 'menu' | 'profile' | 'bank' | 'hours' | 'location';
  label: string;
  done: boolean;
}

export interface RestaurantSetupStatus {
  steps: RestaurantSetupStep[];
  done_count: number;
  total_count: number;
  complete: boolean;
  ready_for_orders: boolean;
}

export interface Restaurant {
  id: number;
  name: string;
  category?: string;
  description: string;
  address: string;
  phone: string;
  whatsapp?: string;
  bank_name?: string;
  account_holder?: string;
  clabe?: string;
  has_transfer_info?: boolean;
  image: string | null;
  image_url?: string | null;
  latitude: string | null;
  longitude: string | null;
  is_active: boolean;
  accepting_orders?: boolean;
  is_open?: boolean;
  is_favorited?: boolean;
  rating_average?: number | null;
  reviews_count?: number;
  opening_time?: string | null;
  closing_time?: string | null;
  products_count: number;
  setup_status?: RestaurantSetupStatus;
}

export interface Product {
  id: number;
  restaurant: number;
  name: string;
  description: string;
  price: string;
  image: string | null;
  image_url?: string | null;
  is_available: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

export interface OrderItem {
  id: number;
  product: number;
  product_detail: Product;
  quantity: number;
  unit_price: string;
  subtotal: string;
  notes: string;
}

export interface Review {
  id: number;
  order: number;
  customer_detail?: User;
  restaurant_rating: number;
  driver_rating?: number | null;
  comment: string;
  created_at: string;
}

export interface OrderMessage {
  id: number;
  order: number;
  sender: number;
  sender_name: string;
  sender_role: string;
  body: string;
  created_at: string;
}

export interface OrderDispute {
  id: number;
  order: number;
  order_code?: string;
  reason: string;
  requested_amount: string;
  status: 'pending' | 'approved' | 'rejected' | 'refunded';
  status_display: string;
  admin_notes?: string;
  created_at: string;
}

export interface SettlementSummary {
  period_days: number;
  status: string;
  note?: string;
  deliveries_count?: number;
  delivery_fees?: string;
  tips?: string;
  total_payout?: string;
  orders_count?: number;
  food_sales?: string;
  discounts?: string;
  net_sales?: string;
}

export interface OrderActiveSummary {
  id: number;
  code?: string;
  status: OrderStatus;
  status_display: string;
  restaurant_name?: string;
  delivery_address: string;
  delivery_latitude: string | null;
  delivery_longitude: string | null;
  driver_latitude?: string | null;
  driver_longitude?: string | null;
}

export interface ShipmentActiveSummary {
  id: number;
  status: ShipmentStatus;
  status_display: string;
  description: string;
  delivery_latitude: string | null;
  delivery_longitude: string | null;
  driver_latitude?: string | null;
  driver_longitude?: string | null;
}

export interface Order {
  id: number;
  code?: string;
  customer: number;
  customer_detail?: User;
  restaurant: number;
  restaurant_detail: Restaurant;
  driver: number | null;
  driver_detail?: User | null;
  driver_delivery_profile?: OrderDriverDeliveryProfile | null;
  status: OrderStatus;
  status_display: string;
  payment_method: PaymentMethod;
  payment_method_display: string;
  payment_status?: PaymentStatus;
  payment_status_display?: string;
  delivery_address: string;
  delivery_latitude: string | null;
  delivery_longitude: string | null;
  driver_latitude: string | null;
  driver_longitude: string | null;
  driver_location_updated_at?: string | null;
  delivery_notes: string;
  discount_amount?: string;
  subtotal: string;
  delivery_fee: string;
  tip_amount?: string;
  scheduled_for?: string | null;
  total: string;
  items: OrderItem[];
  review?: Review | null;
  dispute?: OrderDispute | null;
  created_at: string;
  updated_at: string;
}

export type ShipmentStatus = 'pending' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';

export type ShipmentSize = 'small' | 'medium' | 'large';

export interface Shipment {
  id: number;
  customer: number;
  customer_detail?: User;
  driver: number | null;
  driver_detail?: User | null;
  status: ShipmentStatus;
  status_display: string;
  description: string;
  size: ShipmentSize;
  size_display: string;
  pickup_address: string;
  pickup_latitude: string | null;
  pickup_longitude: string | null;
  pickup_notes: string;
  delivery_address: string;
  delivery_latitude: string | null;
  delivery_longitude: string | null;
  delivery_notes: string;
  payment_method: PaymentMethod;
  payment_method_display: string;
  payment_status?: PaymentStatus;
  payment_status_display?: string;
  delivery_fee: string;
  total: string;
  driver_latitude: string | null;
  driver_longitude: string | null;
  driver_location_updated_at?: string | null;
  created_at: string;
  updated_at: string;
  delivered_at?: string | null;
}

export interface AdminStats {
  users: number;
  restaurants: number;
  restaurants_active?: number;
  restaurants_pending?: number;
  orders: number;
  orders_pending: number;
  orders_active: number;
  coupons: number;
  disputes_pending?: number;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  display_name: string;
  in_coverage: boolean;
  approximate?: boolean;
}

export interface CouponValidation {
  code: string;
  discount_amount: string;
  description: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface PublicCoupon {
  id: number;
  code: string;
  description: string;
  discount_percent: number;
  discount_fixed: string;
  min_order_amount: string;
  expires_at: string | null;
}

export interface LocalService {
  id: number;
  name: string;
  category: string;
  category_display: string;
  description: string;
  logo?: string | null;
  logo_url?: string | null;
  address: string;
  schedule: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
