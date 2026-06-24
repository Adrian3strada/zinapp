import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { subscribePendingNavigation } from './pendingNavigation';
import type { CustomerStackParamList } from './types';

type CustomerNav = NativeStackNavigationProp<CustomerStackParamList>;

export function useCustomerPendingNavigation() {
  const navigation = useNavigation<CustomerNav>();

  useEffect(() => {
    return subscribePendingNavigation((nav) => {
      if (nav.type === 'order') {
        navigation.navigate('OrderDetail', { orderId: nav.orderId });
        return;
      }
      if (nav.type === 'shipment') {
        navigation.navigate('ShipmentDetail', { shipmentId: nav.shipmentId });
        return;
      }
      if (nav.type === 'menu') {
        navigation.navigate('Menu', {
          restaurantId: nav.restaurantId,
          restaurantName: nav.restaurantName,
        });
      }
    });
  }, [navigation]);
}
