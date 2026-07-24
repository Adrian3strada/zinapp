import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { subscribePendingNavigation } from './pendingNavigation';
import type { DriverStackParamList } from './types';

type DriverNav = NativeStackNavigationProp<DriverStackParamList>;

export function useDriverPendingNavigation() {
  const navigation = useNavigation<DriverNav>();

  useEffect(() => {
    return subscribePendingNavigation((nav) => {
      if (nav.type === 'order') {
        navigation.navigate('OrderDetail', { orderId: nav.orderId });
        return;
      }
      if (nav.type === 'shipment') {
        navigation.navigate('ShipmentDetail', { shipmentId: nav.shipmentId });
      }
    });
  }, [navigation]);
}
