type SessionListener = () => void;

const expiredListeners = new Set<SessionListener>();
const accountInactiveListeners = new Set<SessionListener>();

export const sessionEvents = {
  onExpired(listener: SessionListener) {
    expiredListeners.add(listener);
    return () => {
      expiredListeners.delete(listener);
    };
  },
  emitExpired() {
    expiredListeners.forEach((fn) => fn());
  },
  onAccountInactive(listener: SessionListener) {
    accountInactiveListeners.add(listener);
    return () => {
      accountInactiveListeners.delete(listener);
    };
  },
  emitAccountInactive() {
    accountInactiveListeners.forEach((fn) => fn());
  },
};
