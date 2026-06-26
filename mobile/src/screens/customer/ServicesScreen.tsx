import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import EmptyState from '../../components/EmptyState';
import HomeHero from '../../components/HomeHero';
import ListSkeleton from '../../components/ListSkeleton';
import ScreenContainer from '../../components/ScreenContainer';
import SearchField from '../../components/SearchField';
import ServiceBusinessCard from '../../components/ServiceBusinessCard';
import { useAuth } from '../../context/AuthContext';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import type { ServicesScreenProps } from '../../navigation/types';
import { localServiceApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { LocalService } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';

export default function ServicesScreen(_props: ServicesScreenProps) {
  const { user } = useAuth();
  const { insets, scrollPaddingBottom, pagePadding } = useTabScreenInsets();
  const [services, setServices] = useState<LocalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q)
        || (s.description ?? '').toLowerCase().includes(q),
    );
  }, [services, search]);

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
            title={search ? 'Sin resultados' : 'Próximamente'}
            message={
              search
                ? 'Prueba con otro nombre o servicio.'
                : 'Aquí aparecerán negocios como peluquerías, talleres y más.'
            }
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
  list: {
    gap: spacing.md,
  },
});
