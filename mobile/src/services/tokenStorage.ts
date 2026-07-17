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
    if (memoryRefreshToken !== undefined) {
      return memoryRefreshToken;
    }
    memoryRefreshToken = await getStorageItem(REFRESH_KEY);
    return memoryRefreshToken;
  },

  async setTokens(access: string, refresh: string): Promise<void> {
    memoryAccessToken = access;
    memoryRefreshToken = refresh;
    await setStorageItem(ACCESS_KEY, access);
    await setStorageItem(REFRESH_KEY, refresh);
  },

  async clear(): Promise<void> {
    memoryAccessToken = null;
    memoryRefreshToken = null;
    await deleteStorageItem(ACCESS_KEY);
    await deleteStorageItem(REFRESH_KEY);
  },
};
