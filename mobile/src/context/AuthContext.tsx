import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { authApi, LoginPayload, RegisterPayload } from '../services/api';
import { clearPushToken, registerPushNotifications } from '../services/pushRegistration';
import { sessionEvents } from '../services/sessionEvents';
import { tokenStorage } from '../services/tokenStorage';
import { userCache } from '../services/userCache';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginPayload) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    await clearPushToken();
    await tokenStorage.clear();
    await userCache.clear();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = await tokenStorage.getAccessToken();
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const { data } = await authApi.me();
      setUser(data);
      await userCache.set(data);
    } catch {
      await logout();
    }
  }, [logout]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await tokenStorage.getAccessToken();
        if (!token) {
          if (!cancelled) setUser(null);
          return;
        }

        const cached = await userCache.get();
        if (cached && !cancelled) {
          setUser(cached);
          setIsLoading(false);
          refreshUser();
          return;
        }

        await refreshUser();
      } catch {
        if (!cancelled) await logout();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshUser, logout]);

  useEffect(() => {
    return sessionEvents.onExpired(() => {
      logout();
    });
  }, [logout]);

  const login = async (data: LoginPayload) => {
    const { data: response } = await authApi.login({
      ...data,
      username: data.username.trim().toLowerCase(),
    });
    await tokenStorage.setTokens(response.access, response.refresh);
    setUser(response.user);
    await userCache.set(response.user);
    void registerPushNotifications();
  };

  const register = async (data: RegisterPayload) => {
    const payload = {
      ...data,
      username: data.username.trim().toLowerCase(),
      email: data.email?.trim().toLowerCase() ?? '',
    };
    await authApi.register(payload);
    try {
      await login({ username: payload.username, password: data.password });
    } catch {
      const err = new Error('LOGIN_AFTER_REGISTER');
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
