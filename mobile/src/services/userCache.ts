import { deleteStorageItem, getStorageItem, setStorageItem } from '../utils/secureStorage';

import type { User } from '../types';

const USER_KEY = 'zinapp_user_cache';

export const userCache = {
  async get(): Promise<User | null> {
    const raw = await getStorageItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  async set(user: User): Promise<void> {
    await setStorageItem(USER_KEY, JSON.stringify(user));
  },

  async clear(): Promise<void> {
    await deleteStorageItem(USER_KEY);
  },
};
