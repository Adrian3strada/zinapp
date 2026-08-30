import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import SeasonalHeroAccent from '../../components/seasonal/SeasonalHeroAccent';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appAlert, appConfirm } from '../../utils/appAlert';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { mxPhoneError, normalizeMxPhone } from '../../utils/phone';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import AddressPinPicker from '../../components/AddressPinPicker';
import Button from '../../components/Button';
import CustomerProfileDashboard from '../../components/customer/CustomerProfileDashboard';
import DriverProfileDashboard from '../../components/driver/DriverProfileDashboard';
import EmptyState from '../../components/EmptyState';
import FormField from '../../components/FormField';
import KeyboardForm from '../../components/KeyboardForm';
import ProfileAvatarPicker from '../../components/ProfileAvatarPicker';
import RestaurantProfileDashboard from '../../components/restaurant/RestaurantProfileDashboard';
import RestaurantSetupBanner from '../../components/RestaurantSetupBanner';
import ScreenContainer from '../../components/ScreenContainer';
import SettlementSummary from '../../components/SettlementSummary';
import VehicleTypePicker from '../../components/VehicleTypePicker';
import { useOptionalRestaurantContext } from '../../context/RestaurantContext';
import { vehicleNeedsPlate } from '../../constants/vehicleTypes';
import { useAuth } from '../../context/AuthContext';
import { useOptionalCustomerActiveDeliveries } from '../../context/CustomerActiveDeliveriesContext';
import { useOptionalDriverProfileContext } from '../../context/DriverProfileContext';
import { RESTAURANT_CATEGORIES, RESTAURANT_CATEGORY_LABELS } from '../../utils/restaurantCategories';
import { authApi, deliveryApi, orderApi, restaurantApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { HIT_SLOP, spacing } from '../../theme/spacing';
import { cardShadow } from '../../theme/shadows';
import type { DeliveryProfile, Restaurant, RestaurantBusinessHour } from '../../types';
import { formatCurrency } from '../../utils/format';
import { appendImage, pickImageFromLibrary, pickRestaurantCoverImage, ASPECT_DOCUMENT, ASPECT_SQUARE } from '../../utils/imagePicker';
import type { MapCoordinate } from '../../utils/maps';
import { toCoordinate } from '../../utils/maps';
import { resolveMediaUrl } from '../../utils/media';

const ROLE_LABELS: Record<string, string> = {
  customer: 'Cliente',
  restaurant: 'Restaurante',
  driver: 'Repartidor',
  admin: 'Administrador',
};

const WEEKDAYS = [
  { day_of_week: 0, label: 'Lunes' },
  { day_of_week: 1, label: 'Martes' },
  { day_of_week: 2, label: 'Miércoles' },
  { day_of_week: 3, label: 'Jueves' },
  { day_of_week: 4, label: 'Viernes' },
  { day_of_week: 5, label: 'Sábado' },
  { day_of_week: 6, label: 'Domingo' },
];

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

function normalizeBusinessHours(restaurant: Restaurant): RestaurantBusinessHour[] {
  const byDay = new Map((restaurant.business_hours ?? []).map((hours) => [hours.day_of_week, hours]));
  const legacyOpening = fromApiTime(restaurant.opening_time);
  const legacyClosing = fromApiTime(restaurant.closing_time);
  return WEEKDAYS.map(({ day_of_week }) => {
    const existing = byDay.get(day_of_week);
    if (existing) {
      return {
        id: existing.id,
        day_of_week,
        is_closed: existing.is_closed,
        opening_time: fromApiTime(existing.opening_time) || '09:00',
        closing_time: fromApiTime(existing.closing_time) || '22:00',
      };
    }
    return {
      day_of_week,
      is_closed: false,
      opening_time: legacyOpening || '09:00',
      closing_time: legacyClosing || '22:00',
    };
  });
}

function formatBusinessHoursSummary(hours: RestaurantBusinessHour[]): string {
  const openDays = hours.filter((day) => !day.is_closed);
  if (openDays.length === 0) return 'Todos los días cerrados';
  if (openDays.length === 7) {
    const first = openDays[0];
    const sameHours = openDays.every(
      (day) => day.opening_time === first.opening_time && day.closing_time === first.closing_time,
    );
    if (sameHours) return `Todos los días ${first.opening_time} - ${first.closing_time}`;
  }
  return openDays
    .map((day) => {
      const label = WEEKDAYS.find((item) => item.day_of_week === day.day_of_week)?.label.slice(0, 3) ?? '';
      return `${label} ${day.opening_time} - ${day.closing_time}`;
    })
    .join(' · ');
}

export default function ProfileScreen() {
  const { user, refreshUser, logout } = useAuth();
  const customerDeliveries = useOptionalCustomerActiveDeliveries();
  const activeOrderCount = customerDeliveries?.activeOrderCount ?? 0;
  const restaurantCtx = useOptionalRestaurantContext();
  const driverCtx = useOptionalDriverProfileContext();
  const { insets, keyboardHeaderless, tabBottomPadding } = useTabScreenInsets();
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
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
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
  const [identityDocumentUri, setIdentityDocumentUri] = useState<string | null>(null);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantForm, setRestaurantForm] = useState({
    name: '',
    description: '',
    phone: '',
    whatsapp: '',
    address: '',
  });
  const [restaurantHours, setRestaurantHours] = useState<RestaurantBusinessHour[]>([]);
  const [scheduleTemplate, setScheduleTemplate] = useState({
    opening_time: '09:00',
    closing_time: '22:00',
  });
  const [showAdvancedHours, setShowAdvancedHours] = useState(false);
  const [restaurantImageUri, setRestaurantImageUri] = useState<string | null>(null);
  const [acceptingOrders, setAcceptingOrders] = useState(true);
  const [togglingOrders, setTogglingOrders] = useState(false);
  const [driverUpdating, setDriverUpdating] = useState(false);
  const [restaurantLoadError, setRestaurantLoadError] = useState<string | null>(null);
  const [restaurantCategory, setRestaurantCategory] = useState('general');
  const [restaurantCoords, setRestaurantCoords] = useState<MapCoordinate | null>(null);

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
        });
        const normalizedHours = normalizeBusinessHours(data);
        const firstOpenDay = normalizedHours.find((day) => !day.is_closed) ?? normalizedHours[0];
        setRestaurantHours(normalizedHours);
        setScheduleTemplate({
          opening_time: firstOpenDay?.opening_time ?? '09:00',
          closing_time: firstOpenDay?.closing_time ?? '22:00',
        });
        setShowAdvancedHours(false);
        setAcceptingOrders(data.accepting_orders !== false);
        setRestaurantCategory(data.category ?? 'general');
        setRestaurantCoords(toCoordinate(data.latitude, data.longitude));
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

  useEffect(() => {
    if (!driverCtx?.profile) return;
    setDriverProfile(driverCtx.profile);
  }, [driverCtx?.profile, driverCtx?.isAvailable]);

  useEffect(() => {
    if (user?.role !== 'restaurant') return;
    const activeId = restaurantCtx?.restaurant?.id;
    if (!activeId || restaurant?.id === activeId) return;
    void loadRoleData();
  }, [restaurantCtx?.restaurant?.id, restaurant?.id, user?.role, loadRoleData]);

  const update = (key: keyof typeof form, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const handlePickAvatar = async () => {
    const uri = await pickImageFromLibrary({ aspect: ASPECT_SQUARE });
    if (uri) setAvatarUri(uri);
  };

  const handlePickRestaurantImage = async () => {
    const uri = await pickRestaurantCoverImage();
    if (uri) setRestaurantImageUri(uri);
  };

  const handlePickIdentityDocument = async () => {
    const uri = await pickImageFromLibrary({ aspect: ASPECT_DOCUMENT });
    if (uri) setIdentityDocumentUri(uri);
  };

  const handleToggleAcceptingOrders = async (value: boolean) => {
    if (restaurantCtx?.toggleAcceptingOrders) {
      await restaurantCtx.toggleAcceptingOrders(value);
      setAcceptingOrders(value);
      return;
    }
    if (!restaurant || togglingOrders) return;
    if (!restaurant.is_active) {
      appAlert(
        'Local pendiente',
        'Tu negocio aún no está activo en la app. Completa menú y perfil; cuando esté listo, el equipo ZinApp lo publicará.',
      );
      return;
    }
    setAcceptingOrders(value);
    setTogglingOrders(true);
    try {
      const { data } = await restaurantApi.patch(restaurant.id, { accepting_orders: value });
      setRestaurant(data);
      setAcceptingOrders(data.accepting_orders !== false);
      await restaurantCtx?.refresh();
    } catch (err) {
      setAcceptingOrders(!value);
      appAlert('Error', getApiErrorMessage(err, 'No se pudo actualizar el estado del local'));
    } finally {
      setTogglingOrders(false);
    }
  };

  const handleSavePersonal = async () => {
    const email = form.email.trim().toLowerCase();
    const phoneRaw = form.phone.trim();
    const phoneErr = mxPhoneError(phoneRaw, true);
    if (!form.first_name.trim() || !form.last_name.trim()) {
      appAlert('Nombre completo', 'Indica tu nombre y apellido.');
      return;
    }
    if (!email) {
      appAlert('Email requerido', 'Necesitamos tu correo para recuperar la contraseña.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      appAlert('Email inválido', 'Usa un formato como nombre@correo.com.');
      return;
    }
    if (phoneErr) {
      appAlert('Teléfono', phoneErr);
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('first_name', form.first_name.trim());
      fd.append('last_name', form.last_name.trim());
      fd.append('email', email);
      fd.append('phone', normalizeMxPhone(phoneRaw));
      fd.append('address', form.address.trim());
      const uploadingAvatar = Boolean(avatarUri);
      if (avatarUri) await appendImage(fd, 'avatar', avatarUri, 'avatar.jpg');
      const { data: saved } = await authApi.updateMeForm(fd);
      await refreshUser();
      setAvatarUri(null);
      if (uploadingAvatar && !saved.avatar_url) {
        appAlert(
          'Foto no guardada',
          'El perfil se actualizó pero el servidor no confirmó la foto. Intenta de nuevo.',
        );
        return;
      }
      appAlert(
        'Perfil actualizado',
        uploadingAvatar ? 'Tu foto de perfil quedó guardada.' : undefined,
      );
    } catch (err) {
      const fallback = err instanceof Error ? err.message : 'No se pudo guardar el perfil';
      appAlert('Error', getApiErrorMessage(err, fallback));
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
      const fd = new FormData();
      fd.append('vehicle_type', vehicleType ?? 'motorcycle');
      fd.append('license_plate', licensePlate.trim());
      if (identityDocumentUri) {
        await appendImage(fd, 'identity_document', identityDocumentUri, 'ine.jpg');
      }
      await deliveryApi.updateProfile(fd);
      await loadRoleData();
      setIdentityDocumentUri(null);
      appAlert('Datos de repartidor guardados');
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDriverAvailability = async (value: boolean) => {
    // Misma fuente de verdad que el slide “Conectar” del Inicio.
    if (driverCtx) {
      await driverCtx.toggleAvailability(value);
      return;
    }
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

  const updateRestaurantHour = (
    dayOfWeek: number,
    patch: Partial<Pick<RestaurantBusinessHour, 'is_closed' | 'opening_time' | 'closing_time'>>,
  ) => {
    setRestaurantHours((current) =>
      current.map((item) => (
        item.day_of_week === dayOfWeek
          ? { ...item, ...patch }
          : item
      )),
    );
  };

  const updateScheduleTemplate = (field: 'opening_time' | 'closing_time', value: string) => {
    setScheduleTemplate((current) => ({ ...current, [field]: value }));
    setRestaurantHours((current) =>
      current.map((item) => (
        item.is_closed ? item : { ...item, [field]: value }
      )),
    );
  };

  const toggleRestaurantDay = (dayOfWeek: number) => {
    setRestaurantHours((current) =>
      current.map((item) => {
        if (item.day_of_week !== dayOfWeek) return item;
        const willOpen = item.is_closed;
        return {
          ...item,
          is_closed: !willOpen,
          opening_time: willOpen ? scheduleTemplate.opening_time : item.opening_time,
          closing_time: willOpen ? scheduleTemplate.closing_time : item.closing_time,
        };
      }),
    );
  };

  const applyTemplateToOpenDays = () => {
    setRestaurantHours((current) =>
      current.map((item) => (
        item.is_closed
          ? item
          : {
              ...item,
              opening_time: scheduleTemplate.opening_time,
              closing_time: scheduleTemplate.closing_time,
            }
      )),
    );
  };

  const handleSaveRestaurant = async () => {
    if (!restaurant) return;
    if (!restaurantForm.name.trim() || !restaurantForm.address.trim()) {
      appAlert('Completa nombre y dirección del negocio');
      return;
    }
    if (!restaurantCoords) {
      appAlert(
        'Ubicación en el mapa',
        'Marca en el mapa dónde está tu local. Eso es lo que verán repartidores y clientes.',
      );
      return;
    }
    const bizPhoneErr = mxPhoneError(restaurantForm.phone, true);
    if (bizPhoneErr) {
      appAlert('Teléfono del negocio', bizPhoneErr);
      return;
    }
    const waErr = mxPhoneError(restaurantForm.whatsapp, false);
    if (waErr) {
      appAlert('WhatsApp del negocio', waErr);
      return;
    }
    const hoursPayload: RestaurantBusinessHour[] = [];
    for (const day of restaurantHours) {
      const openingTime = toApiTime(day.opening_time ?? '');
      const closingTime = toApiTime(day.closing_time ?? '');
      if (!day.is_closed && (!openingTime || !closingTime)) {
        appAlert('Horario inválido', 'Usa formato HH:MM en los días abiertos.');
        return;
      }
      if (!day.is_closed && openingTime && closingTime && openingTime === closingTime) {
        appAlert('Horario inválido', 'La hora de apertura y cierre no pueden ser iguales.');
        return;
      }
      hoursPayload.push({
        day_of_week: day.day_of_week,
        is_closed: day.is_closed,
        opening_time: day.is_closed ? null : openingTime,
        closing_time: day.is_closed ? null : closingTime,
      });
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', restaurantForm.name.trim());
      fd.append('description', restaurantForm.description.trim());
      fd.append('phone', normalizeMxPhone(restaurantForm.phone));
      fd.append(
        'whatsapp',
        restaurantForm.whatsapp.trim() ? normalizeMxPhone(restaurantForm.whatsapp) : '',
      );
      fd.append('address', restaurantForm.address.trim());
      fd.append('latitude', String(restaurantCoords.latitude));
      fd.append('longitude', String(restaurantCoords.longitude));
      fd.append('category', restaurantCategory);
      fd.append('accepting_orders', acceptingOrders ? 'true' : 'false');
      fd.append('business_hours', JSON.stringify(hoursPayload));
      if (restaurantImageUri) {
        await appendImage(fd, 'image', restaurantImageUri, 'restaurant.jpg');
      }
      const { data } = await restaurantApi.update(restaurant.id, fd);
      setRestaurant(data);
      setRestaurantHours(normalizeBusinessHours(data));
      setRestaurantCoords(toCoordinate(data.latitude, data.longitude));
      setRestaurantImageUri(null);
      await restaurantCtx?.refresh();
      appAlert('Negocio actualizado');
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo guardar el negocio'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const needsCurrent = user?.has_usable_password !== false;
    if ((needsCurrent && !oldPassword) || !newPassword) {
      appAlert(
        'Datos incompletos',
        needsCurrent ? 'Completa ambas contraseñas.' : 'Escribe la nueva contraseña.',
      );
      return;
    }
    try {
      await authApi.changePassword(needsCurrent ? oldPassword : null, newPassword);
      setOldPassword('');
      setNewPassword('');
      appAlert(needsCurrent ? 'Contraseña cambiada' : 'Contraseña creada');
      await refreshUser();
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err));
    }
  };

  const runAccountDeletion = async () => {
    const needsPassword = user?.has_usable_password !== false;
    if (needsPassword && !deletePassword.trim()) {
      appAlert('Contraseña requerida', 'Ingresa tu contraseña para eliminar la cuenta.');
      return;
    }
    setDeletingAccount(true);
    try {
      await authApi.deleteAccount(needsPassword ? deletePassword.trim() : null);
      setDeletePassword('');
      appAlert(
        'Cuenta eliminada',
        'Tu cuenta y datos personales fueron eliminados. Ya no podrás iniciar sesión.',
        [{ text: 'OK', onPress: () => { void logout(); } }],
      );
      void logout();
    } catch (err) {
      appAlert('Error', getApiErrorMessage(err, 'No se pudo eliminar la cuenta'));
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    appConfirm(
      '¿Eliminar tu cuenta?',
      'Esta acción es permanente. Se borrarán tu perfil y datos personales. No podrás recuperar el acceso.',
      () => {
        appConfirm(
          'Confirmación final',
          'Se eliminará tu cuenta de ZinApp de forma definitiva.',
          () => {
            void runAccountDeletion();
          },
          'Sí, eliminar',
        );
      },
      'Continuar',
    );
  };

  if (!user) return null;

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
  const addressLabel =
    user.role === 'customer' ? 'Dirección habitual de entrega' : 'Dirección personal';

  const isRestaurant = user.role === 'restaurant';
  const isDriver = user.role === 'driver';
  const isCustomer = user.role === 'customer';

  const personalDataCard = (
    <View style={[styles.card, (isCustomer || isDriver) && styles.cardAfterDashboard]}>
      <Text style={styles.section}>{isRestaurant ? 'Tu cuenta' : 'Datos personales'}</Text>
      {isRestaurant ? (
        <Text style={styles.hint}>Información de acceso a ZinApp, distinta a la del local.</Text>
      ) : null}
      <FormField label="Nombre" value={form.first_name} onChangeText={(v) => update('first_name', v)} icon="text-outline" embedded required autoCapitalize="words" />
      <FormField label="Apellido" value={form.last_name} onChangeText={(v) => update('last_name', v)} icon="text-outline" embedded required autoCapitalize="words" />
      <FormField label="Correo" value={form.email} onChangeText={(v) => update('email', v)} icon="mail-outline" embedded keyboardType="email-address" autoCapitalize="none" autoCorrect={false} required />
      <FormField label="Teléfono" value={form.phone} onChangeText={(v) => update('phone', v)} icon="call-outline" embedded keyboardType="phone-pad" required hint="Obligatorio. 10 dígitos, para contactarte durante pedidos." />
      <FormField label={addressLabel} value={form.address} onChangeText={(v) => update('address', v)} icon="location-outline" embedded multiline placeholder="Calle, número, colonia, Zinapécuaro" />
      <Button title="Guardar perfil" onPress={handleSavePersonal} loading={saving} />
    </View>
  );

  return (
    <ScreenContainer>
      <KeyboardForm
        contentContainerStyle={styles.container}
        bottomPadding={tabBottomPadding(spacing.xxl)}
        keyboardVerticalOffset={keyboardHeaderless()}
      >
          <LinearGradient
            colors={
              isDriver
                ? [colors.primary, colors.primaryDark, colors.gradientEnd]
                : [colors.gradientStart, colors.gradientEnd]
            }
            style={[
              styles.header,
              isRestaurant && styles.headerRestaurant,
              (isDriver || isCustomer) && styles.headerWithDashboard,
              { paddingTop: insets.top + spacing.md },
            ]}
          >
            <SeasonalHeroAccent />
            <ProfileAvatarPicker
              imageUri={avatarUri}
              remoteUrl={resolveMediaUrl(user.avatar_url ?? user.avatar)}
              fallbackLetter={user.first_name?.[0] ?? user.username[0]}
              onPick={handlePickAvatar}
            />
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.username}>@{user.username}</Text>
            {isRestaurant && restaurant ? (
              <Pressable
                style={styles.restaurantSubtitleRow}
                onPress={restaurantCtx?.canSwitch ? restaurantCtx.openSwitcher : undefined}
                disabled={!restaurantCtx?.canSwitch}
                accessibilityRole={restaurantCtx?.canSwitch ? 'button' : undefined}
                accessibilityLabel={restaurantCtx?.canSwitch ? 'Cambiar de local' : undefined}
              >
                <Text style={styles.restaurantSubtitle} numberOfLines={1}>
                  {restaurant.name}
                </Text>
                {restaurantCtx?.canSwitch ? (
                  <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.85)" />
                ) : null}
              </Pressable>
            ) : null}
            <View style={styles.roleBadge}>
              <Text style={styles.role}>{ROLE_LABELS[user.role] ?? user.role}</Text>
            </View>
          </LinearGradient>

          {isRestaurant && restaurant ? (
            <RestaurantProfileDashboard
              restaurant={restaurant}
              acceptingOrders={
                restaurantCtx?.restaurant
                  ? restaurantCtx.restaurant.accepting_orders !== false
                  : acceptingOrders
              }
              overlap
              canSwitch={restaurantCtx?.canSwitch}
              onPressSwitch={restaurantCtx?.openSwitcher}
              canAdd={restaurantCtx?.canAdd}
              onPressAdd={restaurantCtx?.openCreate}
            />
          ) : null}

          {isDriver ? (
            <DriverProfileDashboard
              profile={driverCtx?.profile ?? driverProfile}
              earnings={driverEarnings}
              updating={driverCtx?.updating ?? driverUpdating}
              isAvailable={driverCtx?.isAvailable ?? driverProfile?.is_available}
              onToggleAvailability={handleToggleDriverAvailability}
              overlap
            />
          ) : null}

          {isCustomer ? (
            <CustomerProfileDashboard
              activeOrderCount={activeOrderCount}
              address={user.address}
              overlap
            />
          ) : null}

          {isRestaurant && restaurant?.setup_status ? (
            <View style={styles.setupBannerWrap}>
              <RestaurantSetupBanner restaurant={restaurant} setupStatus={restaurant.setup_status} />
            </View>
          ) : null}

          {isRestaurant && !restaurant ? (
            <View style={[styles.card, styles.cardOverlap]}>
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
          ) : null}

          {isRestaurant && restaurant ? (
            <View style={styles.card}>
              <SettlementSummary role="restaurant" />
            </View>
          ) : null}

          {isRestaurant && restaurant ? (
            <View style={styles.card}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionIconWrap}>
                  <Ionicons name="storefront-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.section}>Configuración del local</Text>
                  <Text style={styles.sectionSub}>
                    Datos visibles para clientes y repartidores
                  </Text>
                </View>
              </View>
              <Text style={styles.subsection}>Imagen del local</Text>
              <Text style={styles.hint}>Logo o foto que verán los clientes. Al elegirla podrás recortarla (4:3).</Text>
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
                    <Text style={styles.photoCropHint}>Puedes recortarla al elegirla</Text>
                  </View>
                )}
              </Pressable>
              <FormField label="Nombre del restaurante" value={restaurantForm.name} onChangeText={(v) => setRestaurantForm((f) => ({ ...f, name: v }))} icon="storefront-outline" embedded required />
              <Text style={styles.subsection}>Contacto</Text>
              <FormField label="Teléfono del negocio" value={restaurantForm.phone} onChangeText={(v) => setRestaurantForm((f) => ({ ...f, phone: v }))} icon="call-outline" embedded keyboardType="phone-pad" required hint="Obligatorio. 10 dígitos. Lo ven clientes y repartidores." />
              <FormField label="WhatsApp del negocio" value={restaurantForm.whatsapp} onChangeText={(v) => setRestaurantForm((f) => ({ ...f, whatsapp: v }))} icon="logo-whatsapp" embedded keyboardType="phone-pad" hint="Opcional. Si lo dejas vacío, se usa el teléfono del negocio." />
              <FormField label="Dirección del local" value={restaurantForm.address} onChangeText={(v) => setRestaurantForm((f) => ({ ...f, address: v }))} icon="location-outline" embedded multiline required />
              <AddressPinPicker
                title="Ubicación exacta del local"
                hint="Arrastra el pin al lugar real de tu negocio (la dirección escrita puede no coincidir en el mapa)."
                pinType="restaurant"
                coordinate={restaurantCoords}
                onCoordinateChange={setRestaurantCoords}
              />
              <Text style={styles.subsection}>Horario del local</Text>
              <Text style={styles.hint}>
                Configura días y horas reales. El botón de recibir pedidos se mantiene para pausar o activar pedidos manualmente.
              </Text>
              <Text style={styles.hoursSummary}>
                Actual: {formatBusinessHoursSummary(restaurantHours)}
              </Text>
              <View style={styles.scheduleQuickCard}>
                <Text style={styles.scheduleQuickTitle}>Horario general</Text>
                <View style={styles.hoursRow}>
                  <View style={styles.hourField}>
                    <FormField
                      label="Abre"
                      value={scheduleTemplate.opening_time}
                      onChangeText={(v) => updateScheduleTemplate('opening_time', v)}
                      icon="time-outline"
                      embedded
                      placeholder="09:00"
                      keyboardType="numbers-and-punctuation"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <View style={styles.hourField}>
                    <FormField
                      label="Cierra"
                      value={scheduleTemplate.closing_time}
                      onChangeText={(v) => updateScheduleTemplate('closing_time', v)}
                      icon="time-outline"
                      embedded
                      placeholder="22:00"
                      keyboardType="numbers-and-punctuation"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
                <Text style={styles.fieldLabel}>Días abiertos</Text>
                <View style={styles.dayPickerGrid}>
                  {restaurantHours.map((day) => {
                    const label = WEEKDAYS.find((item) => item.day_of_week === day.day_of_week)?.label.slice(0, 3) ?? '';
                    const isOpen = !day.is_closed;
                    return (
                      <Pressable
                        key={day.day_of_week}
                        style={[styles.dayPickerChip, isOpen && styles.dayPickerChipActive]}
                        onPress={() => toggleRestaurantDay(day.day_of_week)}
                        hitSlop={HIT_SLOP}
                      >
                        <Text style={[styles.dayPickerText, isOpen && styles.dayPickerTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.scheduleActionsRow}>
                  <Pressable
                    style={styles.scheduleAction}
                    onPress={applyTemplateToOpenDays}
                    hitSlop={HIT_SLOP}
                  >
                    <Ionicons name="copy-outline" size={14} color={colors.primary} />
                    <Text style={styles.scheduleActionText}>Aplicar a días abiertos</Text>
                  </Pressable>
                  <Pressable
                    style={styles.scheduleAction}
                    onPress={() => setShowAdvancedHours((value) => !value)}
                    hitSlop={HIT_SLOP}
                  >
                    <Ionicons
                      name={showAdvancedHours ? 'chevron-up-outline' : 'options-outline'}
                      size={14}
                      color={colors.primary}
                    />
                    <Text style={styles.scheduleActionText}>
                      {showAdvancedHours ? 'Ocultar ajustes' : 'Ajustes por día'}
                    </Text>
                  </Pressable>
                </View>
              </View>
              {showAdvancedHours ? (
              <View style={styles.weekHoursList}>
                {restaurantHours.map((day) => {
                  const label = WEEKDAYS.find((item) => item.day_of_week === day.day_of_week)?.label ?? '';
                  return (
                    <View key={day.day_of_week} style={styles.weekHourCard}>
                      <View style={styles.weekHourHeader}>
                        <Text style={styles.weekDayLabel}>{label}</Text>
                        <Pressable
                          style={[
                            styles.dayStatusChip,
                            day.is_closed ? styles.dayStatusClosed : styles.dayStatusOpen,
                          ]}
                          onPress={() => updateRestaurantHour(day.day_of_week, { is_closed: !day.is_closed })}
                          hitSlop={HIT_SLOP}
                        >
                          <Text
                            style={[
                              styles.dayStatusText,
                              day.is_closed ? styles.dayStatusTextClosed : styles.dayStatusTextOpen,
                            ]}
                          >
                            {day.is_closed ? 'Cerrado' : 'Abierto'}
                          </Text>
                        </Pressable>
                      </View>
                      {!day.is_closed ? (
                        <View style={styles.hoursRow}>
                          <View style={styles.hourField}>
                            <FormField
                              label="Abre"
                              value={day.opening_time ?? ''}
                              onChangeText={(v) => updateRestaurantHour(day.day_of_week, { opening_time: v })}
                              icon="time-outline"
                              embedded
                              placeholder="09:00"
                              keyboardType="numbers-and-punctuation"
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                          </View>
                          <View style={styles.hourField}>
                            <FormField
                              label="Cierra"
                              value={day.closing_time ?? ''}
                              onChangeText={(v) => updateRestaurantHour(day.day_of_week, { closing_time: v })}
                              icon="time-outline"
                              embedded
                              placeholder="22:00"
                              keyboardType="numbers-and-punctuation"
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
              ) : null}
              <FormField label="Descripción" value={restaurantForm.description} onChangeText={(v) => setRestaurantForm((f) => ({ ...f, description: v }))} icon="text-outline" embedded multiline placeholder="Qué ofreces, especialidades…" />
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
              <Button title="Guardar negocio" onPress={handleSaveRestaurant} loading={saving} />
            </View>
          ) : null}

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
              <SettlementSummary role="driver" />
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
                  Estado: {driverProfile.verification_status === 'approved' ? (driverProfile.is_available ? 'Disponible' : 'Aprobado, no disponible') : 'Pendiente de aprobación'}
                </Text>
              )}
              <Text style={styles.fieldLabel}>Identificación oficial (INE)</Text>
              <Pressable style={styles.documentPicker} onPress={handlePickIdentityDocument}>
                <Ionicons name="card-outline" size={20} color={colors.primary} />
                <Text style={styles.documentPickerText}>
                  {identityDocumentUri || driverProfile?.identity_document_url ? 'INE cargada · cambiar foto' : 'Subir foto de INE'}
                </Text>
              </Pressable>
              <Button title="Guardar datos de repartidor" variant="secondary" onPress={handleSaveDriver} loading={saving} />
            </View>
          )}

          {!isRestaurant ? personalDataCard : null}

          {isRestaurant ? personalDataCard : null}

          <View style={styles.card}>
            <Text style={styles.section}>
              {user.has_usable_password === false ? 'Crear contraseña' : 'Cambiar contraseña'}
            </Text>
            {user.has_usable_password === false ? (
              <Text style={styles.hint}>
                Entraste con Google. Puedes crear una contraseña para también iniciar sesión con usuario y correo.
              </Text>
            ) : null}
            {user.has_usable_password !== false ? (
              <FormField label="Contraseña actual" value={oldPassword} onChangeText={setOldPassword} icon="lock-closed-outline" embedded secureTextEntry autoCorrect={false} required />
            ) : null}
            <FormField label="Nueva contraseña" value={newPassword} onChangeText={setNewPassword} icon="lock-closed-outline" embedded secureTextEntry autoCorrect={false} required hint="Mínimo 6 caracteres." />
            <Button
              title={user.has_usable_password === false ? 'Crear contraseña' : 'Actualizar contraseña'}
              variant="secondary"
              onPress={handleChangePassword}
            />
          </View>

          <View style={[styles.card, styles.dangerCard]}>
            <Text style={styles.section}>Eliminar cuenta</Text>
            <Text style={styles.hint}>
              Borra de forma permanente tu cuenta y datos personales de ZinApp. Esta acción no se puede deshacer.
            </Text>
            {user.has_usable_password !== false ? (
              <FormField
                label="Contraseña"
                value={deletePassword}
                onChangeText={setDeletePassword}
                icon="lock-closed-outline"
                embedded
                secureTextEntry
                autoCorrect={false}
                required
                hint="Confirma tu identidad antes de eliminar la cuenta."
              />
            ) : (
              <Text style={styles.hint}>
                Entraste con Google: confirma dos veces para eliminar. No hace falta contraseña.
              </Text>
            )}
            <Button
              title="Eliminar mi cuenta"
              variant="danger"
              onPress={handleDeleteAccount}
              loading={deletingAccount}
            />
          </View>

          <Button title="Cerrar sesión" variant="danger" onPress={logout} style={styles.logout} />
      </KeyboardForm>
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
    overflow: 'hidden',
    zIndex: 1,
  },
  headerRestaurant: {
    paddingBottom: spacing.xxl + 40,
  },
  headerWithDashboard: {
    paddingBottom: spacing.xxl + 36,
  },
  name: { fontSize: 22, fontWeight: '800', color: '#FFF', marginTop: spacing.md },
  username: { color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  restaurantSubtitleRow: {
    marginTop: 6,
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  restaurantSubtitle: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
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
  cardAfterDashboard: { marginTop: 0 },
  setupBannerWrap: {
    marginHorizontal: spacing.screen,
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: spacing.md,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: { flex: 1, minWidth: 0 },
  sectionSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  section: { fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  subsection: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
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
  documentPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  documentPickerText: { color: colors.primary, fontWeight: '700', flex: 1 },
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
  photoCropHint: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
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
  ordersToggleInfo: { flex: 1, minWidth: 0 },
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
  hoursSummary: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
    lineHeight: 17,
  },
  scheduleQuickCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  scheduleQuickTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  dayPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.sm,
  },
  dayPickerChip: {
    minWidth: 44,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayPickerChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayPickerText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
  dayPickerTextActive: { color: '#FFF' },
  scheduleActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  scheduleAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  scheduleActionText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  weekHoursList: { gap: spacing.sm, marginBottom: spacing.md },
  weekHourCard: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  weekHourHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: spacing.xs,
  },
  weekDayLabel: { fontSize: 14, fontWeight: '800', color: colors.text, flexShrink: 1 },
  dayStatusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  dayStatusOpen: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  dayStatusClosed: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  dayStatusText: { fontSize: 12, fontWeight: '800' },
  dayStatusTextOpen: { color: colors.success },
  dayStatusTextClosed: { color: colors.error },
  hoursRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  hourField: { flexGrow: 1, flexBasis: 140, minWidth: 120 },
  dangerCard: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  logout: { marginHorizontal: spacing.screen, marginTop: spacing.sm },
});
