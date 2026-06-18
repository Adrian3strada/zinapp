import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BrandLogo from '../../components/BrandLogo';
import Button from '../../components/Button';
import FormField from '../../components/FormField';
import FormSection from '../../components/FormSection';
import VehicleTypePicker from '../../components/VehicleTypePicker';
import { vehicleNeedsPlate } from '../../constants/vehicleTypes';
import { useAuth } from '../../context/AuthContext';
import type { RegisterScreenProps } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { DeliveryProfile, UserRole } from '../../types';
import { getApiErrorMessage } from '../../utils/apiErrors';

const ROLES: { value: UserRole; label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }[] = [
  { value: 'customer', label: 'Cliente', icon: 'person', hint: 'Pide comida a domicilio' },
  { value: 'restaurant', label: 'Restaurante', icon: 'restaurant', hint: 'Vende en la app' },
  { value: 'driver', label: 'Repartidor', icon: 'bicycle', hint: 'Entrega pedidos' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const { register } = useAuth();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    role: 'customer' as UserRole,
    restaurant_name: '',
    restaurant_address: '',
    restaurant_phone: '',
    restaurant_description: '',
    vehicle_type: 'motorcycle' as NonNullable<DeliveryProfile['vehicle_type']>,
    license_plate: '',
  });
  const [loading, setLoading] = useState(false);

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const phoneRequired = form.role === 'driver' || form.role === 'restaurant';
  const plateRequired = form.role === 'driver' && vehicleNeedsPlate(form.vehicle_type);

  const addressLabel = useMemo(() => {
    if (form.role === 'customer') return 'Dirección habitual de entrega';
    if (form.role === 'driver') return 'Dirección personal (opcional)';
    return 'Tu dirección';
  }, [form.role]);

  const handleRegister = async () => {
    const username = form.username.trim().toLowerCase();
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.trim();

    if (!username) {
      appAlert('Usuario requerido', 'Elige un nombre de usuario único.');
      return;
    }
    if (email && !EMAIL_REGEX.test(email)) {
      appAlert('Email inválido', 'Usa un formato como nombre@correo.com o déjalo vacío.');
      return;
    }
    if (!form.first_name.trim() || !form.last_name.trim()) {
      appAlert('Nombre completo', 'Indica tu nombre y apellido.');
      return;
    }
    if (phoneRequired && !phone) {
      appAlert(
        'Teléfono requerido',
        form.role === 'driver'
          ? 'Los repartidores necesitan teléfono para coordinar entregas.'
          : 'Indica un teléfono de contacto para tu negocio.',
      );
      return;
    }
    if (!form.password) {
      appAlert('Contraseña requerida', 'Ingresa una contraseña.');
      return;
    }
    if (form.password !== form.password_confirm) {
      appAlert('Contraseñas', 'Las contraseñas no coinciden.');
      return;
    }
    if (form.password.length < 6) {
      appAlert('Contraseña', 'Debe tener al menos 6 caracteres.');
      return;
    }
    if (form.role === 'restaurant') {
      if (!form.restaurant_name.trim()) {
        appAlert('Restaurante', 'Indica el nombre de tu negocio.');
        return;
      }
      if (!form.restaurant_address.trim()) {
        appAlert('Restaurante', 'Indica la dirección del negocio.');
        return;
      }
    }
    if (form.role === 'driver') {
      if (plateRequired && !form.license_plate.trim()) {
        appAlert('Placas requeridas', 'Indica las placas de tu moto o auto.');
        return;
      }
    }

    setLoading(true);
    try {
      await register({
        ...form,
        username,
        email,
        phone,
        role: form.role as 'customer' | 'restaurant' | 'driver',
        vehicle_type: form.role === 'driver' ? form.vehicle_type : undefined,
        license_plate: form.role === 'driver' ? form.license_plate.trim() : undefined,
      });
      if (form.role === 'driver') {
        appAlert(
          '¡Bienvenido repartidor!',
          'Tu cuenta está lista. Activa tu disponibilidad en la pestaña Disponibles cuando quieras recibir pedidos.',
        );
      }
    } catch (err: unknown) {
      const error = err as Error & { message?: string };
      if (error.message === 'LOGIN_AFTER_REGISTER') {
        appAlert('Cuenta creada', 'Ya puedes iniciar sesión.', [
          { text: 'Ir a login', onPress: () => navigation.goBack() },
        ]);
        return;
      }
      appAlert('No se pudo registrar', getApiErrorMessage(err, 'Verifica los datos e intenta de nuevo.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={[styles.hero, { paddingTop: insets.top + 24 }]}
        >
          <BrandLogo width={180} />
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Elige cómo usarás ZinApp en Zinapécuaro</Text>
        </LinearGradient>

        <View style={[styles.formArea, cardShadow]}>
        <FormSection title="1. Tipo de cuenta">
          <View style={styles.roles}>
            {ROLES.map((r) => (
              <Pressable
                key={r.value}
                style={[styles.roleCard, form.role === r.value && styles.roleActive]}
                onPress={() => update('role', r.value)}
              >
                <Ionicons
                  name={r.icon}
                  size={22}
                  color={form.role === r.value ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.roleText, form.role === r.value && styles.roleTextActive]}>
                  {r.label}
                </Text>
                <Text style={styles.roleHint}>{r.hint}</Text>
              </Pressable>
            ))}
          </View>
        </FormSection>

        <FormSection title="2. Tus datos">
          <FormField
            label="Usuario"
            value={form.username}
            onChangeText={(v) => update('username', v)}
            icon="person-outline"
            placeholder="ej. maria_garcia"
            hint="Sin espacios. Letras, números y guión bajo."
            required
            autoCapitalize="none"
            autoCorrect={false}
          />
          <FormField
            label="Email"
            value={form.email}
            onChangeText={(v) => update('email', v)}
            icon="mail-outline"
            placeholder="nombre@correo.com (opcional)"
            hint="Para recuperar tu contraseña."
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <FormField
            label="Nombre"
            value={form.first_name}
            onChangeText={(v) => update('first_name', v)}
            icon="text-outline"
            required
            autoCapitalize="words"
          />
          <FormField
            label="Apellido"
            value={form.last_name}
            onChangeText={(v) => update('last_name', v)}
            icon="text-outline"
            required
            autoCapitalize="words"
          />
          <FormField
            label="Teléfono"
            value={form.phone}
            onChangeText={(v) => update('phone', v)}
            icon="call-outline"
            placeholder="443 123 4567"
            hint={
              phoneRequired
                ? 'Obligatorio para contactarte durante pedidos.'
                : 'Opcional, útil para que el repartidor te llame.'
            }
            required={phoneRequired}
            keyboardType="phone-pad"
          />
          <FormField
            label={addressLabel}
            value={form.address}
            onChangeText={(v) => update('address', v)}
            icon="location-outline"
            multiline
            placeholder="Ej. Félix Ireta, Las Galeras, Av. Hidalgo 64"
          />
        </FormSection>

        {form.role === 'driver' && (
          <FormSection
            title="3. Datos de repartidor"
            hint="Esta información la verán clientes y restaurantes cuando lleves un pedido."
          >
            <Text style={styles.fieldLabel}>Tipo de vehículo *</Text>
            <VehicleTypePicker
              value={form.vehicle_type}
              onChange={(v) => update('vehicle_type', v)}
            />
            {plateRequired && (
              <FormField
                label="Placas del vehículo"
                value={form.license_plate}
                onChangeText={(v) => update('license_plate', v)}
                icon="card-outline"
                placeholder="Ej. ABC-123-D"
                hint="Requerido para moto y auto."
                required
                autoCapitalize="characters"
              />
            )}
            {!plateRequired && (
              <Text style={styles.fieldHint}>Las bicicletas no requieren placas.</Text>
            )}
          </FormSection>
        )}

        {form.role === 'restaurant' && (
          <FormSection title="3. Datos del restaurante">
            <FormField
              label="Nombre del negocio"
              value={form.restaurant_name}
              onChangeText={(v) => update('restaurant_name', v)}
              icon="storefront-outline"
              required
            />
            <FormField
              label="Dirección del local"
              value={form.restaurant_address}
              onChangeText={(v) => update('restaurant_address', v)}
              icon="location-outline"
              placeholder="Calle, número, colonia"
              required
              multiline
            />
            <FormField
              label="Teléfono del negocio"
              value={form.restaurant_phone}
              onChangeText={(v) => update('restaurant_phone', v)}
              icon="call-outline"
              placeholder="Si es distinto al personal"
              keyboardType="phone-pad"
            />
            <FormField
              label="Descripción"
              value={form.restaurant_description}
              onChangeText={(v) => update('restaurant_description', v)}
              icon="text-outline"
              placeholder="Qué ofreces, horarios, especialidades…"
              multiline
            />
            <Text style={styles.fieldHint}>
              Se crea tu restaurante automáticamente (horario inicial 9:00–22:00). Edita logo y datos en Perfil.
            </Text>
          </FormSection>
        )}

        <FormSection title={form.role === 'customer' ? '3. Seguridad' : '4. Seguridad'}>
          <FormField
            label="Contraseña"
            value={form.password}
            onChangeText={(v) => update('password', v)}
            icon="lock-closed-outline"
            placeholder="Mínimo 6 caracteres"
            required
            secureTextEntry
            autoCorrect={false}
          />
          <FormField
            label="Confirmar contraseña"
            value={form.password_confirm}
            onChangeText={(v) => update('password_confirm', v)}
            icon="lock-closed-outline"
            required
            secureTextEntry
            autoCorrect={false}
          />
        </FormSection>

        <Button
          title={loading ? 'Creando cuenta…' : 'Crear cuenta'}
          onPress={handleRegister}
          disabled={loading}
          size="lg"
        />
        <Button
          title="Ya tengo cuenta"
          variant="ghost"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 8 }}
        />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  hero: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  formArea: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginTop: -24,
    borderRadius: 24,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#FFF', textAlign: 'center', marginTop: 12 },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  fieldHint: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 17 },
  roles: { flexDirection: 'row', gap: 8 },
  roleCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.borderLight,
    gap: 4,
    minHeight: 92,
  },
  roleActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roleText: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
  roleTextActive: { color: colors.primary },
  roleHint: { fontSize: 10, color: colors.textMuted, textAlign: 'center', lineHeight: 13 },
});
