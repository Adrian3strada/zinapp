import axios from 'axios';

import { API_TIMEOUT_MS, API_URL } from '../config/api';
import type {
  AdminStats,
  AuthResponse,
  CouponValidation,
  DeliveryProfile,
  GeocodeResult,
  Order,
  OrderActiveSummary,
  PaginatedResponse,
  Product,
  PublicCoupon,
  Restaurant,
  Review,
  Shipment,
  ShipmentActiveSummary,
  User,
} from '../types';
import { roundCoordinate } from '../utils/coords';
import { sessionEvents } from './sessionEvents';
import { tokenStorage } from './tokenStorage';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: API_TIMEOUT_MS,
});

api.interceptors.request.use(async (config) => {
  const token = await tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refresh = await tokenStorage.getRefreshToken();
    if (!refresh) {
      await tokenStorage.clear();
      sessionEvents.emitExpired();
      return null;
    }

    try {
      const { data } = await axios.post<{ access: string; refresh?: string }>(
        `${API_URL}/token/refresh/`,
        { refresh },
      );
      await tokenStorage.setTokens(data.access, data.refresh ?? refresh);
      return data.access;
    } catch {
      await tokenStorage.clear();
      sessionEvents.emitExpired();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as {
      _retry?: boolean;
      headers?: Record<string, string>;
      url?: string;
    } | undefined;
    if (!originalRequest || error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    if (originalRequest.url?.includes('/token/refresh/')) {
      await tokenStorage.clear();
      sessionEvents.emitExpired();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const access = await refreshAccessToken();
    if (!access) return Promise.reject(error);

    if (originalRequest.headers) {
      originalRequest.headers.Authorization = `Bearer ${access}`;
    }
    return api(originalRequest);
  },
);

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name?: string;
  last_name?: string;
  role: 'customer' | 'restaurant' | 'driver';
  phone?: string;
  address?: string;
  restaurant_name?: string;
  restaurant_address?: string;
  restaurant_phone?: string;
  restaurant_description?: string;
  vehicle_type?: 'bicycle' | 'motorcycle' | 'car';
  license_plate?: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface CreateOrderPayload {
  restaurant_id: number;
  delivery_address: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  delivery_notes?: string;
  payment_method: 'cash' | 'transfer' | 'online';
  coupon_code?: string;
  items: { product_id: number; quantity: number; notes?: string }[];
}

export interface CreateShipmentPayload {
  description: string;
  size: 'small' | 'medium' | 'large';
  pickup_address: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_notes?: string;
  delivery_address: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  delivery_notes?: string;
  payment_method: 'cash' | 'transfer' | 'online';
}

export const authApi = {
  register: (data: RegisterPayload) => api.post<User>('/auth/register/', data),
  login: (data: LoginPayload) => api.post<AuthResponse>('/auth/login/', data),
  me: () => api.get<User>('/auth/me/'),
  updateMe: (data: Partial<User>) => api.patch<User>('/auth/me/', data),
  updateMeForm: (data: FormData) =>
    api.patch<User>('/auth/me/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  changePassword: (old_password: string, new_password: string) =>
    api.post('/auth/change-password/', { old_password, new_password }),
  forgotPassword: (username: string) =>
    api.post<{ detail: string; reset_token?: string; hint?: string }>('/auth/forgot-password/', { username }),
  resetPassword: (token: string, new_password: string) =>
    api.post('/auth/reset-password/', { token, new_password }),
  registerPushToken: (expo_push_token: string) =>
    api.post('/auth/push-token/', { expo_push_token }),
};

export const restaurantApi = {
  list: (page = 1) =>
    api.get<PaginatedResponse<Restaurant>>('/restaurants/', { params: { page } }),
  get: (id: number) => api.get<Restaurant & { products: Product[] }>(`/restaurants/${id}/`),
  mine: () => api.get<Restaurant & { products: Product[] }>('/restaurants/mine/'),
  update: (id: number, data: FormData) =>
    api.patch<Restaurant>(`/restaurants/${id}/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  geocode: (address: string) => api.post<GeocodeResult>('/geocode/', { address }),
  checkCoverage: (latitude: number, longitude: number) =>
    api.post<{ in_coverage: boolean }>('/coverage/check/', {
      latitude: roundCoordinate(latitude),
      longitude: roundCoordinate(longitude),
    }),
  route: (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) =>
    api.post<{
      coordinates: { latitude: number; longitude: number }[];
      distance_meters: number | null;
      duration_seconds: number | null;
      is_fallback?: boolean;
    }>('/route/', {
      from_latitude: roundCoordinate(from.latitude),
      from_longitude: roundCoordinate(from.longitude),
      to_latitude: roundCoordinate(to.latitude),
      to_longitude: roundCoordinate(to.longitude),
    }),
  coverageBounds: () =>
    api.get<{
      label: string;
      bounds: { min_lat: number; max_lat: number; min_lon: number; max_lon: number };
      center: { latitude: number; longitude: number };
    }>('/coverage/bounds/'),
};

export const productApi = {
  listByRestaurant: (restaurantId: number, page = 1) =>
    api.get<PaginatedResponse<Product>>('/products/', {
      params: { restaurant: restaurantId, page },
    }),
  update: (id: number, data: FormData) =>
    api.patch<Product>(`/products/${id}/`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  create: (data: FormData) =>
    api.post<Product>('/products/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: number) => api.delete(`/products/${id}/`),
};

export const deliveryApi = {
  getProfile: () => api.get<DeliveryProfile>('/auth/delivery-profiles/me/'),
  updateProfile: (data: { vehicle_type?: string; license_plate?: string }) =>
    api.patch<DeliveryProfile>('/auth/delivery-profiles/me/', data),
  updateLocation: (latitude: number, longitude: number) =>
    api.patch('/auth/delivery-profiles/me/', {
      current_latitude: roundCoordinate(latitude),
      current_longitude: roundCoordinate(longitude),
    }),
  setAvailability: (is_available: boolean) =>
    api.patch('/auth/delivery-profiles/me/', { is_available }),
};

export const orderApi = {
  list: (page = 1) =>
    api.get<PaginatedResponse<Order>>('/orders/', { params: { page } }),
  get: (id: number) => api.get<Order>(`/orders/${id}/`),
  create: (data: CreateOrderPayload) =>
    api.post<Order>('/orders/', {
      ...data,
      delivery_latitude:
        data.delivery_latitude != null
          ? roundCoordinate(data.delivery_latitude)
          : undefined,
      delivery_longitude:
        data.delivery_longitude != null
          ? roundCoordinate(data.delivery_longitude)
          : undefined,
    }),
  accept: (id: number) => api.post<Order>(`/orders/${id}/accept/`),
  reject: (id: number) => api.post<Order>(`/orders/${id}/reject/`),
  cancel: (id: number) => api.post<Order>(`/orders/${id}/cancel/`),
  updateStatus: (id: number, status: string) =>
    api.post<Order>(`/orders/${id}/update-status/`, { status }),
  available: () => api.get<Order[]>('/orders/available/'),
  acceptDelivery: (id: number) => api.post<Order>(`/orders/${id}/accept-delivery/`),
  markDelivered: (id: number) => api.post<Order>(`/orders/${id}/mark-delivered/`),
  restaurantPending: () => api.get<Order[]>('/orders/restaurant-pending/'),
  myDeliveries: () => api.get<Order[]>('/orders/my-deliveries/'),
  driverEarnings: () =>
    api.get<{
      week_deliveries: number;
      week_orders: number;
      week_shipments: number;
      week_earnings: string;
      cash_deliveries: number;
      transfer_deliveries: number;
      daily_breakdown: {
        date: string;
        deliveries: number;
        orders: number;
        shipments: number;
        earnings: string;
      }[];
    }>('/orders/driver-earnings/'),
  active: () => api.get<OrderActiveSummary[]>('/orders/active/'),
  initiatePayment: (id: number) =>
    api.post<{
      payment_status: string;
      payment_url?: string | null;
      message?: string;
      order_id: number;
      amount: string;
    }>(`/orders/${id}/initiate-payment/`),
  confirmPayment: (id: number) => api.post<Order>(`/orders/${id}/confirm-payment/`),
};

export const shipmentApi = {
  list: (page = 1) =>
    api.get<PaginatedResponse<Shipment>>('/shipments/', { params: { page } }),
  get: (id: number) => api.get<Shipment>(`/shipments/${id}/`),
  create: (data: CreateShipmentPayload) =>
    api.post<Shipment>('/shipments/', {
      ...data,
      pickup_latitude:
        data.pickup_latitude != null ? roundCoordinate(data.pickup_latitude) : undefined,
      pickup_longitude:
        data.pickup_longitude != null ? roundCoordinate(data.pickup_longitude) : undefined,
      delivery_latitude:
        data.delivery_latitude != null ? roundCoordinate(data.delivery_latitude) : undefined,
      delivery_longitude:
        data.delivery_longitude != null ? roundCoordinate(data.delivery_longitude) : undefined,
    }),
  cancel: (id: number) => api.post<Shipment>(`/shipments/${id}/cancel/`),
  available: () => api.get<Shipment[]>('/shipments/available/'),
  acceptDelivery: (id: number) => api.post<Shipment>(`/shipments/${id}/accept-delivery/`),
  markPickedUp: (id: number) => api.post<Shipment>(`/shipments/${id}/mark-picked-up/`),
  markDelivered: (id: number) => api.post<Shipment>(`/shipments/${id}/mark-delivered/`),
  myDeliveries: () => api.get<Shipment[]>('/shipments/my-deliveries/'),
  active: () => api.get<ShipmentActiveSummary[]>('/shipments/active/'),
  sizes: () =>
    api.get<{ key: string; label: string; fee: string; hint: string }[]>('/shipments/sizes/'),
};

export const couponApi = {
  listActive: () => api.get<PublicCoupon[]>('/coupons/active/'),
  validate: (code: string, subtotal: number) =>
    api.post<CouponValidation>('/coupons/validate/', { code, subtotal: subtotal.toFixed(2) }),
};

export const reviewApi = {
  create: (data: {
    order: number;
    restaurant_rating: number;
    driver_rating?: number;
    comment?: string;
  }) => api.post<Review>('/reviews/', data),
};

export const adminApi = {
  stats: () => api.get<AdminStats>('/admin/stats/'),
  users: () => api.get<PaginatedResponse<User>>('/auth/users/'),
};

export default api;
