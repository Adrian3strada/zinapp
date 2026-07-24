import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  clientSecret: string;
  publishableKey: string;
}

/** En iOS/Android el checkout embebido no aplica; se usa la URL hospedada. */
export default function StripeEmbeddedCheckout(_props: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.text}>Abre el pago en el navegador para continuar.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16 },
  text: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
});
