import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect } from 'react';

import { subscribePendingNavigation } from './pendingNavigation';
import type { RestaurantStackParamList } from './types';

type RestaurantNav = NativeStackNavigationProp<RestaurantStackParamList>;

export function useRestaurantPendingNavigation() {
  const navigation = useNavigation<RestaurantNav>();

  useEffect(() => {
    return subscribePendingNavigation((nav) => {
      if (nav.type === 'order') {
        navigation.navigate('OrderDetail', { orderId: nav.orderId });
      }
    });
  }, [navigation]);
}
