import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { View } from 'react-native';

import WebSidebar from './WebSidebar';
import { useCart } from '../context/CartContext';
import { useCustomerActiveDeliveries } from '../context/CustomerActiveDeliveriesContext';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import type { CustomerTabParamList } from '../navigation/types';

interface Props {
  children: React.ReactNode;
}

/** En laptop: barra lateral + contenido. En móvil: solo contenido. */
export default function CustomerWebLayout({ children }: Props) {
  const navigation = useNavigation<BottomTabNavigationProp<CustomerTabParamList>>();
  const { isDesktopWeb } = useResponsiveLayout();
  const { itemCount } = useCart();
  const { activeOrderCount } = useCustomerActiveDeliveries();

  if (!isDesktopWeb) {
    return <>{children}</>;
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
      <WebSidebar
        navigation={navigation}
        orderBadge={activeOrderCount}
        cartBadge={itemCount}
      />
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}
