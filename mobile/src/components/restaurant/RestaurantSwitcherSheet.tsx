import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { HIT_SLOP, spacing } from '../../theme/spacing';
import type { OwnedRestaurant } from '../../types';
import { resolveMediaUrl } from '../../utils/media';

interface Props {
  visible: boolean;
  owned: OwnedRestaurant[];
  switching: boolean;
  canAdd?: boolean;
  onClose: () => void;
  onSelect: (id: number) => void;
  onAdd?: () => void;
}

export default function RestaurantSwitcherSheet({
  visible,
  owned,
  switching,
  canAdd,
  onClose,
  onSelect,
  onAdd,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.title}>Tus locales</Text>
          <Text style={styles.hint}>Pedidos, menú y perfil cambian al local que elijas.</Text>
          {owned.map((item) => {
            const imageUri = resolveMediaUrl(item.image_url);
            const selected = !!item.is_selected;
            return (
              <Pressable
                key={item.id}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => onSelect(item.id)}
                disabled={switching || selected}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={item.name}
              >
                <View style={styles.logo}>
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.logoImage} />
                  ) : (
                    <Ionicons name="storefront" size={20} color={colors.primary} />
                  )}
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {!item.is_active
                      ? 'Pendiente de aprobación'
                      : item.accepting_orders !== false
                        ? 'Abierto a pedidos'
                        : 'Cerrado'}
                  </Text>
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                )}
              </Pressable>
            );
          })}
          {canAdd && onAdd ? (
            <Pressable
              onPress={onAdd}
              disabled={switching}
              style={styles.addRow}
              accessibilityRole="button"
              accessibilityLabel="Agregar local"
            >
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.addText}>Agregar local</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onClose}
            hitSlop={HIT_SLOP}
            style={styles.cancel}
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheetLg,
    borderTopRightRadius: radii.sheetLg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: { width: '100%', height: '100%' },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  addText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  cancel: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
});
