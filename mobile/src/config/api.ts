import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;

// Android emulator: 10.0.2.2 | iOS simulator: localhost | Dispositivo físico: IP de tu PC
export const API_URL = extra?.apiUrl ?? 'http://192.168.1.27:8000/api';
