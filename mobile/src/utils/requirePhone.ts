import type { User } from '../types';
import { appAlert } from './appAlert';
import { mxPhoneError } from './phone';
import { setPendingNavigation } from '../navigation/pendingNavigation';

export function customerNeedsPhone(user: User | null | undefined): boolean {
  if (!user || user.role === 'admin') return false;
  return Boolean(mxPhoneError(user.phone || '', true));
}

export function promptAddPhone(): void {
  appAlert(
    'Teléfono obligatorio',
    'Agrega un número de 10 dígitos para que restaurante y repartidor puedan contactarte.',
    [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Agregar teléfono',
        onPress: () => setPendingNavigation({ type: 'profile' }),
      },
    ],
  );
}
