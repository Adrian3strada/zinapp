import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'zinapp_access_token';
const REFRESH_KEY = 'zinapp_refresh_token';

let memoryAccessToken: string | null | undefined;

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    if (memoryAccessToken !== undefined) {
      return memoryAccessToken;
    }
    memoryAccessToken = await SecureStore.getItemAsync(ACCESS_KEY);
    return memoryAccessToken;
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },

  async setTokens(access: string, refresh: string): Promise<void> {
    memoryAccessToken = access;
    await SecureStore.setItemAsync(ACCESS_KEY, access);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  },

  async clear(): Promise<void> {
    memoryAccessToken = null;
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
