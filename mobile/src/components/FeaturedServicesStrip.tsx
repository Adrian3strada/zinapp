import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import ServiceLogo from './ServiceLogo';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { cardShadow } from '../theme/shadows';
import type { LocalService } from '../types';

interface Props {
  services: LocalService[];
  onPressService: (service: LocalService) => void;
  onPressSeeAll: () => void;
}

function FeaturedServiceCard({
  service,
  onPress,
}: {
  service: LocalService;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}>
      <ServiceLogo
        category={service.category}
        logoUrl={service.logo_url}
        logo={service.logo}
        size="sm"
        style={styles.logo}
      />
      <View style={styles.textBlock}>
        <Text style={styles.name} numberOfLines={2}>
          {service.name}
        </Text>
        {!!service.category_display && (
          <Text style={styles.category} numberOfLines={1}>
            {service.category_display}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function FeaturedServicesStrip({ services, onPressService, onPressSeeAll }: Props) {
  if (services.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Servicios destacados</Text>
        <Pressable style={styles.seeAll} onPress={onPressSeeAll} hitSlop={8}>
          <Text style={styles.seeAllText}>Ver todos</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {services.map((service) => (
          <FeaturedServiceCard
            key={service.id}
            service={service}
            onPress={() => onPressService(service)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  scroll: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  card: {
    width: 148,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  pressed: { opacity: 0.92 },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  textBlock: {
    minWidth: 0,
    gap: 4,
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    lineHeight: 18,
  },
  category: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.serviceEnd,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
