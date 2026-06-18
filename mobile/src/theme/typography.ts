import { TextStyle } from 'react-native';

import { colors } from './colors';

export const typography = {
  hero: { fontSize: 26, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.5 },
  title: { fontSize: 20, fontWeight: '800' as const, color: colors.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, fontWeight: '600' as const, color: colors.textSecondary, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.textMuted, lineHeight: 16 },
  label: { fontSize: 13, fontWeight: '700' as const, color: colors.textSecondary },
  price: { fontSize: 17, fontWeight: '800' as const, color: colors.primary },
} satisfies Record<string, TextStyle>;
