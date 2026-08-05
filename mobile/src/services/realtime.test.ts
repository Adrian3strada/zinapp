import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ensureFreshAccessToken = vi.fn();
const renewAccessTokenForSession = vi.fn();
const createWsTicket = vi.fn();
const getAccessToken = vi.fn();
const emitExpired = vi.fn();
const emitAccountInactive = vi.fn();

vi.mock('../config/api', () => ({
  API_URL: 'https://zinapp.com.mx/api',
}));

vi.mock('./api', () => ({
  ensureFreshAccessToken: (...args: unknown[]) => ensureFreshAccessToken(...args),
  renewAccessTokenForSession: (...args: unknown[]) => renewAccessTokenForSession(...args),
  realtimeApi: {
    createWsTicket: (...args: unknown[]) => createWsTicket(...args),
  },
}));

vi.mock('./tokenStorage', () => ({
  tokenStorage: {
    getAccessToken: (...args: unknown[]) => getAccessToken(...args),
  },
}));

vi.mock('./sessionEvents', () => ({
  sessionEvents: {
    emitExpired: (...args: unknown[]) => emitExpired(...args),
    emitAccountInactive: (...args: unknown[]) => emitAccountInactive(...args),
  },
}));

type MockSocket = {
  readyState: number;
  url: string;
  onopen: ((ev?: unknown) => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onerror: ((ev?: unknown) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

let sockets: MockSocket[] = [];
let ticketSeq = 0;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: MockSocket['onopen'] = null;
  onmessage: MockSocket['onmessage'] = null;
  onerror: MockSocket['onerror'] = null;
  onclose: MockSocket['onclose'] = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
  });

  constructor(url: string) {
    this.url = url;
    sockets.push(this as unknown as MockSocket);
    queueMicrotask(() => {
      if (this.readyState === MockWebSocket.CONNECTING) {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.(undefined);
      }
    });
  }
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
}

