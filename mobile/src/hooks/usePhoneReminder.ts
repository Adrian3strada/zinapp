import { useEffect } from 'react';

import type { User } from '../types';
import { appAlert } from '../utils/appAlert';
import { mxPhoneError } from '../utils/phone';
import { setPendingNavigation } from '../navigation/pendingNavigation';

const promptedUserIds = new Set<number>();

function needsPhone(user: User): boolean {
  if (user.role === 'admin') return false;
  return Boolean(mxPhoneError(user.phone || '', true));
}

/** Recuerda agregar teléfono si la cuenta (p. ej. Google) se creó sin número. */
export function usePhoneReminder(user: User | null) {
  useEffect(() => {
    if (!user || !needsPhone(user)) return;
    if (promptedUserIds.has(user.id)) return;
    promptedUserIds.add(user.id);

    const timer = setTimeout(() => {
      appAlert(
        'Agrega tu teléfono',
        'Te registraste sin número y lo necesitamos para contactarte en pedidos y entregas.',
        [
          { text: 'Ahora no', style: 'cancel' },
          {
            text: 'Agregar ahora',
            onPress: () => setPendingNavigation({ type: 'profile' }),
          },
        ],
      );
    }, 900);

    return () => clearTimeout(timer);
  }, [user?.id, user?.phone, user?.role]);
}
