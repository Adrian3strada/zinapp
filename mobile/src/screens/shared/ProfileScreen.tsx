import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { appAlert } from '../../utils/appAlert';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import Button from '../../components/Button';
import DriverAvailabilityBanner from '../../components/DriverAvailabilityBanner';
import EmptyState from '../../components/EmptyState';
import FormField from '../../components/FormField';
import ProfileAvatarPicker from '../../components/ProfileAvatarPicker';
import ScreenContainer from '../../components/ScreenContainer';
import VehicleTypePicker from '../../components/VehicleTypePicker';
import { vehicleNeedsPlate } from '../../constants/vehicleTypes';
import { useAuth } from '../../context/AuthContext';
import { RESTAURANT_CATEGORIES, RESTAURANT_CATEGORY_LABELS } from '../../utils/restaurantCategories';
import { authApi, deliveryApi, orderApi, restaurantApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { HIT_SLOP, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { DeliveryProfile, Restaurant } from '../../types';
import type { DriverTabParamList } from '../../navigation/types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatCurrency } from '../../utils/format';
import { restaurantHasTransferInfo } from '../../config/payments';
import { appendImage, pickImageFromLibrary } from '../../utils/imagePicker';
import { formatRestaurantHours } from '../../utils/restaurantMeta';

const ROLE_LABELS: Record<string, string> = {
  customer: 'Cliente',
  restaurant: 'Restaurante',
  driver: 'Repartidor',
  admin: 'Administrador',
};

function fromApiTime(value?: string | null): string {
  if (!value) return '';
  const [hour, minute] = value.split(':');
  return `${hour}:${minute}`;
}

function toApiTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

export default function ProfileScreen() {
  const { user, refreshUser, logout } = useAuth();
  const { insets, keyboardHeaderless, tabBottomPadding } = useTabScreenInsets();
  const driverTabNav = useNavigation<BottomTabNavigationProp<DriverTabParamList>>();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
  });
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const [driverProfile, setDriverProfile] = useState<DeliveryProfile | null>(null);
  const [driverEarnings, setDriverEarnings] = useState<{
    week_deliveries: number;
    week_earnings: string;
    cash_deliveries: number;
    transfer_deliveries: number;
    daily_breakdown: { date: string; deliveries: number; earnings: string }[];
  } | null>(null);
  const [vehicleType, setVehicleType] = useState<DeliveryProfile['vehicle_type']>('motorcycle');
  const [licensePlate, setLicensePlate] = useState('');

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantForm, setRestaurantForm] = useState({
    name: '',
    description: '',
    phone: '',
    whatsapp: '',
    address: '',
    bank_name: '',
    account_holder: '',
    clabe: '',
    opening_time: '',
    closing_time: '',
  });
  const [restaurantImageUri, setRestaurantImageUri] = useState<string | null>(null);
  const [acceptingOrders, setAcceptingOrders] = useState(true);
  const [togglingOrders, setTogglingOrders] = useState(false);
  const [driverUpdating, setDriverUpdating] = useState(false);
  const [restaurantLoadError, setRestaurantLoadError] = useState<string | null>(null);
  const [restaurantCategory, setRestaurantCategory] = useState('general');

  const loadRoleData = useCallback(async () => {
    if (!user) return;
    if (user.role === 'driver') {
      try {
        const { data } = await deliveryApi.getProfile();
        setDriverProfile(data);
        setVehicleType(data.vehicle_type ?? 'motorcycle');
        setLicensePlate(data.license_plate ?? '');
      } catch {
        // Perfil nuevo
      }
      try {
        const { data } = await orderApi.driverEarnings();
        setDriverEarnings(data);
      } catch {
        setDriverEarnings(null);
      }
    }
    if (user.role === 'restaurant') {
      try {
        const { data } = await restaurantApi.mine();
        setRestaurant(data);
        setRestaurantLoadError(null);
        setRestaurantForm({
          name: data.name,
          description: data.description ?? '',
          phone: data.phone ?? '',
          whatsapp: data.whatsapp ?? '',
          address: data.address ?? '',
          bank_name: data.bank_name ?? '',
          account_holder: data.account_holder ?? '',
          clabe: data.clabe ?? '',
          opening_time: fromApiTime(data.opening_time),
          closing_time: fromApiTime(data.closing_time),
        });
        setAcceptingOrders(data.accepting_orders !== false);
        setRestaurantCategory(data.category ?? 'general');
      } catch (err) {
        setRestaurant(null);
        setRestaurantLoadError(getApiErrorMessage(err, 'No se pudo cargar tu restaurante'));
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        email: user.email ?? '',
        phone: user.phone ?? '',
        address: user.address ?? '',
      });
      setAvatarUri(null);
      loadRoleData();
    }
  }, [user, loadRoleData]);

  const update = (key: keyof typeof form, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handlePickAvatar = async () => {
    const uri = await pickImageFromLibrary();
    if (uri) setAvatarUri(uri);
  };

  const handlePickRestaurantImage = async () => {
    const uri = await pickImageFromLibrary();
    if (uri) setRestaurantImageUri(uri);
  };

  const handleToggleAcceptingOrders = async (value: boolean) => {
    if (!restaurant || togglingOrders) return;
    setAcceptingOrders(value);
    setTogglingOrders(true);
    try {
      const { data } = await restaurantApi.patch(restaurant.id, { accepting_orders: value });
      setRestaurant(data);
      setAcceptingOrders(data.accepting_orders !== false);
    } catch (err) {
      setAcceptingOrders(!value);
      appAlert('Error', getApiErrorMessage(err, 'No se pudo actualizar el estado del local'));
    } finally {
      setTogglingOrders(false);
    }
  };

  const handleSavePersonal = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('first_name', form.first_name.trim());
      fd.append('last_name', form.last_name.trim());
      fd.append('email', form.email.trim());
      fd.append('phone', form.phone.trim());
      fd.append('address', form.address.trim());
      if (avatarUri) appendImage(fd, 'avatar', avatarUri, 'avatar.jpg');
      await authApi.updateMeForm(fd);
      await refreshUser();
      setAvatarUri(null);
      appAlert('Perfil actualizado');
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo guardar el perfil'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDriver = async () => {
    if (vehicleNeedsPlate(vehicleType) && !licensePlate.trim()) {
      appAlert('Placas requeridas', 'Indica las placas de tu moto o auto.');
      return;
    }
    setSaving(true);
    try {
      await deliveryApi.updateProfile({
        vehicle_type: vehicleType,
        license_plate: licensePlate.trim(),
      });
      await loadRoleData();
      appAlert('Datos de repartidor guardados');
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDriverAvailability = async (value: boolean) => {
    if (driverUpdating) return;
    const previous = driverProfile?.is_available ?? false;
    setDriverProfile((prev) => (prev ? { ...prev, is_available: value } : prev));
    setDriverUpdating(true);
    try {
      await deliveryApi.setAvailability(value);
    } catch (err) {
      setDriverProfile((prev) => (prev ? { ...prev, is_available: previous } : prev));
      appAlert('Disponibilidad', getApiErrorMessage(err, 'No se pudo actualizar tu estado.'));
    } finally {
      setDriverUpdating(false);
    }
  };

  const handleSaveRestaurant = async () => {
    if (!restaurant) return;
    if (!restaurantForm.name.trim() || !restaurantForm.address.trim()) {
      appAlert('Completa nombre y dirección del negocio');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', restaurantForm.name.trim());
      fd.append('description', restaurantForm.description.trim());
      fd.append('phone', restaurantForm.phone.trim());
      fd.append('whatsapp', restaurantForm.whatsapp.trim());
      fd.append('address', restaurantForm.address.trim());
      fd.append('bank_name', restaurantForm.bank_name.trim());
      fd.append('account_holder', restaurantForm.account_holder.trim());
      fd.append('clabe', restaurantForm.clabe.replace(/\D/g, ''));
      fd.append('category', restaurantCategory);
      fd.append('accepting_orders', acceptingOrders ? 'true' : 'false');
      const openTime = toApiTime(restaurantForm.opening_time);
      const closeTime = toApiTime(restaurantForm.closing_time);
      if (openTime) fd.append('opening_time', openTime);
      if (closeTime) fd.append('closing_time', closeTime);
      if (restaurantImageUri) {
        appendImage(fd, 'image', restaurantImageUri, 'restaurant.jpg');
      }
      const { data } = await restaurantApi.update(restaurant.id, fd);
      setRestaurant(data);
      setRestaurantImageUri(null);
      appAlert('Negocio actualizado');
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo guardar el negocio'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      appAlert('Completa ambas contraseñas');
      return;
    }
    try {
      await authApi.changePassword(oldPassword, newPassword);
      setOldPassword('');
      setNewPassword('');
      appAlert('Contraseña cambiada');
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err));
    }
  };

  if (!user) return null;

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
  const addressLabel =
    user.role === 'customer' ? 'Dirección habitual de entrega' : 'Dirección personal';

  const scrollPadding = {
    paddingBottom: tabBottomPadding(spacing.xxl),
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardHeaderless()}
      >
        <ScrollView
          contentContainerStyle={[styles.container, scrollPadding]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            style={[styles.header, { paddingTop: insets.top + spacing.md }]}
          >
            <ProfileAvatarPicker
              imageUri={avatarUri}
              remoteUrl={user.avatar_url}
              fallbackLetter={user.first_name?.[0] ?? user.username[0]}
              onPick={handlePickAvatar}
            />
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.username}>@{user.username}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.role}>{ROLE_LABELS[user.role] ?? user.role}</Text>
            </View>
          </LinearGradient>

          <View style={[styles.card, styles.cardOverlap]}>
            <Text style={styles.section}>Datos personales</Text>
            <FormField label="Nombre" value={form.first_name} onChangeText={(v) => update('first_name', v)} icon="text-outline" embedded required autoCapitalize="words" />
            <FormField label="Apellido" value={form.last_name} onChangeText={(v) => update('last_name', v)} icon="text-outline" embedded required autoCapitalize="words" />
            <FormField label="Correo" value={form.email} onChangeText={(v) => update('email', v)} icon="mail-outline" embedded keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <FormField label="Teléfono" value={form.phone} onChangeText={(v) => update('phone', v)} icon="call-outline" embedded keyboardType="phone-pad" required={user.role !== 'customer'} hint={user.role === 'customer' ? 'Opcional, útil para el repartidor.' : 'Para contactarte durante pedidos.'} />
            <FormField label={addressLabel} value={form.address} onChangeText={(v) => update('address', v)} icon="location-outline" embedded multiline placeholder="Calle, número, colonia, Zinapécuaro" />
            <Button title="Guardar perfil" onPress={handleSavePersonal} loading={saving} />
          </View>

          {user.role === 'driver' && (
            <View style={styles.card}>
              <Text style={styles.section}>Ganancias (7 días)</Text>
              {driverEarnings ? (
                <>
                  <Text style={styles.earningsValue}>
                    {formatCurrency(driverEarnings.week_earnings)}
                  </Text>
                  <Text style={styles.hint}>
                    {driverEarnings.week_deliveries} entrega
                    {driverEarnings.week_deliveries === 1 ? '' : 's'} · Efectivo: {driverEarnings.cash_deliveries} · Transferencia: {driverEarnings.transfer_deliveries}
                  </Text>
                  {driverEarnings.daily_breakdown.slice(0, 5).map((day) => (
                    <Text key={day.date} style={styles.dailyRow}>
                      {day.date}: {day.deliveries} entrega{day.deliveries === 1 ? '' : 's'} · {formatCurrency(day.earnings)}
                    </Text>
                  ))}
                </>
              ) : (
                <Text style={styles.hint}>Sin entregas completadas esta semana.</Text>
              )}
            </View>
          )}

          {user.role === 'driver' && (
            <View style={styles.card}>
              <Text style={styles.section}>Disponibilidad</Text>
              <DriverAvailabilityBanner
                isAvailable={driverProfile?.is_available ?? false}
                updating={driverUpdating}
                onToggle={handleToggleDriverAvailability}
              />
            </View>
          )}

          {user.role === 'driver' && (
            <View style={styles.card}>
              <Text style={styles.section}>Datos de repartidor</Text>
              <Text style={styles.hint}>Esta info la ven los clientes cuando llevas su pedido.</Text>
              <Text style={styles.fieldLabel}>Tipo de vehículo</Text>
              <VehicleTypePicker value={vehicleType} onChange={setVehicleType} />
              {vehicleNeedsPlate(vehicleType) && (
                <FormField
                  label="Placas"
                  value={licensePlate}
                  onChangeText={setLicensePlate}
                  icon="card-outline"
                  placeholder="Ej. ABC-123-D"
                  embedded
                  required
                  autoCapitalize="characters"
                />
              )}
              {driverProfile && (
                <Text style={styles.statusLine}>
                  Estado: {driverProfile.is_available ? 'Disponible' : 'No disponible'}
                </Text>
              )}
              <Button
                title="Ir a entregas disponibles"
                variant="secondary"
                onPress={() => driverTabNav.navigate('Disponibles')}
                style={{ marginBottom: spacing.md }}
              />
              <Button title="Guardar datos de repartidor" variant="secondary" onPress={handleSaveDriver} loading={saving} />
            </View>
          )}

          {user.role === 'restaurant' && !restaurant && (
            <View style={styles.card}>
              <EmptyState
                emoji="🏪"
                title="Sin local vinculado"
                subtitle={
                  restaurantLoadError
                  ?? 'Tu cuenta de restaurante no tiene un negocio asignado. Contacta soporte.'
                }
              />
              <Button title="Reintentar" variant="secondary" onPress={loadRoleData} style={{ marginTop: 12 }} />
            </View>
          )}

          {user.role === 'restaurant' && restaurant && (
            <View style={styles.card}>
              <Text style={styles.section}>Tu negocio</Text>
              {!restaurantHasTransferInfo(restaurant) && (
                <View style={styles.warnBanner}>
                  <Ionicons name="warning-outline" size={20} color={colors.warning} />
                  <Text style={styles.warnText}>
                    Agrega tu CLABE para que los clientes te paguen por transferencia directamente.
                  </Text>
                </View>
              )}
              <Text style={styles.hint}>Logo o foto que verán los clientes en la app.</Text>
              <Pressable style={styles.logoBox} onPress={handlePickRestaurantImage} hitSlop={HIT_SLOP}>
                {restaurantImageUri || restaurant.image_url ? (
                  <Image
                    source={{ uri: restaurantImageUri ?? restaurant.image_url ?? undefined }}
                    style={styles.logoImage}
                  />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <Ionicons name="storefront-outline" size={40} color={colors.primary} />
                    <Text style={styles.logoPlaceholderText}>Subir foto del local</Text>
                  </View>
                )}
              </Pressable>
              <FormField label="Nombre del restaurante" value={restaurantForm.name} onChangeText={(v) => setRestaurantForm((f) => ({ ...f, name: v }))} icon="storefront-outline" embedded required />
              <Text style={styles.section}>Contacto</Text>
              <FormField label="Teléfono del negocio" value={restaurantForm.phone} onChangeText={(v) => setRestaurantForm((f) => ({ ...f, phone: v }))} icon="call-outline" embedded keyboardType="phone-pad" hint="Lo ven clientes y repartidores al coordinar pedidos." />
              <FormField label="WhatsApp (comprobantes)" value={restaurantForm.whatsapp} onChangeText={(v) => setRestaurantForm((f) => ({ ...f, whatsapp: v }))} icon="logo-whatsapp" embedded keyboardType="phone-pad" hint="Opcional. Si lo dejas vacío, se usa el teléfono del negocio." />
              <FormField label="Dirección del local" value={restaurantForm.address} onChangeText={(v) => setRestaurantForm((f) => ({ ...f, address: v }))} icon="location-outline" embedded multiline required />
              <Text style={styles.section}>Datos bancarios</Text>
              <Text style={styles.hint}>Los clientes los ven al pagar por transferencia. Solo tú puedes editarlos.</Text>
              <FormField label="Banco" value={restaurantForm.bank_name} onChangeText={(v) => setRestaurantForm((f) => ({ ...f, bank_name: v }))} icon="business-outline" embedded placeholder="Ej. BBVA, Banorte" />
              <FormField label="Titular de la cuenta" value={restaurantForm.account_holder} onChangeText={(v) => setRestaurantForm((f) => ({ ...f, account_holder: v }))} icon="person-outline" embedded placeholder="Nombre como aparece en el banco" />
              <FormField label="CLABE interbancaria" value={restaurantForm.clabe} onChangeText={(v) => setRestaurantForm((f) => ({ ...f, clabe: v }))} icon="card-outline" embedded keyboardType="phone-pad" placeholder="18 dígitos" hint="18 dígitos para recibir transferencias." />
              <Text style={styles.section}>Horario del local</Text>
              <Text style={styles.hint}>
                Horario actual: {formatRestaurantHours(restaurant.opening_time, restaurant.closing_time) ?? 'Sin definir (siempre abierto si recibes pedidos)'}
              </Text>
              <View style={styles.hoursRow}>
                <View style={styles.hourField}>
                  <FormField
                    label="Abre"
                    value={restaurantForm.opening_time}
                    onChangeText={(v) => setRestaurantForm((f) => ({ ...f, opening_time: v }))}
                    icon="time-outline"
                    embedded
                    placeholder="09:00"
                  />
                </View>
                <View style={styles.hourField}>
                  <FormField
                    label="Cierra"
                    value={restaurantForm.closing_time}
                    onChangeText={(v) => setRestaurantForm((f) => ({ ...f, closing_time: v }))}
                    icon="time-outline"
                    embedded
                    placeholder="22:00"
                  />
                </View>
              </View>
              <FormField label="Descripción" value={restaurantForm.description} onChangeText={(v) => setRestaurantForm((f) => ({ ...f, description: v }))} icon="text-outline" embedded multiline placeholder="Qué ofreces, horarios, especialidades…" />
              <Text style={styles.fieldLabel}>Categoría</Text>
              <View style={styles.categoryRow}>
                {RESTAURANT_CATEGORIES.filter((c) => c.key).map((cat) => (
                  <Pressable
                    key={cat.key!}
                    style={[styles.categoryChip, restaurantCategory === cat.key && styles.categoryChipActive]}
                    onPress={() => setRestaurantCategory(cat.key!)}
                  >
                    <Text style={[styles.categoryChipText, restaurantCategory === cat.key && styles.categoryChipTextActive]}>
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.hint}>
                Actual: {RESTAURANT_CATEGORY_LABELS[restaurantCategory] ?? 'General'}
              </Text>
              <View style={styles.ordersToggle}>
                <View style={styles.ordersToggleInfo}>
                  <Text style={styles.ordersToggleLabel}>Recibiendo pedidos</Text>
                  <Text style={styles.ordersToggleHint}>
                    {acceptingOrders
                      ? 'Los clientes pueden pedir a tu local.'
                      : 'Tu local aparece como cerrado en la app.'}
                  </Text>
                </View>
                <Switch
                  value={acceptingOrders}
                  onValueChange={handleToggleAcceptingOrders}
                  disabled={togglingOrders}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
              <Button title="Guardar negocio" onPress={handleSaveRestaurant} loading={saving} />
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.section}>Cambiar contraseña</Text>
            <FormField label="Contraseña actual" value={oldPassword} onChangeText={setOldPassword} icon="lock-closed-outline" embedded secureTextEntry autoCorrect={false} required />
            <FormField label="Nueva contraseña" value={newPassword} onChangeText={setNewPassword} icon="lock-closed-outline" embedded secureTextEntry autoCorrect={false} required hint="Mínimo 6 caracteres." />
            <Button title="Actualizar contraseña" variant="secondary" onPress={handleChangePassword} />
          </View>

          <Button title="Cerrar sesión" variant="danger" onPress={logout} style={styles.logout} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { paddingBottom: spacing.xxl },
  header: {
    alignItems: 'center',
    paddingBottom: spacing.xxl + 24,
    paddingHorizontal: spacing.screen,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    zIndex: 1,
  },
  name: { fontSize: 22, fontWeight: '800', color: '#FFF', marginTop: spacing.md },
  username: { color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  roleBadge: {
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  role: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: spacing.lg,
    marginHorizontal: spacing.screen,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  cardOverlap: { marginTop: -32, zIndex: 2, elevation: 4 },
  section: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing.sm, letterSpacing: -0.2 },
  hint: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 18 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statusLine: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },
  earningsValue: { fontSize: 28, fontWeight: '800', color: colors.primary, marginBottom: spacing.xs },
  dailyRow: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  categoryChipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  categoryChipTextActive: { color: colors.primary },
  logoBox: {
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  logoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoPlaceholderText: { color: colors.primary, fontWeight: '600' },
  ordersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: spacing.md,
    gap: 12,
  },
  ordersToggleInfo: { flex: 1 },
  ordersToggleLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  ordersToggleHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  warnBanner: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 12,
    marginBottom: spacing.md,
  },
  warnText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  hoursRow: { flexDirection: 'row', gap: 10 },
  hourField: { flex: 1 },
  logout: { marginHorizontal: spacing.screen, marginTop: spacing.sm },
});