describe('RealtimeClient Phase 1', () => {
  let RealtimeClient: typeof import('./realtime').RealtimeClient;
  let client: InstanceType<typeof import('./realtime').RealtimeClient>;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    sockets = [];
    ticketSeq = 0;
    // @ts-expect-error test polyfill
    globalThis.WebSocket = MockWebSocket;

    ensureFreshAccessToken.mockResolvedValue('access-redacted');
    renewAccessTokenForSession.mockResolvedValue('access-redacted');
    getAccessToken.mockResolvedValue('access-redacted');
    createWsTicket.mockImplementation(async (signal?: AbortSignal) => {
      if (signal?.aborted) {
        const err = new Error('aborted');
        (err as { name: string }).name = 'CanceledError';
        throw err;
      }
      ticketSeq += 1;
      return {
        ticket: `ticket-${ticketSeq}`,
        expires_in: 60,
        auth_expires_at: Date.now() / 1000 + 3600,
        ws_path: '/ws/v1/',
      };
    });
    emitExpired.mockReset();
    emitAccountInactive.mockReset();

    ({ RealtimeClient } = await import('./realtime'));
    client = new RealtimeClient();
  });

  afterEach(() => {
    client.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('4004 no genera reconexión infinita', async () => {
    await client.start();
    await flush();
    expect(sockets).toHaveLength(1);

    sockets[0].onclose?.({ code: 4004 });
    await flush();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(emitAccountInactive).toHaveBeenCalledTimes(1);
    expect(client.getDebugState().disabledForSession).toBe(true);
    expect(client.getDebugState().enabled).toBe(false);
    expect(client.getDebugState().hasReconnectTimer).toBe(false);
    expect(createWsTicket.mock.calls.length).toBe(1);
  });

  it('4003 renueva credenciales y solicita un ticket nuevo', async () => {
    await client.start();
    await flush();
    expect(createWsTicket).toHaveBeenCalledTimes(1);

    sockets[0].onclose?.({ code: 4003 });
    await flush();
    expect(renewAccessTokenForSession).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    await flush();

    expect(createWsTicket).toHaveBeenCalledTimes(2);
    expect(createWsTicket.mock.calls[0][0]).not.toBe(createWsTicket.mock.calls[1]?.[0]);
    const firstUrl = sockets[0].url;
    const secondUrl = sockets[1]?.url ?? '';
    expect(firstUrl.includes('ticket-1')).toBe(true);
    expect(secondUrl.includes('ticket-2')).toBe(true);
    expect(firstUrl).not.toBe(secondUrl);
  });

  it('fallo al renovar credenciales detiene la conexión', async () => {
    await client.start();
    await flush();

    renewAccessTokenForSession.mockResolvedValueOnce(null);
    sockets[0].onclose?.({ code: 4001 });
    await flush();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(emitExpired).toHaveBeenCalled();
    expect(client.getDebugState().enabled).toBe(false);
    expect(client.getDebugState().hasReconnectTimer).toBe(false);
    expect(createWsTicket).toHaveBeenCalledTimes(1);
  });

  it('dos connect simultáneos producen una sola petición de ticket y un socket', async () => {
    let resolveTicket!: (value: {
      ticket: string;
      expires_in: number;
      auth_expires_at: number;
      ws_path: string;
    }) => void;
    createWsTicket.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTicket = resolve;
        }),
    );

    const p1 = client.start();
    const p2 = client.start();
    await flush();
    expect(createWsTicket).toHaveBeenCalledTimes(1);

    resolveTicket({
      ticket: 'ticket-shared',
      expires_in: 60,
      auth_expires_at: Date.now() / 1000 + 3600,
      ws_path: '/ws/v1/',
    });
    await Promise.all([p1, p2]);
    await flush();

    expect(createWsTicket).toHaveBeenCalledTimes(1);
    expect(sockets).toHaveLength(1);
  });

  it('stop() durante createWsTicket cancela la petición', async () => {
    let seenSignal: AbortSignal | undefined;
    createWsTicket.mockImplementationOnce(
      (signal?: AbortSignal) =>
        new Promise((_resolve, reject) => {
          seenSignal = signal;
          signal?.addEventListener('abort', () => {
            const err = new Error('aborted');
            (err as { name: string }).name = 'CanceledError';
            reject(err);
          });
        }),
    );

    const startPromise = client.start();
    await flush();
    expect(seenSignal).toBeTruthy();

    client.stop();
    expect(seenSignal?.aborted).toBe(true);
    await startPromise;
    await flush();

    expect(sockets).toHaveLength(0);
    expect(client.getDebugState().hasSocket).toBe(false);
  });

  it('logout/stop elimina socket, reconexión, suscripciones y ticket pendiente', async () => {
    await client.start();
    await flush();
    client.subscribe({ orderId: 11 });
    expect(client.getDebugState().subscriptionCount).toBe(1);

    client.stop();
    expect(client.getDebugState()).toMatchObject({
      enabled: false,
      hasSocket: false,
      hasReconnectTimer: false,
      hasConnectPromise: false,
      subscriptionCount: 0,
      usedTicketCount: 0,
    });
    expect(sockets[0].close).toHaveBeenCalled();
  });

  it('cambio de usuario no reutiliza socket ni suscripciones', async () => {
    await client.start();
    await flush();
    client.subscribe({ orderId: 1 });
    const firstSocket = sockets[0];

    client.stop();
    await client.start();
    await flush();
    client.subscribe({ orderId: 2 });

    expect(firstSocket.close).toHaveBeenCalled();
    expect(sockets).toHaveLength(2);
    expect(client.getDebugState().subscriptionCount).toBe(1);
    expect(sockets[1].url).not.toBe(firstSocket.url);
  });

  it('un ticket nunca se reutiliza después de una reconexión', async () => {
    await client.start();
    await flush();
    const url1 = sockets[0].url;

    sockets[0].onclose?.({ code: 1006 });
    await vi.advanceTimersByTimeAsync(1000);
    await flush();

    const url2 = sockets[1].url;
    expect(url1).not.toBe(url2);
    expect(url1.includes('ticket-1')).toBe(true);
    expect(url2.includes('ticket-2')).toBe(true);
    expect(createWsTicket).toHaveBeenCalledTimes(2);
  });

  it('socket anterior se cierra antes de crear uno nuevo', async () => {
    await client.start();
    await flush();
    const first = sockets[0];

    sockets[0].onclose?.({ code: 1006 });
    await vi.advanceTimersByTimeAsync(1000);
    await flush();

    expect(first.close).toHaveBeenCalled();
    expect(sockets).toHaveLength(2);
    expect(sockets[1]).not.toBe(first);
  });
});
