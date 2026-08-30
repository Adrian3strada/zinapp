import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ActiveDeliveryStrip from '../../components/ActiveDeliveryStrip';
import CategoryIconTile from '../../components/CategoryIconTile';
import CustomerHomeHeader from '../../components/CustomerHomeHeader';
import FavoriteHeart from '../../components/FavoriteHeart';
import FoodImage from '../../components/FoodImage';
import HomeRestaurantCard from '../../components/HomeRestaurantCard';
import ListSkeleton from '../../components/ListSkeleton';
import ScreenContainer from '../../components/ScreenContainer';
import SearchField from '../../components/SearchField';
import SeasonalHomeBanner from '../../components/seasonal/SeasonalHomeBanner';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import type { ActiveDeliveryItem } from '../../context/CustomerActiveDeliveriesContext';
import { useCustomerActiveDeliveries } from '../../context/CustomerActiveDeliveriesContext';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { HomeScreenProps } from '../../navigation/types';
import { homeApi, orderApi, productApi, restaurantApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { cardShadow } from '../../theme/shadows';
import { spacing } from '../../theme/spacing';
import type {
  HomePayload,
  HomePromotion,
  HomeRecentOrder,
  HomeRestaurant,
  Product,
  PublicCoupon,
} from '../../types';
import { trackEvent } from '../../utils/analytics';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { appAlert } from '../../utils/appAlert';
import { formatCurrency, formatTimeAgo } from '../../utils/format';
import { getProductEmoji } from '../../utils/foodVisuals';
import { resolveMediaUrl } from '../../utils/media';
import { previewToCartItems, reorderUnavailableMessage } from '../../utils/reorderFromOrder';
import { getSeasonalCopy } from '../../config/seasonalTheme';
import { categoryEmoji, categoryTint } from '../../utils/restaurantCategories';

const EMPTY_HOME: HomePayload = {
  categories: [],
  open_restaurants: [],
  new_restaurants: [],
  promotions: [],
  coupons: [],
  favorites: { restaurants: [], products: [] },
  recent_orders: [],
};

const FOOD_COLOR = colors.accent;
const MANDADO_COLOR = '#16A34A';
const SERVICE_COLOR = colors.serviceStart;

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user, isGuest, requestLogin } = useAuth();
  const { replaceCart } = useCart();
  const { insets, listPaddingBottom, pagePadding } = useTabScreenInsets();
  const {
    liveItems,
    trackingItems,
    refreshError,
    refresh: refreshDeliveries,
  } = useCustomerActiveDeliveries();

  const [home, setHome] = useState<HomePayload>(EMPTY_HOME);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [reorderingId, setReorderingId] = useState<number | null>(null);

  const canFavorite = !!user && !isGuest && user.role === 'customer';

  const loadHome = useCallback(async () => {
    const { data } = await homeApi.get();
    setHome(data);
    setError(null);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (!user || isGuest) {
      setHome((current) => ({
        ...current,
        favorites: { restaurants: [], products: [] },
        recent_orders: [],
        coupons: [],
      }));
    }
    setLoading(true);
    loadHome()
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'No se pudo cargar el inicio.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadHome, user?.id, isGuest]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshDeliveries(), loadHome()]);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo actualizar el inicio.'));
    } finally {
      setRefreshing(false);
    }
  }, [loadHome, refreshDeliveries]);

  const openRestaurant = useCallback(
    (restaurant: { id: number; name: string }, source: string) => {
      trackEvent('home_restaurant_clicked', { restaurant_id: restaurant.id, source });
      navigation.navigate('Menu', {
        restaurantId: restaurant.id,
        restaurantName: restaurant.name,
      });
    },
    [navigation],
  );

  const patchRestaurantFavorite = useCallback((id: number, value: boolean) => {
    setHome((current) => {
      const map = (rows: HomeRestaurant[]) =>
        rows.map((row) => (row.id === id ? { ...row, is_favorited: value } : row));
      const fromRails = [...current.open_restaurants, ...current.new_restaurants, ...current.favorites.restaurants];
      const found = fromRails.find((row) => row.id === id);
      let favRestaurants = map(current.favorites.restaurants);
      if (value && found && !favRestaurants.some((row) => row.id === id)) {
        favRestaurants = [{ ...found, is_favorited: true }, ...favRestaurants];
      }
      if (!value) {
        favRestaurants = favRestaurants.filter((row) => row.id !== id);
      }
      return {
        ...current,
        open_restaurants: map(current.open_restaurants),
        new_restaurants: map(current.new_restaurants),
        favorites: { ...current.favorites, restaurants: favRestaurants },
      };
    });
  }, []);

  const toggleRestaurantFavorite = useCallback(
    async (restaurant: HomeRestaurant) => {
      if (!canFavorite) {
        requestLogin();
        return;
      }
      const next = restaurant.is_favorited !== true;
      patchRestaurantFavorite(restaurant.id, next);
      try {
        const { data } = await restaurantApi.toggleFavorite(restaurant.id);
        patchRestaurantFavorite(restaurant.id, data.is_favorited);
        trackEvent(data.is_favorited ? 'favorite_added' : 'favorite_removed', {
          kind: 'restaurant',
          id: restaurant.id,
        });
      } catch (err) {
        patchRestaurantFavorite(restaurant.id, !next);
        appAlert('Favoritos', getApiErrorMessage(err, 'No se pudo actualizar el favorito.'));
      }
    },
    [canFavorite, patchRestaurantFavorite, requestLogin],
  );

  const toggleProductFavorite = useCallback(
    async (product: Product) => {
      if (!canFavorite) {
        requestLogin();
        return;
      }
      const next = product.is_favorited !== true;
      setHome((current) => ({
        ...current,
        favorites: {
          ...current.favorites,
          products: next
            ? current.favorites.products.map((row) =>
                row.id === product.id ? { ...row, is_favorited: true } : row,
              )
            : current.favorites.products.filter((row) => row.id !== product.id),
        },
      }));
      try {
        const { data } = await productApi.toggleFavorite(product.id);
        trackEvent(data.is_favorited ? 'favorite_added' : 'favorite_removed', {
          kind: 'product',
          id: product.id,
        });
        if (!data.is_favorited) {
          setHome((current) => ({
            ...current,
            favorites: {
              ...current.favorites,
              products: current.favorites.products.filter((row) => row.id !== product.id),
            },
          }));
        }
      } catch (err) {
        setHome((current) => ({
          ...current,
          favorites: {
            ...current.favorites,
            products: next
              ? current.favorites.products
              : [{ ...product, is_favorited: true }, ...current.favorites.products],
          },
        }));
        appAlert('Favoritos', getApiErrorMessage(err, 'No se pudo actualizar el favorito.'));
      }
    },
    [canFavorite, requestLogin],
  );

  const handleReorder = useCallback(
    async (orderId: number) => {
      if (reorderingId) return;
      if (!canFavorite) {
        requestLogin();
        return;
      }
      setReorderingId(orderId);
      trackEvent('reorder_clicked', { order_id: orderId });
      try {
        const { data } = await orderApi.reorderPreview(orderId);
        if (!data.ok || data.items.length === 0) {
          const extra = reorderUnavailableMessage(data);
          appAlert(
            'Pedir otra vez',
            [data.detail || 'Este pedido ya no se puede repetir.', extra].filter(Boolean).join('\n\n'),
            data.restaurant_id
              ? [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Ver menú',
                    onPress: () =>
                      navigation.navigate('Menu', {
                        restaurantId: data.restaurant_id!,
                        restaurantName: data.restaurant_name,
                      }),
                  },
                ]
              : undefined,
          );
          return;
        }
        replaceCart(previewToCartItems(data));
        const skipped = reorderUnavailableMessage(data);
        appAlert(
          'Revisa tu carrito',
          skipped
            ? `Usamos los precios actuales.\n\n${skipped}`
            : 'Armamos tu carrito con los precios actuales. Confirma antes de pagar.',
          [
            {
              text: 'Ir al carrito',
              onPress: () => navigation.navigate('Main', { screen: 'Carrito' }),
            },
          ],
        );
      } catch (err) {
        appAlert('Pedir otra vez', getApiErrorMessage(err, 'No se pudo reconstruir el carrito.'));
      } finally {
        setReorderingId(null);
      }
    },
    [canFavorite, navigation, replaceCart, reorderingId, requestLogin],
  );

  const handleDeliveryPress = (item: ActiveDeliveryItem) => {
    if (item.kind === 'shipment') {
      navigation.navigate('ShipmentDetail', { shipmentId: item.id });
      return;
    }
    navigation.navigate('OrderDetail', { orderId: item.id });
  };

  const handleDishPress = useCallback(
    (product: Product) => {
      navigation.navigate('ProductDetail', {
        product,
        restaurantName: product.restaurant_name,
      });
    },
    [navigation],
  );

  const goSearch = useCallback(
    (target: 'all' | 'servicios' = 'all') => {
      const q = search.trim();
      if (target === 'servicios') {
        trackEvent('home_service_clicked', { source: 'search', q });
        navigation.navigate('Servicios', q ? { q } : undefined);
        return;
      }
      navigation.navigate('Buscar', q ? { q } : undefined);
    },
    [navigation, search],
  );

  const q = search.trim().toLowerCase();
  const openRestaurants = useMemo(() => {
    if (!q) return home.open_restaurants;
    return home.open_restaurants.filter((row) =>
      `${row.name} ${row.description} ${row.category_display ?? ''}`.toLowerCase().includes(q),
    );
  }, [home.open_restaurants, q]);

  const stripItems = liveItems.length > 0 ? liveItems : trackingItems.slice(0, 3);
  const hasFavorites =
    canFavorite && (home.favorites.restaurants.length > 0 || home.favorites.products.length > 0);
  const showReorder = canFavorite && home.recent_orders.length > 0;
  const showPromos = home.promotions.length > 0 || (canFavorite && home.coupons.length > 0);
  const showNew = home.new_restaurants.length > 0;
  const seasonalCopy = getSeasonalCopy();

  return (
    <ScreenContainer
      loading={loading && home.open_restaurants.length === 0 && !error}
      loadingSkeleton={
        <View style={[styles.skeleton, { paddingTop: insets.top + 12 }, listPaddingBottom()]}>
          <ListSkeleton count={5} variant="restaurant" />
        </View>
      }
      error={error && home.open_restaurants.length === 0 ? error : null}
      onRetry={() => {
        void loadHome().catch((err) => {
          setError(getApiErrorMessage(err, 'No se pudo cargar el inicio.'));
        });
      }}
    >
      <CustomerHomeHeader
        topInset={insets.top}
        firstName={user?.first_name}
        avatarUrl={resolveMediaUrl(user?.avatar_url ?? user?.avatar)}
        onProfilePress={() => navigation.navigate('Perfil')}
      />

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: pagePadding },
          listPaddingBottom(),
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <SeasonalHomeBanner />

        <View style={styles.searchBlock}>
          <SearchField
            value={search}
            onChangeText={setSearch}
            placeholder={seasonalCopy?.searchPlaceholder ?? 'Tacos, pizza, veterinario…'}
            onSubmitEditing={() => goSearch()}
          />
          {search.trim().length >= 2 ? (
            <View style={styles.searchHints}>
              <Pressable style={styles.searchHint} onPress={() => goSearch()}>
                <Text style={styles.searchHintText}>Buscar «{search.trim()}» en ZinApp</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
              <Pressable style={styles.searchHint} onPress={() => goSearch('servicios')}>
                <Text style={styles.searchHintText}>Buscar en servicios</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.quickRow}>
          <QuickAction
            emoji="🍔"
            label="Pedir comida"
            color={FOOD_COLOR}
            onPress={() => navigation.navigate('Comida')}
          />
          <QuickAction
            emoji="🛵"
            label="Mandado o envío"
            color={MANDADO_COLOR}
            onPress={() => {
              trackEvent('home_service_clicked', { source: 'mandado' });
              navigation.navigate('Mandado');
            }}
          />
          <QuickAction
            emoji="🧰"
            label="Necesito un servicio"
            color={SERVICE_COLOR}
            onPress={() => {
              trackEvent('home_service_clicked', { source: 'servicios' });
              navigation.navigate('Servicios');
            }}
          />
        </View>

        {(!user || isGuest) ? (
          <Pressable style={styles.loginHint} onPress={requestLogin}>
            <Ionicons name="heart-outline" size={16} color={colors.primary} />
            <Text style={styles.loginHintText}>
              Inicia sesión para guardar favoritos y repetir pedidos
            </Text>
          </Pressable>
        ) : null}

        {stripItems.length > 0 ? (
          <ActiveDeliveryStrip items={stripItems} onPress={handleDeliveryPress} />
        ) : null}

        {refreshError ? (
          <Pressable style={styles.refreshError} onPress={() => { void onRefresh(); }}>
            <Text style={styles.refreshErrorText}>
              {refreshError} · Toca para reintentar
            </Text>
          </Pressable>
        ) : null}

        {home.categories.length > 0 ? (
          <View style={styles.section}>
            <View>
              <Text style={styles.heroTitle}>{seasonalCopy?.categoriesTitle ?? '¿Qué quieres comer hoy?'}</Text>
              {seasonalCopy ? (
                <Text style={styles.seasonalCaption}>{seasonalCopy.categoriesCaption}</Text>
              ) : null}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
              decelerationRate="fast"
            >
              {home.categories.map((cat) => (
                <CategoryIconTile
                  key={cat.key}
                  emoji={categoryEmoji(cat.key)}
                  label={cat.label}
                  tint={categoryTint(cat.key)}
                  categoryKey={cat.key}
                  onPress={() => {
                    trackEvent('home_category_clicked', { category: cat.key });
                    navigation.navigate('Comida', { category: cat.key });
                  }}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {openRestaurants.length > 0 ? (
          <RestaurantRail
            title="Abiertos ahora"
            restaurants={openRestaurants}
            showFavorite={canFavorite}
            onPress={(item) => openRestaurant(item, 'open')}
            onToggleFavorite={toggleRestaurantFavorite}
            onSeeAll={() => navigation.navigate('Comida')}
          />
        ) : null}

        {hasFavorites ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Tus favoritos ❤️</Text>
              <Pressable onPress={() => navigation.navigate('Favoritos')} hitSlop={8}>
                <Text style={styles.seeAll}>Ver todos</Text>
              </Pressable>
            </View>
            {home.favorites.restaurants.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScroll}
                decelerationRate="fast"
              >
                {home.favorites.restaurants.map((item) => (
                  <HomeRestaurantCard
                    key={`fav-r-${item.id}`}
                    restaurant={item}
                    showFavorite={canFavorite}
                    onPress={() => openRestaurant(item, 'favorite')}
                    onToggleFavorite={() => { void toggleRestaurantFavorite(item); }}
                  />
                ))}
              </ScrollView>
            ) : null}
            {home.favorites.products.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScroll}
                decelerationRate="fast"
              >
                {home.favorites.products.map((product) => (
                  <FavoriteProductCard
                    key={`fav-p-${product.id}`}
                    product={product}
                    onPress={() => handleDishPress(product)}
                    onToggleFavorite={() => { void toggleProductFavorite(product); }}
                  />
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        {showReorder ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vuelve a pedir</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
              decelerationRate="fast"
            >
              {home.recent_orders.map((order) => (
                <ReorderCard
                  key={order.id}
                  order={order}
                  busy={reorderingId === order.id}
                  onReorder={() => { void handleReorder(order.id); }}
                  onPressRestaurant={() =>
                    openRestaurant(
                      { id: order.restaurant_id, name: order.restaurant_name },
                      'reorder',
                    )
                  }
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {showPromos ? (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Promociones para ti 🏷️</Text>
              {canFavorite ? (
                <Pressable onPress={() => navigation.navigate('Ofertas')} hitSlop={8}>
                  <Text style={styles.seeAll}>Ver cupones</Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}
              decelerationRate="fast"
            >
              {home.promotions.map((promo) => (
                <PromoCard
                  key={`promo-${promo.id}`}
                  promo={promo}
                  onPress={() => {
                    trackEvent('promotion_clicked', { promotion_id: promo.id, restaurant_id: promo.restaurant_id });
                    openRestaurant(
                      { id: promo.restaurant_id, name: promo.restaurant_name },
                      'promo',
                    );
                  }}
                />
              ))}
              {home.coupons.map((coupon) => (
                <CouponCard
                  key={`coupon-${coupon.id}`}
                  coupon={coupon}
                  onPress={() => {
                    trackEvent('promotion_clicked', { coupon: coupon.code });
                    navigation.navigate('Ofertas');
                  }}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {showNew ? (
          <RestaurantRail
            title="Nuevos en ZinApp ✨"
            restaurants={home.new_restaurants}
            showFavorite={canFavorite}
            onPress={(item) => openRestaurant(item, 'new')}
            onToggleFavorite={toggleRestaurantFavorite}
          />
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

function QuickAction({
  emoji,
  label,
  color,
  onPress,
}: {
  emoji: string;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quick} onPress={onPress}>
      <View style={[styles.quickIcon, { backgroundColor: `${color}22` }]}>
        <Text style={styles.quickEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.quickLabel} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

function RestaurantRail({
  title,
  restaurants,
  showFavorite,
  onPress,
  onToggleFavorite,
  onSeeAll,
}: {
  title: string;
  restaurants: HomeRestaurant[];
  showFavorite: boolean;
  onPress: (item: HomeRestaurant) => void;
  onToggleFavorite: (item: HomeRestaurant) => void;
  onSeeAll?: () => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={styles.seeAll}>Ver todos</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.hScroll}
        decelerationRate="fast"
      >
        {restaurants.map((item) => (
          <HomeRestaurantCard
            key={`${title}-${item.id}`}
            restaurant={item}
            showFavorite={showFavorite}
            onPress={() => onPress(item)}
            onToggleFavorite={() => onToggleFavorite(item)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FavoriteProductCard({
  product,
  onPress,
  onToggleFavorite,
}: {
  product: Product;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <Pressable style={styles.productCard} onPress={onPress}>
      <View>
        <FoodImage
          emoji={getProductEmoji(product.name)}
          color={colors.primary}
          size="md"
          imageUri={resolveMediaUrl(product.image_url ?? product.image)}
          style={styles.productImage}
        />
        <View style={styles.productHeart}>
          <FavoriteHeart favorited={product.is_favorited !== false} onPress={onToggleFavorite} />
        </View>
      </View>
      <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
      <Text style={styles.productMeta} numberOfLines={1}>{product.restaurant_name}</Text>
      <Text style={styles.productPrice}>{formatCurrency(product.price)}</Text>
    </Pressable>
  );
}

function ReorderCard({
  order,
  busy,
  onReorder,
  onPressRestaurant,
}: {
  order: HomeRecentOrder;
  busy: boolean;
  onReorder: () => void;
  onPressRestaurant: () => void;
}) {
  const ago = formatTimeAgo(order.created_at);
  return (
    <View style={styles.reorderCard}>
      <Pressable onPress={onPressRestaurant} style={styles.reorderTop}>
        <FoodImage
          emoji="🍔"
          color={colors.primary}
          size="sm"
          imageUri={resolveMediaUrl(order.restaurant_image_url)}
          style={styles.reorderImage}
        />
        <View style={styles.reorderCopy}>
          <Text style={styles.reorderName} numberOfLines={1}>{order.restaurant_name}</Text>
          <Text style={styles.reorderSummary} numberOfLines={2}>{order.summary}</Text>
          {ago ? <Text style={styles.reorderAgo}>Pedido {ago}</Text> : null}
        </View>
      </Pressable>
      <Pressable
        style={[styles.reorderBtn, busy && styles.reorderBtnBusy]}
        onPress={onReorder}
        disabled={busy}
      >
        <Text style={styles.reorderBtnText}>{busy ? 'Preparando…' : 'Pedir otra vez'}</Text>
      </Pressable>
    </View>
  );
}

function PromoCard({ promo, onPress }: { promo: HomePromotion; onPress: () => void }) {
  const label = promo.display_label || promo.label || promo.promo_type_display || 'Promo';
  return (
    <Pressable style={styles.promoCard} onPress={onPress}>
      <FoodImage
        emoji={getProductEmoji(promo.product_name)}
        color={colors.accent}
        size="md"
        imageUri={resolveMediaUrl(promo.product_image_url)}
        style={styles.promoImage}
      />
      <View style={styles.promoBadge}>
        <Text style={styles.promoBadgeText}>{label}</Text>
      </View>
      <Text style={styles.promoName} numberOfLines={2}>{promo.product_name}</Text>
      <Text style={styles.promoMeta} numberOfLines={1}>{promo.restaurant_name}</Text>
      <Text style={styles.promoPrice}>{formatCurrency(promo.product_price)}</Text>
    </Pressable>
  );
}

function CouponCard({ coupon, onPress }: { coupon: PublicCoupon; onPress: () => void }) {
  const label = coupon.discount_percent > 0
    ? `${coupon.discount_percent}%`
    : formatCurrency(coupon.discount_fixed);
  return (
    <Pressable style={styles.couponCard} onPress={onPress}>
      <Text style={styles.couponCode}>{coupon.code}</Text>
      <Text style={styles.couponLabel}>{label} de descuento</Text>
      {coupon.description ? (
        <Text style={styles.couponDesc} numberOfLines={2}>{coupon.description}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, backgroundColor: colors.background, paddingTop: spacing.md, gap: spacing.md },
  skeleton: { flex: 1, paddingHorizontal: spacing.screen },
  searchBlock: { gap: 8 },
  searchHints: { gap: 6 },
  searchHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
  },
  searchHintText: { fontSize: 13, fontWeight: '700', color: colors.primary, flex: 1 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quick: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickEmoji: { fontSize: 22 },
  quickLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 16,
  },
  loginHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  loginHintText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.primary },
  refreshError: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 12,
  },
  refreshErrorText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  section: { gap: spacing.sm },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.4,
  },
  seasonalCaption: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  seeAll: { fontSize: 13, fontWeight: '700', color: colors.primary },
  hScroll: { gap: spacing.md, paddingVertical: 2, paddingRight: 4 },
  productCard: {
    width: 148,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  productImage: { width: '100%', height: 96, borderRadius: radii.lg },
  productHeart: { position: 'absolute', right: 0, top: 0 },
  productName: { fontSize: 14, fontWeight: '800', color: colors.text, minHeight: 36 },
  productMeta: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  productPrice: { fontSize: 14, fontWeight: '800', color: colors.primary },
  reorderCard: {
    width: 260,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  reorderTop: { flexDirection: 'row', gap: 10 },
  reorderImage: { width: 56, height: 56, borderRadius: radii.md },
  reorderCopy: { flex: 1, minWidth: 0, gap: 2 },
  reorderName: { fontSize: 15, fontWeight: '800', color: colors.text },
  reorderSummary: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  reorderAgo: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  reorderBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnBusy: { opacity: 0.7 },
  reorderBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  promoCard: {
    width: 156,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.sm,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  promoImage: { width: '100%', height: 96, borderRadius: radii.lg },
  promoBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  promoBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  promoName: { fontSize: 14, fontWeight: '800', color: colors.text, minHeight: 36 },
  promoMeta: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  promoPrice: { fontSize: 14, fontWeight: '800', color: colors.primary },
  couponCard: {
    width: 168,
    backgroundColor: colors.accentLight,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.accent + '55',
  },
  couponCode: { fontSize: 16, fontWeight: '900', color: colors.accentDark },
  couponLabel: { fontSize: 13, fontWeight: '800', color: colors.text },
  couponDesc: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
});
