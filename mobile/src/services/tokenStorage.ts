import { Platform } from 'react-native';

import { deleteStorageItem, getStorageItem, setStorageItem } from '../utils/secureStorage';

const ACCESS_KEY = 'zinapp_access_token';
const REFRESH_KEY = 'zinapp_refresh_token';

let memoryAccessToken: string | null | undefined;
let memoryRefreshToken: string | null | undefined;

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    if (memoryAccessToken !== undefined) {
      return memoryAccessToken;
    }
    memoryAccessToken = await getStorageItem(ACCESS_KEY);
    return memoryAccessToken;
  },

  async getRefreshToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return memoryRefreshToken ?? null;
    }
    return getStorageItem(REFRESH_KEY);
  },

  async setTokens(access: string, refresh: string): Promise<void> {
    memoryAccessToken = access;
    memoryRefreshToken = refresh;
    await setStorageItem(ACCESS_KEY, access);
    if (Platform.OS === 'web') {
      await deleteStorageItem(REFRESH_KEY);
      return;
    }
    await setStorageItem(REFRESH_KEY, refresh);
  },

  async clear(): Promise<void> {
    memoryAccessToken = null;
    memoryRefreshToken = null;
    await deleteStorageItem(ACCESS_KEY);
    await deleteStorageItem(REFRESH_KEY);
  },
};
