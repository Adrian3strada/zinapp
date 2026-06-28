import React, { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import ListFooter from '../../components/ListFooter';
import ListSkeleton from '../../components/ListSkeleton';
import ScreenContainer from '../../components/ScreenContainer';
import ShipmentCard from '../../components/ShipmentCard';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import type { ShipmentsScreenProps } from '../../navigation/types';
import { shipmentApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Shipment } from '../../types';

export default function ShipmentsScreen({ navigation }: ShipmentsScreenProps) {
  const fetchPage = useCallback(async (page: number) => {
    const { data } = await shipmentApi.list(page);
    return data;
  }, []);

  const {
    items,
    loading,
    loadingMore,
    error,
    hasMore,
    refresh,
    loadMore,
  } = usePaginatedList(fetchPage, [], 'No se pudieron cargar tus envíos');

  const renderItem = useCallback(
    ({ item }: { item: Shipment }) => (
      <ShipmentCard
        item={item}
        onPress={() => navigation.navigate('ShipmentDetail', { shipmentId: item.id })}
      />
    ),
    [navigation],
  );

  return (
    <ScreenContainer
      loading={loading && items.length === 0}
      loadingSkeleton={
        <View style={styles.skeleton}>
          <ListSkeleton count={4} variant="restaurant" />
        </View>
      }
      error={error}
      onRetry={refresh}
    >
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={loading && items.length > 0}
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.subtitle}>
              Envía paquetes dentro de Zinapécuaro con repartidores de la app.
            </Text>
            <Button
              title="Nuevo envío"
              onPress={() => navigation.navigate('CreateShipment')}
              size="lg"
            />
          </View>
        }
        ListFooterComponent={
          <ListFooter loadingMore={loadingMore} hasMore={hasMore} itemCount={items.length} />
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              emoji="📦"
              title="Sin envíos todavía"
              subtitle="Crea tu primer envío para mandar un paquete local"
              actionLabel="Nuevo envío"
              onAction={() => navigation.navigate('CreateShipment')}
            />
          ) : null
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.screen, flexGrow: 1 },
  skeleton: { flex: 1, padding: spacing.screen },
  header: { gap: 12, marginBottom: 16 },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
});
