type SessionListener = () => void;

const listeners = new Set<SessionListener>();

export const sessionEvents = {
  onExpired(listener: SessionListener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  emitExpired() {
    listeners.forEach((fn) => fn());
  },
};
