import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { restaurantApi } from '../services/api';
import { colors } from '../theme/colors';

export default function CoverageZoneHint() {
  const [label, setLabel] = useState('Zinapécuaro, Michoacán');

  useEffect(() => {
    restaurantApi.coverageBounds().then(({ data }) => {
      if (data.label) setLabel(data.label);
    }).catch(() => {});
  }, []);

  return (
    <View style={styles.box}>
      <Ionicons name="map-outline" size={18} color={colors.primary} />
      <Text style={styles.text}>
        Entregamos solo en <Text style={styles.bold}>{label}</Text>. Marca tu punto en el mapa antes de pedir.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  text: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  bold: { fontWeight: '800', color: colors.primary },
});
