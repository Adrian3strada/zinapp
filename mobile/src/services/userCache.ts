import * as SecureStore from 'expo-secure-store';

import type { User } from '../types';

const USER_KEY = 'zinapp_user_cache';

export const userCache = {
  async get(): Promise<User | null> {
    try {
      const raw = await SecureStore.getItemAsync(USER_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as User;
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  },

  async set(user: User): Promise<void> {
    try {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch (err) {
      console.warn('userCache set failed:', err);
    }
  },

  async clear(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (err) {
      console.warn('userCache clear failed:', err);
    }
  },
};
