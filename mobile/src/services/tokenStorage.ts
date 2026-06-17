import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'zinapp_access_token';
const REFRESH_KEY = 'zinapp_refresh_token';

let memoryAccessToken: string | null | undefined;

async function safeGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.warn('SecureStore get failed:', err);
    return null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn('SecureStore set failed:', err);
  }
}

async function safeDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.warn('SecureStore delete failed:', err);
  }
}

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    if (memoryAccessToken !== undefined) {
      return memoryAccessToken;
    }
    memoryAccessToken = await safeGet(ACCESS_KEY);
    return memoryAccessToken;
  },

  async getRefreshToken(): Promise<string | null> {
    return safeGet(REFRESH_KEY);
  },

  async setTokens(access: string, refresh: string): Promise<void> {
    memoryAccessToken = access;
    await safeSet(ACCESS_KEY, access);
    await safeSet(REFRESH_KEY, refresh);
  },

  async clear(): Promise<void> {
    memoryAccessToken = null;
    await safeDelete(ACCESS_KEY);
    await safeDelete(REFRESH_KEY);
  },
};
