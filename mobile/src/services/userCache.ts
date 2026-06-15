import * as SecureStore from 'expo-secure-store';

import type { User } from '../types';

const USER_KEY = 'zinapp_user_cache';

export const userCache = {
  async get(): Promise<User | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  async set(user: User): Promise<void> {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(USER_KEY);
  },
};
