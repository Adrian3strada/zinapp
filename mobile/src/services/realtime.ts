import { API_URL } from '../config/api';
import { ensureFreshAccessToken } from './api';
import { tokenStorage } from './tokenStorage';

export type RealtimeEventType =
  | 'connected'
  | 'subscribed'
  | 'pong'
  | 'error'
  | 'order.updated'
  | 'shipment.updated'
  | 'order.message'
  | 'driver.location'
  | 'restaurant.orders'
  | 'drivers.job'
  | string;

export type RealtimeHandler = (data: Record<string, unknown>, type: string) => void;

type SubscribeTarget = {
  orderId?: number;
  shipmentId?: number;
  restaurantId?: number;
};

function wsBaseUrl(): string {
  const api = API_URL.replace(/\/$/, '');
  const root = api.endsWith('/api') ? api.slice(0, -4) : api;
  if (root.startsWith('https://')) return `wss://${root.slice('https://'.length)}`;
  if (root.startsWith('http://')) return `ws://${root.slice('http://'.length)}`;
  return root;
}

class RealtimeClient {
  private socket: WebSocket | null = null;
  private handlers = new Map<string, Set<RealtimeHandler>>();
  private anyHandlers = new Set<RealtimeHandler>();
  private desiredSubs = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;
  private reconnectAttempt = 0;
  private enabled = false;

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  on(type: RealtimeEventType | '*', handler: RealtimeHandler): () => void {
    if (type === '*') {
      this.anyHandlers.add(handler);
      return () => {
        this.anyHandlers.delete(handler);
      };
    }
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  }

  async start(): Promise<void> {
    this.enabled = true;
    this.intentionalClose = false;
    await this.connect();
  }

  stop(): void {
    this.enabled = false;
    this.intentionalClose = true;
    this.clearTimers();
    this.socket?.close();
    this.socket = null;
    this.desiredSubs.clear();
  }

  subscribe(target: SubscribeTarget): void {
    const key = this.targetKey(target);
    this.desiredSubs.add(key);
    if (this.isConnected()) {
      this.socket?.send(JSON.stringify({ action: 'subscribe', ...target }));
    }
  }

  unsubscribe(target: SubscribeTarget): void {
    const key = this.targetKey(target);
    this.desiredSubs.delete(key);
    if (this.isConnected()) {
      this.socket?.send(JSON.stringify({ action: 'unsubscribe', ...target }));
    }
  }

  setDriverAvailable(available: boolean): void {
    if (this.isConnected()) {
      this.socket?.send(JSON.stringify({ action: 'set_driver_available', available }));
    }
  }

  private targetKey(target: SubscribeTarget): string {
    if (target.orderId != null) return `o:${target.orderId}`;
    if (target.shipmentId != null) return `s:${target.shipmentId}`;
    if (target.restaurantId != null) return `r:${target.restaurantId}`;
    return 'unknown';
  }

  private parseTarget(key: string): SubscribeTarget | null {
    const [kind, idRaw] = key.split(':');
    const id = Number(idRaw);
    if (!Number.isFinite(id)) return null;
    if (kind === 'o') return { orderId: id };
    if (kind === 's') return { shipmentId: id };
    if (kind === 'r') return { restaurantId: id };
    return null;
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private async connect(): Promise<void> {
    if (!this.enabled) return;
    this.clearTimers();
    try {
      await ensureFreshAccessToken();
      const token = await tokenStorage.getAccessToken();
      if (!token) return;

      const url = `${wsBaseUrl()}/ws/v1/?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.onopen = () => {
        this.reconnectAttempt = 0;
        for (const key of this.desiredSubs) {
          const target = this.parseTarget(key);
          if (target) {
            socket.send(JSON.stringify({ action: 'subscribe', ...target }));
          }
        }
        this.pingTimer = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ action: 'ping' }));
          }
        }, 25000);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as {
            type?: string;
            data?: Record<string, unknown>;
          };
          const type = payload.type ?? '';
          const data = payload.data ?? {};
          const typed = this.handlers.get(type);
          typed?.forEach((h) => h(data, type));
          this.anyHandlers.forEach((h) => h(data, type));
        } catch {
          // ignore malformed
        }
      };

      socket.onclose = (event) => {
        this.clearTimers();
        this.socket = null;
        if (this.intentionalClose || !this.enabled) return;
        // 4001 = auth failed → try refresh then reconnect
        if (event.code === 4001) {
          void ensureFreshAccessToken().finally(() => this.scheduleReconnect());
          return;
        }
        this.scheduleReconnect();
      };

      socket.onerror = () => {
        // onclose will handle reconnect
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.enabled || this.intentionalClose) return;
    const delay = Math.min(15000, 1000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      void this.connect();
    }, delay);
  }
}

export const realtimeClient = new RealtimeClient();
