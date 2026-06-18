import type { EdgeInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme/spacing';

/** Padding inferior para pantallas dentro de tabs (evita quedar bajo la barra). */
export function tabScreenBottomPadding(insets: EdgeInsets, extra: number = spacing.lg): number {
  return insets.bottom + spacing.tabBar + extra;
}

/** Offset de teclado en tabs sin header nativo (Perfil, Menú restaurante). */
export function keyboardOffsetHeaderless(insets: EdgeInsets): number {
  return insets.top + 8;
}

/** Offset cuando hay header de stack/tab visible (~44pt + status). */
export function keyboardOffsetWithHeader(insets: EdgeInsets): number {
  return insets.top + 44;
}
