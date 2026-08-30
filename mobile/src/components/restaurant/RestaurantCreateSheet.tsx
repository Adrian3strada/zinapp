import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { HIT_SLOP, spacing } from '../../theme/spacing';
import { mxPhoneError, normalizeMxPhone } from '../../utils/phone';
import Button from '../Button';
import FormField from '../FormField';
import KeyboardForm from '../KeyboardForm';

export type CreateRestaurantPayload = {
  name: string;
  address: string;
  phone?: string;
};

interface Props {
  visible: boolean;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateRestaurantPayload) => void;
}

export default function RestaurantCreateSheet({
  visible,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; address?: string; phone?: string }>({});

  useEffect(() => {
    if (!visible) return;
    setName('');
    setAddress('');
    setPhone(user?.phone ?? '');
    setErrors({});
  }, [visible, user?.phone]);

  const submit = () => {
    Keyboard.dismiss();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = 'Escribe el nombre del local.';
    if (address.trim().length < 5) next.address = 'Escribe la dirección del local.';
    const phoneError = phone.trim() ? mxPhoneError(phone) : undefined;
    if (phoneError) next.phone = phoneError;
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim() ? normalizeMxPhone(phone) : undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.title}>Nuevo local</Text>
          <Text style={styles.hint}>
            Queda pendiente. Completa menú y perfil; el equipo ZinApp lo publica.
          </Text>
          <KeyboardForm fill={false} contentContainerStyle={styles.form}>
            <FormField
              label="Nombre del negocio"
              value={name}
              onChangeText={setName}
              icon="storefront-outline"
              required
              error={errors.name}
            />
            <FormField
              label="Dirección del local"
              value={address}
              onChangeText={setAddress}
              icon="location-outline"
              placeholder="Calle, número, colonia"
              required
              multiline
              error={errors.address}
            />
            <FormField
              label="Teléfono del negocio"
              value={phone}
              onChangeText={setPhone}
              icon="call-outline"
              keyboardType="phone-pad"
              error={errors.phone}
            />
          </KeyboardForm>
          <Button title="Crear local" onPress={submit} loading={saving} disabled={saving} />
          <Pressable
            onPress={onClose}
            hitSlop={HIT_SLOP}
            style={styles.cancel}
            disabled={saving}
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
    maxHeight: '92%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheetLg,
    borderTopRightRadius: radii.sheetLg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  hint: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  form: { gap: spacing.sm, paddingBottom: spacing.sm },
  cancel: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
});
