import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { appAlert } from '../utils/appAlert';

import { colors } from '../theme/colors';
import { openWhatsApp } from '../utils/whatsapp';

interface Props {
  phone?: string | null;
  message: string;
  label?: string;
}

export default function ContactWhatsAppButton({ phone, message, label = 'Contactar por WhatsApp' }: Props) {
  if (!phone?.trim()) return null;

  const handlePress = async () => {
    try {
      await openWhatsApp(phone, message);
    } catch (err) {
      appAlert('WhatsApp', err instanceof Error ? err.message : 'No se pudo abrir WhatsApp.');
    }
  };

  return (
    <Pressable style={styles.btn} onPress={handlePress}>
      <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D36618',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#25D36644',
  },
  text: { fontSize: 14, fontWeight: '700', color: colors.text },
});
