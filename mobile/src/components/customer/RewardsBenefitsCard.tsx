import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import Button from '../Button';
import FormField from '../FormField';
import { authApi } from '../../services/api';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import type { RewardsPayload, User } from '../../types';
import { appAlert } from '../../utils/appAlert';
import { getApiErrorMessage } from '../../utils/apiErrors';

interface Props {
  rewards: RewardsPayload | null;
  user?: User | null;
  onUserUpdated?: (user: User) => void;
}

export default function RewardsBenefitsCard({ rewards, user, onUserUpdated }: Props) {
  const loyalty = rewards?.loyalty;
  const birthday = rewards?.birthday;
  const referral = rewards?.referral;
  const unlocked = loyalty?.unlocked === true;
  const remaining = loyalty?.remaining ?? 5;
  const completed = loyalty?.completed_in_cycle ?? 0;
  const required = loyalty?.required ?? 5;
  const code = referral?.code || user?.referral_code || '';
  const [inviteCode, setInviteCode] = useState('');
  const [savingCode, setSavingCode] = useState(false);

  let loyaltyCopy = `${completed} de ${required} pedidos completados`;
  let loyaltyHint = `Te falta ${remaining} pedido${remaining === 1 ? '' : 's'} para desbloquear envío gratis.`;
  if (unlocked) {
    loyaltyCopy = '¡Tienes envío gratis en tu próximo pedido!';
    loyaltyHint = 'Se aplica solo al envío, en el checkout.';
  } else if (completed === 0) {
    loyaltyHint = 'Cada 5 pedidos entregados te regalamos el envío.';
  }

  const handleShare = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Usa mi código ${code} en ZinApp y los dos ganamos envío gratis en Zinapécuaro.`,
      });
    } catch {
      appAlert('Tu código', code);
    }
  };

  const handleApplyInvite = async () => {
    const raw = inviteCode.trim().toUpperCase();
    if (!raw) {
      appAlert('Código', 'Escribe el código de quien te invitó.');
      return;
    }
    setSavingCode(true);
    try {
      const { data } = await authApi.updateMe({ invite_code: raw } as Partial<User>);
      onUserUpdated?.(data);
      setInviteCode('');
      appAlert('Listo', 'Código aplicado. Tu primer pedido lleva envío gratis.');
    } catch (err) {
      appAlert('Código', getApiErrorMessage(err, 'No se pudo aplicar el código.'));
    } finally {
      setSavingCode(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.section}>Beneficios ZinApp</Text>

      <View style={styles.tile}>
        <Text style={styles.tileTitle}>Invita y ganan envío</Text>
        <Text style={styles.tileBody}>
          Quien use tu código recibe envío gratis en su primer pedido. Cuando lo entreguen, tú también ganas uno.
        </Text>
        {code ? (
          <>
            <Text style={styles.code}>{code}</Text>
            <Button title="Compartir código" onPress={handleShare} />
          </>
        ) : null}
        {!referral?.referred ? (
          <View style={styles.inviteBlock}>
            <FormField
              label="¿Te invitaron?"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              placeholder="Código de 6 letras"
              embedded
            />
            <Button
              title="Aplicar código"
              variant="secondary"
              onPress={handleApplyInvite}
              loading={savingCode}
            />
          </View>
        ) : (
          <Text style={styles.tileHint}>
            {referral?.invitee_available
              ? 'Tu primer pedido lleva envío de bienvenida.'
              : 'Ya usaste tu envío de bienvenida.'}
          </Text>
        )}
        {(referral?.credits ?? 0) > 0 ? (
          <Text style={styles.tileHint}>
            Tienes {referral?.credits} envío{referral?.credits === 1 ? '' : 's'} gratis por invitar.
          </Text>
        ) : null}
      </View>

      <View style={styles.tile}>
        <Text style={styles.tileTitle}>Tu cumpleaños merece algo especial</Text>
        {birthday?.available ? (
          <Text style={styles.tileBody}>Hoy tienes envío gratis de cumpleaños en tu próximo pedido.</Text>
        ) : birthday?.date ? (
          <Text style={styles.tileBody}>
            {birthday.used_this_year
              ? 'Ya usaste tu envío de cumpleaños este año.'
              : 'El día de tu cumpleaños el envío va por nuestra cuenta, una vez al año.'}
          </Text>
        ) : (
          <Text style={styles.tileBody}>
            Agrega tu fecha de cumpleaños y recibe envío gratis en tu día.
          </Text>
        )}
      </View>

      <View style={[styles.tile, unlocked && styles.tileReady]}>
        <View style={styles.tileRow}>
          <Ionicons name="bicycle-outline" size={18} color={unlocked ? colors.success : colors.primary} />
          <Text style={styles.tileTitle}>Programa de lealtad</Text>
        </View>
        <Text style={styles.tileBody}>{loyaltyCopy}</Text>
        <Text style={styles.tileHint}>{loyaltyHint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.md,
  },
  section: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  tile: {
    backgroundColor: colors.primaryLight,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  tileReady: {
    backgroundColor: '#ECFDF5',
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  tileBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  tileHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  code: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    color: colors.primaryDark,
    marginVertical: 4,
  },
  inviteBlock: { gap: 8, marginTop: 6 },
});
