import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../utils/appAlert';

import EmptyState from '../../components/EmptyState';
import HomeHero from '../../components/HomeHero';
import ListSkeleton from '../../components/ListSkeleton';
import ScreenContainer from '../../components/ScreenContainer';
import SearchField from '../../components/SearchField';
import ServiceBusinessCard from '../../components/ServiceBusinessCard';
import { useAuth } from '../../context/AuthContext';
import { useAppConfig } from '../../hooks/useAppConfig';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { ServicesScreenProps } from '../../navigation/types';
import { localServiceApi } from '../../services/api';
import { colors } from '../../theme/colors';
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
  const { user } = useAuth();
  const { config } = useAppConfig();
  const { insets, scrollPaddingBottom, pagePadding } = useTabScreenInsets();
  const [services, setServices] = useState<LocalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ServiceCategoryKey>(null);

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
    load();
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
          scrollPaddingBottom(),
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
      >
        <HomeHero
          firstName={user?.first_name}
          topInset={insets.top}
          style={[styles.hero, { marginHorizontal: -pagePadding }]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'transparent']}
            style={styles.heroGlow}
          />
          <Text style={styles.heroTitle}>Servicios</Text>
          <Text style={styles.heroSubtitle}>
            Negocios locales de tu ciudad — contacta directo
          </Text>
        </HomeHero>

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
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat.label}
              style={[styles.chip, category === cat.key && styles.chipActive]}
              onPress={() => setCategory(cat.key)}
            >
              <Text style={styles.chipEmoji}>{cat.emoji}</Text>
              <Text style={[styles.chipText, category === cat.key && styles.chipTextActive]}>
                {cat.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable style={styles.requestCard} onPress={handleRequestListing}>
          <View style={styles.requestIcon}>
            <Ionicons name="storefront-outline" size={22} color={colors.serviceEnd} />
          </View>
          <View style={styles.requestBody}>
            <Text style={styles.requestTitle}>¿Tienes un negocio?</Text>
            <Text style={styles.requestText}>
              Solicita aparecer en Servicios. Revisamos tu información y te contactamos.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        {loading && services.length === 0 ? (
          <ListSkeleton rows={4} />
        ) : error && services.length === 0 ? (
          <EmptyState
            emoji="⚠️"
            title="No se pudo cargar"
            message={error}
            actionLabel="Reintentar"
            onAction={() => load()}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            emoji="💇"
            title={search || category ? 'Sin resultados' : 'Próximamente'}
            message={
              search || category
                ? 'Prueba otra categoría o término de búsqueda.'
                : 'Aquí aparecerán negocios como peluquerías, talleres y más.'
            }
            actionLabel={!search && !category ? 'Solicitar aparecer' : undefined}
            onAction={!search && !category ? handleRequestListing : undefined}
          />
        ) : (
          <View style={styles.list}>
            {filtered.map((service) => (
              <ServiceBusinessCard key={service.id} service={service} />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    gap: spacing.lg,
  },
  hero: { overflow: 'hidden' },
  heroGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: -0.5,
    marginTop: spacing.md,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 6,
    fontWeight: '500',
    lineHeight: 21,
    maxWidth: 320,
  },
  categories: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.serviceStart,
    borderColor: colors.serviceStart,
  },
  chipEmoji: { fontSize: 15 },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  chipTextActive: { color: '#FFF' },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.serviceStart + '33',
    ...cardShadow,
  },
  requestIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.serviceStart + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestBody: { flex: 1, gap: 4 },
  requestTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  requestText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  list: {
    gap: spacing.md,
  },
});
