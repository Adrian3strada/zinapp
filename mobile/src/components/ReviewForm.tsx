import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { reviewApi } from '../services/api';
import { getApiErrorMessage } from '../utils/apiErrors';
import { colors } from '../theme/colors';
import { cardShadow } from '../theme/shadows';
import Button from './Button';
import FormField from './FormField';

interface Props {
  orderId: number;
  hasDriver: boolean;
  onSubmitted: () => void;
}

function StarRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} accessibilityLabel={`${n} estrellas`}>
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={28}
            color={colors.secondary}
          />
        </Pressable>
      ))}
    </View>
  );
}

export default function ReviewForm({ orderId, hasDriver, onSubmitted }: Props) {
  const [restaurantRating, setRestaurantRating] = useState(5);
  const [driverRating, setDriverRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await reviewApi.create({
        order: orderId,
        restaurant_rating: restaurantRating,
        driver_rating: hasDriver ? driverRating : undefined,
        comment,
      });
      onSubmitted();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudo enviar la calificación'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>¿Cómo estuvo tu pedido?</Text>
      <Text style={styles.subtitle}>Tu opinión ayuda a mejorar ZinApp en Zinapécuaro.</Text>

      <Text style={styles.label}>Restaurante</Text>
      <StarRow value={restaurantRating} onChange={setRestaurantRating} />

      {hasDriver && (
        <>
          <Text style={styles.label}>Repartidor</Text>
          <StarRow value={driverRating} onChange={setDriverRating} />
        </>
      )}

      <FormField
        label="Comentario"
        value={comment}
        onChangeText={setComment}
        icon="chatbubble-outline"
        placeholder="Cuéntanos qué te gustó o qué mejorarías"
        embedded
        multiline
      />

      <Button title={loading ? 'Enviando…' : 'Enviar calificación'} onPress={submit} disabled={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginTop: 8 },
  stars: { flexDirection: 'row', gap: 4, marginBottom: 4 },
});
