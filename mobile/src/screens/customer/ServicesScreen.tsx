import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appAlert } from '../../utils/appAlert';

import EmptyState from '../../components/EmptyState';
import HeroBackground from '../../components/HeroBackground';
import ListSkeleton from '../../components/ListSkeleton';
import ScreenContainer from '../../components/ScreenContainer';
import SearchField from '../../components/SearchField';
import ServiceBusinessCard from '../../components/ServiceBusinessCard';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { ServicesScreenProps } from '../../navigation/types';
import { localServiceApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { LocalService } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import {
  SERVICE_CATEGORIES,
  serviceMatchesCategory,
  type ServiceCategoryKey,
} from '../../utils/serviceCategories';
import { serviceListingRequestMessage } from '../../utils/socialLinks';
import { openWhatsApp } from '../../utils/whatsapp';

const CATEGORIES = [...SERVICE_CATEGORIES];

export default function ServicesScreen(_props: ServicesScreenProps) {
  const { config } = useAppConfig();
  const { isDesktopWeb, contentMaxWidth } = useResponsiveLayout();
  const { insets, scrollPaddingBottom, pagePadding } = useTabScreenInsets();
  const [services, setServices] = useState<LocalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ServiceCategoryKey>(null);
  const listOpacity = useRef(new Animated.Value(1)).current;
  const filterKeyRef = useRef(`${category ?? 'all'}|`);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const { data } = await localServiceApi.list();
      setServices(data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudieron cargar los servicios'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      const matchSearch =
        !q
        || s.name.toLowerCase().includes(q)
        || (s.description ?? '').toLowerCase().includes(q)
        || (s.address ?? '').toLowerCase().includes(q)
        || (s.category_display ?? '').toLowerCase().includes(q);
      const matchCat = serviceMatchesCategory(s, category);
      return matchSearch && matchCat;
    });
  }, [services, search, category]);

  const filterKey = `${category ?? 'all'}|${search.trim().toLowerCase()}`;

  useEffect(() => {
    if (filterKeyRef.current === filterKey) return;
    filterKeyRef.current = filterKey;
    listOpacity.setValue(0.35);
    Animated.timing(listOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [filterKey, listOpacity]);

  const handleRequestListing = async () => {
    const supportPhone = config.support_whatsapp?.trim();
    if (!supportPhone) {
      appAlert(
        'Contacto',
        'Por ahora escríbenos al WhatsApp de soporte de ZinApp para solicitar aparecer en Servicios.',
      );
      return;
    }
    try {
      await openWhatsApp(supportPhone, serviceListingRequestMessage());
    } catch (err) {
      appAlert('WhatsApp', err instanceof Error ? err.message : 'No se pudo abrir WhatsApp.');
    }
  };

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingHorizontal: pagePadding },
          isDesktopWeb && { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' },
          scrollPaddingBottom(),
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
      >
        <HeroBackground
          colors={[colors.serviceStart, colors.serviceEnd]}
          style={[
            styles.hero,
            { marginHorizontal: -pagePadding, paddingTop: insets.top + spacing.sm },
          ]}
        >
          <Text style={styles.heroEyebrow}>Zinapécuaro</Text>
          <Text style={styles.heroTitle}>Servicios</Text>
          <Text style={styles.heroSubtitle}>Negocios locales — contacta directo</Text>
        </HeroBackground>

        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar peluquería, taller…"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {CATEGORIES.map((cat) => {
            const active = category === cat.key;
            return (
              <Pressable
                key={cat.label}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCategory(cat.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={cat.icon}
                  size={15}
                  color={active ? '#FFF' : colors.textSecondary}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading && services.length === 0 ? (
          <ListSkeleton count={4} />
        ) : error && services.length === 0 ? (
          <EmptyState
            emoji="⚠️"
            title="No se pudo cargar"
            subtitle={error}
            actionLabel="Reintentar"
            onAction={() => load()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            emoji="💇"
            title={search || category ? 'Sin resultados' : 'Próximamente'}
            subtitle={
              search || category
                ? 'Prueba otra categoría o término de búsqueda.'
                : 'Aquí aparecerán negocios como peluquerías, talleres y más.'
            }
            actionLabel={!search && !category ? 'Solicitar aparecer' : undefined}
            onAction={!search && !category ? handleRequestListing : undefined}
          />
        ) : (
          <Animated.View style={[styles.list, { opacity: listOpacity }]}>
            {filtered.map((service) => (
              <ServiceBusinessCard key={service.id} service={service} />
            ))}
          </Animated.View>
        )}

        <Pressable style={styles.requestCard} onPress={handleRequestListing}>
          <View style={styles.requestIcon}>
            <Ionicons name="storefront-outline" size={20} color={colors.serviceEnd} />
          </View>
          <View style={styles.requestBody}>
            <Text style={styles.requestTitle}>¿Tienes un negocio?</Text>
            <Text style={styles.requestText}>
              Solicita aparecer en Servicios. Revisamos tu información y te contactamos.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  hero: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 4,
    fontWeight: '500',
    lineHeight: 18,
    maxWidth: 340,
  },
  categories: {
    gap: spacing.sm,
    paddingVertical: 2,
    paddingRight: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.serviceStart,
    borderColor: colors.serviceStart,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipTextActive: { color: '#FFF' },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.serviceStart + '33',
    ...cardShadow,
  },
  requestIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.serviceStart + '14',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  requestBody: { flex: 1, minWidth: 0, gap: 2 },
  requestTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  requestText: {
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
});
