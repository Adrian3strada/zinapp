import { API_URL } from '../config/api';
import {
  ensureFreshAccessToken,
  realtimeApi,
  renewAccessTokenForSession,
} from './api';
import { sessionEvents } from './sessionEvents';
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

const CLOSE_AUTH = 4001;
const CLOSE_SESSION_EXPIRED = 4003;
const CLOSE_INACTIVE = 4004;

function wsBaseUrl(): string {
  const api = API_URL.replace(/\/$/, '');
  const root = api.endsWith('/api') ? api.slice(0, -4) : api;
  if (root.startsWith('https://')) return `wss://${root.slice('https://'.length)}`;
  if (root.startsWith('http://')) return `ws://${root.slice('http://'.length)}`;
  return root;
}

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private handlers = new Map<string, Set<RealtimeHandler>>();
  private anyHandlers = new Set<RealtimeHandler>();
  private desiredSubs = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;
  private reconnectAttempt = 0;
  private enabled = false;
  /** Tras 4004: no reconectar hasta start() explícito (nueva sesión). */
  private disabledForSession = false;
  private connectPromise: Promise<void> | null = null;
  private connectGeneration = 0;
  private ticketAbort: AbortController | null = null;
  /** Tickets ya consumidos en esta instancia (defensa: nunca reutilizar). */
  private usedTickets = new Set<string>();

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  isEnabled(): boolean {
    return this.enabled && !this.disabledForSession;
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
    this.disabledForSession = false;
    this.enabled = true;
    this.intentionalClose = false;
    await this.connect();
  }

  stop(): void {
    this.enabled = false;
    this.intentionalClose = true;
    this.connectGeneration += 1;
    this.abortTicketRequest();
    this.clearTimers();
    this.teardownSocket();
    this.connectPromise = null;
    this.desiredSubs.clear();
    this.usedTickets.clear();
    this.reconnectAttempt = 0;
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

  /** Visible para pruebas. */
  getDebugState() {
    return {
      enabled: this.enabled,
      disabledForSession: this.disabledForSession,
      intentionalClose: this.intentionalClose,
      reconnectAttempt: this.reconnectAttempt,
      hasSocket: this.socket != null,
      hasReconnectTimer: this.reconnectTimer != null,
      hasConnectPromise: this.connectPromise != null,
      subscriptionCount: this.desiredSubs.size,
      usedTicketCount: this.usedTickets.size,
      connectGeneration: this.connectGeneration,
    };
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

  private abortTicketRequest(): void {
    if (this.ticketAbort) {
      this.ticketAbort.abort();
      this.ticketAbort = null;
    }
  }

  private teardownSocket(): void {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try {
      if (
        socket.readyState === WebSocket.CONNECTING ||
        socket.readyState === WebSocket.OPEN
      ) {
        socket.close();
      }
    } catch {
      // ignore
    }
  }

  private disableForInactiveAccount(): void {
    this.disabledForSession = true;
    this.enabled = false;
    this.intentionalClose = true;
    this.connectGeneration += 1;
    this.abortTicketRequest();
    this.clearTimers();
    this.teardownSocket();
    this.connectPromise = null;
    this.desiredSubs.clear();
    this.reconnectAttempt = 0;
    sessionEvents.emitAccountInactive();
  }

  private stopAfterAuthFailure(): void {
    this.enabled = false;
    this.intentionalClose = true;
    this.connectGeneration += 1;
    this.abortTicketRequest();
    this.clearTimers();
    this.teardownSocket();
    this.connectPromise = null;
    this.desiredSubs.clear();
    this.reconnectAttempt = 0;
    sessionEvents.emitExpired();
  }

  private async connect(): Promise<void> {
    if (this.disabledForSession || !this.enabled || this.intentionalClose) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.runConnect().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  private async runConnect(): Promise<void> {
    const generation = this.connectGeneration;
    this.clearTimers();

    try {
      await ensureFreshAccessToken();
      if (!this.isGenerationActive(generation)) return;

      const access = await tokenStorage.getAccessToken();
      if (!access) return;
      if (!this.isGenerationActive(generation)) return;

      this.abortTicketRequest();
      const abort = new AbortController();
      this.ticketAbort = abort;

      let ticket: string;
      try {
        const issued = await realtimeApi.createWsTicket(abort.signal);
        ticket = issued.ticket;
      } catch (err: unknown) {
        if (abort.signal.aborted || !this.isGenerationActive(generation)) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          this.stopAfterAuthFailure();
          return;
        }
        this.scheduleReconnect();
        return;
      } finally {
        if (this.ticketAbort === abort) {
          this.ticketAbort = null;
        }
      }

      if (!this.isGenerationActive(generation)) return;
      if (!ticket || this.usedTickets.has(ticket)) {
        this.scheduleReconnect();
        return;
      }
      this.usedTickets.add(ticket);

      // Cerrar socket anterior antes de abrir uno nuevo.
      this.teardownSocket();
      if (!this.isGenerationActive(generation)) return;

      const url = `${wsBaseUrl()}/ws/v1/?ticket=${encodeURIComponent(ticket)}`;
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.onopen = () => {
        if (!this.isGenerationActive(generation) || this.socket !== socket) {
          try {
            socket.close();
          } catch {
            // ignore
          }
          return;
        }
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
        if (this.socket !== socket) return;
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
        if (this.socket !== socket) return;
        this.clearTimers();
        // Limpia handlers y cierra de forma idempotente antes de cualquier reconexión.
        this.teardownSocket();

        if (this.intentionalClose || !this.enabled || this.disabledForSession) return;

        if (event.code === CLOSE_INACTIVE) {
          this.disableForInactiveAccount();
          return;
        }

        if (event.code === CLOSE_AUTH || event.code === CLOSE_SESSION_EXPIRED) {
          void this.reconnectAfterAuthClose(generation);
          return;
        }

        this.scheduleReconnect();
      };

      socket.onerror = () => {
        // onclose handles reconnect
      };
    } catch {
      if (!this.isGenerationActive(generation)) return;
      this.scheduleReconnect();
    }
  }

  private async reconnectAfterAuthClose(generation: number): Promise<void> {
    if (!this.isGenerationActive(generation) || this.disabledForSession) return;
    const access = await renewAccessTokenForSession();
    if (!access) {
      this.stopAfterAuthFailure();
      return;
    }
    if (!this.isGenerationActive(generation)) return;
    this.scheduleReconnect();
  }

  private isGenerationActive(generation: number): boolean {
    return (
      generation === this.connectGeneration &&
      this.enabled &&
      !this.intentionalClose &&
      !this.disabledForSession
    );
  }

  private scheduleReconnect(): void {
    if (!this.enabled || this.intentionalClose || this.disabledForSession) return;
    if (this.reconnectTimer) return;
    const delay = Math.min(15000, 1000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }
}

export const realtimeClient = new RealtimeClient();
