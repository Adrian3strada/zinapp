import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { authApi, LoginPayload, RegisterPayload } from '../services/api';
import { clearPushToken, registerPushNotifications } from '../services/pushRegistration';
import { sessionEvents } from '../services/sessionEvents';
import { tokenStorage } from '../services/tokenStorage';
import { userCache } from '../services/userCache';
import { redirectToPanelLogin } from '../utils/panelUrl';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isGuest: boolean;
  isLoading: boolean;
  login: (data: LoginPayload) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  enterGuestMode: () => void;
  requestLogin: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const enterGuestMode = useCallback(() => {
    setIsGuest(true);
  }, []);

  const requestLogin = useCallback(() => {
    setIsGuest(false);
  }, []);

  const logout = useCallback(async () => {
    await clearPushToken();
    await tokenStorage.clear();
    await userCache.clear();
    setUser(null);
    setIsGuest(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = await tokenStorage.getAccessToken();
    const refresh = await tokenStorage.getRefreshToken();
    if (!token && !refresh) {
      setUser(null);
      return;
    }
    try {
      const { data } = await authApi.me();
      if (Platform.OS === 'web' && data.role === 'admin') {
        await logout();
        redirectToPanelLogin();
        return;
      }
      setUser(data);
      await userCache.set(data);
    } catch (error: unknown) {
      // Solo cerrar sesión ante 401 (token inválido). Un fallo de red no debe
      // expulsar al usuario si aún hay tokens válidos en el dispositivo.
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        await logout();
      }
    }
  }, [logout]);

  useEffect(() => {
    let cancelled = false;
    const loadingTimeout = setTimeout(() => {
      if (!cancelled) setIsLoading(false);
    }, 8000);

    (async () => {
      try {
        const token = await tokenStorage.getAccessToken();
        const refresh = await tokenStorage.getRefreshToken();
        if (!token && !refresh) {
          if (!cancelled) setUser(null);
          return;
        }

        const cached = await userCache.get();
        if (cached && !cancelled) {
          if (Platform.OS === 'web' && cached.role === 'admin') {
            await tokenStorage.clear();
            await userCache.clear();
            redirectToPanelLogin();
            return;
          }
          setUser(cached);
          setIsLoading(false);
          refreshUser();
          return;
        }

        await refreshUser();
      } catch {
        // No forzar logout aquí: un fallo al arrancar puede ser solo red.
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(loadingTimeout);
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

    if (Platform.OS === 'web' && response.user.role === 'admin') {
      await tokenStorage.clear();
      await userCache.clear();
      setUser(null);
      redirectToPanelLogin();
      return;
    }

    await tokenStorage.setTokens(response.access, response.refresh);
    setIsGuest(false);
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
    <AuthContext.Provider
      value={{
        user,
        isGuest,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        enterGuestMode,
        requestLogin,
      }}
    >
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
