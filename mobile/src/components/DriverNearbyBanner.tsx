import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { formatRouteDistance } from '../utils/format';
import { haversineMeters } from '../utils/geo';
import type { MapCoordinate } from '../utils/maps';

interface Props {
  driver: MapCoordinate | null;
  destination: MapCoordinate | null;
  thresholdMeters?: number;
}

export default function DriverNearbyBanner({
  driver,
  destination,
  thresholdMeters = 400,
}: Props) {
  const distance = useMemo(() => {
    if (!driver || !destination) return null;
    return haversineMeters(driver, destination);
  }, [driver, destination]);

  if (distance == null || distance > thresholdMeters) return null;

  return (
    <View style={styles.banner}>
      <Ionicons name="notifications" size={20} color={colors.warning} />
      <Text style={styles.text}>
        ¡Tu repartidor está cerca! (~{formatRouteDistance(distance)})
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.warning + '18',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.warning + '44',
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
});
