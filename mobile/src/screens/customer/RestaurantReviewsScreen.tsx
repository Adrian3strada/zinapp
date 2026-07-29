import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../../components/EmptyState';
import ListSkeleton from '../../components/ListSkeleton';
import ScreenContainer from '../../components/ScreenContainer';
import type { RestaurantReviewsScreenProps } from '../../navigation/types';
import { reviewApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { Review } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';

function Stars({ rating }: { rating: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= rating ? 'star' : 'star-outline'}
          size={14}
          color={colors.accent}
        />
      ))}
    </View>
  );
}

export default function RestaurantReviewsScreen({ route }: RestaurantReviewsScreenProps) {
  const { restaurantId, restaurantName } = route.params;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await reviewApi.listByRestaurant(restaurantId);
      setReviews(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar las reseñas.'));
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading && reviews.length === 0) {
    return (
      <ScreenContainer>
        <ListSkeleton />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <FlatList
        data={reviews}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <Text style={styles.subtitle}>Opiniones de clientes sobre {restaurantName}</Text>
        }
        ListEmptyComponent={
          error ? (
            <EmptyState
              emoji="⚠️"
              title="No se pudieron cargar"
              subtitle={error}
              actionLabel="Reintentar"
              onAction={() => {
                setLoading(true);
                void load();
              }}
            />
          ) : (
            <EmptyState emoji="⭐" title="Sin reseñas aún" subtitle="Sé el primero en calificar después de pedir" />
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.name}>
                {item.customer_detail?.first_name || item.customer_detail?.username || 'Cliente'}
              </Text>
              <Stars rating={item.restaurant_rating} />
            </View>
            {item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null}
            <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString('es-MX')}</Text>
          </View>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.screen, paddingBottom: spacing.xxl + 24, gap: 10, flexGrow: 1 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: 6,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '700', color: colors.text },
  stars: { flexDirection: 'row', gap: 2 },
  comment: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  date: { fontSize: 12, color: colors.textMuted },
});
