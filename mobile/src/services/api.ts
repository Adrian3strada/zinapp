import axios from 'axios';

import { API_TIMEOUT_MS, API_URL } from '../config/api';
import type {
  AdminStats,
  AuthResponse,
  CouponValidation,
  DeliveryProfile,
  GeocodeResult,
  LocalService,
  Order,
  OrderActiveSummary,
  OrderDispute,
  PaginatedResponse,
  Product,
  ProductPromotion,
  PublicCoupon,
  Restaurant,
  Review,
  Shipment,
  ShipmentActiveSummary,
  SettlementSummary,
  User,
} from '../types';
import { roundCoordinate } from '../utils/coords';
import { canRetryOnNetworkError, isMutationMethod, isRetryableNetworkError, sleep, wakeBackend } from './apiWake';
import { sessionEvents } from './sessionEvents';
import { tokenStorage } from './tokenStorage';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: API_TIMEOUT_MS,
});

api.interceptors.request.use(async (config) => {
  if (config.data instanceof FormData) {
    // Axios debe armar multipart/form-data con boundary; JSON rompe la subida de imágenes.
    if (config.headers) {
      if (typeof config.headers.delete === 'function') {
        config.headers.delete('Content-Type');
        config.headers.delete('content-type');
      } else {
        delete config.headers['Content-Type'];
        delete config.headers['content-type'];
      }
    }
    config.timeout = Math.max(config.timeout ?? 0, 120000);
  }
  if (isMutationMethod(config.method)) {
    await wakeBackend(true);
  }
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
      // Sin refresh no hay sesión renovable. No emitir "expired": en modo
      // invitado un 401 de endpoint protegido no debe expulsar al guest.
      return null;
    }

    try {
      const { data } = await axios.post<{ access: string; refresh?: string }>(
        `${API_URL}/auth/token/refresh/`,
        { refresh },
      );
      await tokenStorage.setTokens(data.access, data.refresh ?? refresh);
      return data.access;
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      // Solo invalidar sesión si el refresh fue rechazado (401/403).
      // Errores de red/5xx/404 no deben cerrar la sesión.
      if (status === 401 || status === 403) {
        await tokenStorage.clear();
        sessionEvents.emitExpired();
      }
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Renueva el access token si hay refresh guardado (arranque / reabrir app). */
export async function ensureFreshAccessToken(): Promise<string | null> {
  const refresh = await tokenStorage.getRefreshToken();
  if (!refresh) {
    return tokenStorage.getAccessToken();
  }
  const fresh = await refreshAccessToken();
  if (fresh) return fresh;
  return tokenStorage.getAccessToken();
}

function requestHadAuthHeader(headers?: Record<string, string> | unknown): boolean {
  if (!headers || typeof headers !== 'object') return false;
  const h = headers as Record<string, string> & {
    get?: (name: string) => string | undefined;
  };
  if (typeof h.get === 'function') {
    const value = h.get('Authorization') ?? h.get('authorization');
    return Boolean(value);
  }
  return Boolean(h.Authorization || h.authorization);
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as {
      _retry?: boolean;
      _networkRetry?: number;
      headers?: Record<string, string>;
      url?: string;
      method?: string;
    } | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/token/refresh/') || originalRequest.url?.includes('/token/refresh/')) {
        await tokenStorage.clear();
        sessionEvents.emitExpired();
        return Promise.reject(error);
      }

      // Invitado / anónimo: no intentar refresh ni cerrar "sesión".
      const [accessToken, refreshToken] = await Promise.all([
        tokenStorage.getAccessToken(),
        tokenStorage.getRefreshToken(),
      ]);
      if (!accessToken && !refreshToken && !requestHadAuthHeader(originalRequest.headers)) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      const access = await refreshAccessToken();
      if (!access) return Promise.reject(error);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${access}`;
      }
      return api(originalRequest);
    }

    if (
      isRetryableNetworkError(error)
      && canRetryOnNetworkError(originalRequest.method, originalRequest.url)
    ) {
      const maxRetries = (originalRequest.method ?? 'get').toUpperCase() === 'GET' ? 3 : 2;
      const attempt = originalRequest._networkRetry ?? 0;
      if (attempt < maxRetries) {
        originalRequest._networkRetry = attempt + 1;
        if (attempt === 0) {
          await wakeBackend(true);
        }
        await sleep(1500 * (attempt + 1));
        return api(originalRequest);
      }
    }

    return Promise.reject(error);
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
  tip_amount?: number | string;
  scheduled_for?: string;
  items: { product_id: number; quantity: number; notes?: string; option_ids?: number[] }[];
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
  updateMeForm: (data: FormData) => api.patch<User>('/auth/me/', data),
  changePassword: (old_password: string, new_password: string) =>
    api.post('/auth/change-password/', { old_password, new_password }),
  deleteAccount: (password: string, confirmation = 'ELIMINAR') =>
    api.post<{ detail: string }>('/auth/delete-account/', { password, confirmation }),
  forgotPassword: (identifier: string) =>
    api.post<{
      detail: string;
      reset_token?: string;
      hint?: string;
      password_reset_via_whatsapp?: boolean;
    }>('/auth/forgot-password/', { identifier }),
  resetPassword: (token: string, new_password: string) =>
    api.post('/auth/reset-password/', { token, new_password }),
  registerPushToken: (expo_push_token: string) =>
    api.post('/auth/push-token/', { expo_push_token }),
};

export const restaurantApi = {
  list: (page = 1, category?: string) =>
    api.get<PaginatedResponse<Restaurant>>('/restaurants/', {
      params: { page, ...(category ? { category } : {}) },
    }),
  get: (id: number) => api.get<Restaurant & { products: Product[] }>(`/restaurants/${id}/`),
  toggleFavorite: (id: number) =>
    api.post<{ is_favorited: boolean }>(`/restaurants/${id}/toggle-favorite/`),
  mine: () => api.get<Restaurant & { products: Product[] }>('/restaurants/mine/'),
  patch: (id: number, data: Partial<Pick<Restaurant, 'accepting_orders' | 'name' | 'phone' | 'address'>>) =>
    api.patch<Restaurant>(`/restaurants/${id}/`, data),
  update: (id: number, data: FormData) => api.patch<Restaurant>(`/restaurants/${id}/`, data),
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
  featured: (limit = 8) =>
    api.get<Product[]>('/products/featured/', { params: { limit } }),
  listByRestaurant: (restaurantId: number, page = 1) =>
    api.get<PaginatedResponse<Product>>('/products/', {
      params: { restaurant: restaurantId, page },
    }),
  patch: (id: number, data: Partial<Pick<Product, 'name' | 'description' | 'price' | 'is_available'>>) =>
    api.patch<Product>(`/products/${id}/`, data),
  update: (id: number, data: FormData) => api.patch<Product>(`/products/${id}/`, data),
  create: (data: FormData) => api.post<Product>('/products/', data),
  delete: (id: number) => api.delete(`/products/${id}/`),
  replaceOptionGroups: (
    id: number,
    groups: Array<{
      name: string;
      min_select: number;
      max_select: number;
      options: Array<{ name: string; price_delta: string; is_available?: boolean }>;
    }>,
  ) => api.put<Product>(`/products/${id}/option-groups/`, { groups }),
};

export interface CreatePromotionPayload {
  product: number;
  promo_type: ProductPromotion['promo_type'];
  percent_off?: number;
  special_price?: string;
  label?: string;
  valid_until: string;
}

export const promotionApi = {
  mine: () => api.get<ProductPromotion[]>('/promotions/mine/'),
  create: (data: CreatePromotionPayload) => api.post<ProductPromotion>('/promotions/', data),
  patch: (id: number, data: Partial<CreatePromotionPayload & { is_active: boolean }>) =>
    api.patch<ProductPromotion>(`/promotions/${id}/`, data),
  delete: (id: number) => api.delete(`/promotions/${id}/`),
};

export const deliveryApi = {
  getProfile: () => api.get<DeliveryProfile>('/auth/delivery-profiles/me/'),
  updateProfile: (data: { vehicle_type?: string; license_plate?: string } | FormData) =>
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
  create: (data: CreateOrderPayload, options?: { idempotencyKey?: string }) =>
    api.post<Order>(
      '/orders/',
      {
        ...data,
        delivery_latitude:
          data.delivery_latitude != null
            ? roundCoordinate(data.delivery_latitude)
            : undefined,
        delivery_longitude:
          data.delivery_longitude != null
            ? roundCoordinate(data.delivery_longitude)
            : undefined,
      },
      options?.idempotencyKey
        ? { headers: { 'Idempotency-Key': options.idempotencyKey } }
        : undefined,
    ),
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
  messages: (id: number) => api.get<import('../types').OrderMessage[]>(`/orders/${id}/messages/`),
  sendMessage: (id: number, body: string) =>
    api.post<import('../types').OrderMessage>(`/orders/${id}/messages/`, { body }),
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
  create: (data: CreateShipmentPayload, options?: { idempotencyKey?: string }) =>
    api.post<Shipment>(
      '/shipments/',
      {
        ...data,
        pickup_latitude:
          data.pickup_latitude != null ? roundCoordinate(data.pickup_latitude) : undefined,
        pickup_longitude:
          data.pickup_longitude != null ? roundCoordinate(data.pickup_longitude) : undefined,
        delivery_latitude:
          data.delivery_latitude != null ? roundCoordinate(data.delivery_latitude) : undefined,
        delivery_longitude:
          data.delivery_longitude != null ? roundCoordinate(data.delivery_longitude) : undefined,
      },
      options?.idempotencyKey
        ? { headers: { 'Idempotency-Key': options.idempotencyKey } }
        : undefined,
    ),
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

export const chatApi = {
  list: (orderId: number) => orderApi.messages(orderId),
  send: (orderId: number, body: string) => orderApi.sendMessage(orderId, body),
};

export const disputeApi = {
  create: (data: { order: number; reason: string; requested_amount: string }) =>
    api.post<OrderDispute>('/disputes/', data),
  list: () => api.get<OrderDispute[]>('/disputes/'),
};

export const settlementApi = {
  driver: () => api.get<SettlementSummary>('/orders/settlements/driver/'),
  restaurant: () => api.get<SettlementSummary>('/orders/settlements/restaurant/'),
};

export const couponApi = {
  listActive: () => api.get<PublicCoupon[]>('/coupons/active/'),
  validate: (code: string, subtotal: number) =>
    api.post<CouponValidation>('/coupons/validate/', { code, subtotal: subtotal.toFixed(2) }),
};

export const localServiceApi = {
  list: (category?: string) =>
    api.get<LocalService[]>('/local-services/', {
      params: category ? { category } : undefined,
    }),
};

export const reviewApi = {
  create: (data: {
    order: number;
    restaurant_rating: number;
    driver_rating?: number;
    comment?: string;
  }) => api.post<Review>('/reviews/', data),
  listByRestaurant: async (restaurantId: number) => {
    const { data } = await api.get<PaginatedResponse<Review> | Review[]>('/reviews/', {
      params: { restaurant: restaurantId },
    });
    const results = Array.isArray(data) ? data : data.results ?? [];
    return { data: results };
  },
};

export const adminApi = {
  stats: () => api.get<AdminStats>('/admin/stats/'),
  users: () => api.get<PaginatedResponse<User>>('/auth/users/'),
};

export interface AppConfig {
  online_payments_enabled: boolean;
  support_whatsapp: string;
  password_reset_via_whatsapp: boolean;
  password_reset_email_enabled?: boolean;
  coverage_label: string;
}

export const configApi = {
  get: () => api.get<AppConfig>('/config/'),
};

export default api;
