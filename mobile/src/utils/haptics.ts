import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export async function impactLight(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // optional feedback
  }
}

export async function notificationSuccess(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // optional feedback
  }
}
