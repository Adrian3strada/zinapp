import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

interface Props {
  loadingMore: boolean;
  hasMore: boolean;
  itemCount: number;
}

function ListFooter({ loadingMore, hasMore, itemCount }: Props) {
  if (loadingMore) {
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.text}>Cargando más...</Text>
      </View>
    );
  }

  if (itemCount > 0 && !hasMore) {
    return (
      <View style={styles.footer}>
        <Text style={styles.text}>— Fin de la lista —</Text>
      </View>
    );
  }

  return null;
}

export default React.memo(ListFooter);

const styles = StyleSheet.create({
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  text: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
