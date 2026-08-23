import { IS_PRODUCTION_APP } from '../config/api';

const FIELD_LABELS: Record<string, string> = {
  username: 'Usuario',
  email: 'Email',
  password: 'Contraseña',
  password_confirm: 'Confirmar contraseña',
  role: 'Tipo de cuenta',
  avatar: 'Foto de perfil',
  delivery_address: 'Dirección de entrega',
  delivery_latitude: 'Ubicación (latitud)',
  delivery_longitude: 'Ubicación (longitud)',
  coupon_code: 'Cupón',
  mandado_items: 'Productos del mandado',
  preferred_stores: 'Tiendas preferidas',
  items: 'Productos',
  restaurant_id: 'Restaurante',
  payment_method: 'Método de pago',
  code: 'Cupón',
  token: 'Código',
  new_password: 'Contraseña',
  non_field_errors: 'Error',
};

function friendlyMessage(field: string, raw: string): string {
  const lower = raw.toLowerCase();
  if (field.includes('latitude') || field.includes('longitude')) {
    return 'La ubicación GPS es inválida. Usa «Buscar dirección en mapa».';
  }
  if (lower.includes('cobertura') || lower.includes('zinapécuaro')) {
    return raw;
  }
  if (lower.includes('9 dígitos') || lower.includes('max_digits')) {
    return 'Coordenadas GPS con demasiados decimales. Busca tu dirección en el mapa.';
  }
  return raw;
}

export function getApiErrorMessage(error: unknown, fallback = 'Ocurrió un error'): string {
  const err = error as {
    response?: { status?: number; data?: unknown };
    message?: string;
    code?: string;
  };

  const httpStatus = err.response?.status;
  if (httpStatus === 500 || httpStatus === 502 || httpStatus === 503 || httpStatus === 504) {
    return 'El servidor tuvo un problema. Espera unos segundos e intenta de nuevo.';
  }
  if (httpStatus === 409) {
    const data = err.response?.data;
    if (typeof data === 'object' && data && 'detail' in data && typeof (data as { detail?: unknown }).detail === 'string') {
      return (data as { detail: string }).detail;
    }
    return 'Tu solicitud se está procesando. Espera unos segundos.';
  }

  const data = err.response?.data;
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('<!') || trimmed.startsWith('<html')) {
      return fallback;
    }
    if (trimmed.length > 0 && trimmed.length <= 280) {
      return trimmed;
    }
    return fallback;
  }

  if (!data || typeof data !== 'object') {
    const msg = err.message ?? '';
    if (
      msg.includes('Network Error') ||
      msg.includes('network') ||
      err.code === 'ERR_NETWORK' ||
      err.code === 'ECONNABORTED'
    ) {
      if (IS_PRODUCTION_APP) {
        return 'El servidor tardó en responder (puede estar despertando). Espera unos segundos e intenta de nuevo.';
      }
      return (
        'Sin conexión al servidor. Verifica que el backend esté corriendo con:\n' +
        'python manage.py runserver 0.0.0.0:8000'
      );
    }
    if (err.code === 'ECONNABORTED' || msg.includes('timeout')) {
      if (IS_PRODUCTION_APP) {
        return 'El servidor tardó en responder (puede estar despertando). Intenta de nuevo.';
      }
      return 'El servidor tardó demasiado en responder. Intenta de nuevo.';
    }
    return fallback;
  }

  if (typeof data === 'object' && 'detail' in data && typeof (data as { detail?: unknown }).detail === 'string') {
    const detail = (data as { detail: string }).detail;
    if (detail.includes('No Order matches the given query')) {
      return 'Pedido no encontrado o sin acceso.';
    }
    if (
      detail.includes('permission to perform this action')
      || detail.includes('permiso para realizar esta acción')
    ) {
      return 'No tienes permiso para esta acción. Verifica que iniciaste sesión con la cuenta correcta (restaurante, repartidor o cliente).';
    }
    return detail;
  }

  const messages: string[] = [];

  const collectMessages = (label: string, field: string, value: unknown) => {
    if (typeof value === 'string') {
      messages.push(`${label}: ${friendlyMessage(field, value)}`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === 'string') {
          messages.push(`${label}: ${friendlyMessage(field, entry)}`);
        } else if (entry && typeof entry === 'object') {
          for (const [nestedField, nestedValue] of Object.entries(entry as Record<string, unknown>)) {
            const nestedLabel = FIELD_LABELS[nestedField] ?? nestedField;
            collectMessages(`${label} › ${nestedLabel}`, nestedField, nestedValue);
          }
        }
      });
      return;
    }
    if (value && typeof value === 'object') {
      if ('message' in (value as object) && typeof (value as { message?: unknown }).message === 'string') {
        messages.push(
          `${label}: ${friendlyMessage(field, (value as { message: string }).message)}`,
        );
        return;
      }
      for (const [nestedField, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        const nestedLabel = FIELD_LABELS[nestedField] ?? nestedField;
        collectMessages(`${label} › ${nestedLabel}`, nestedField, nestedValue);
      }
    }
  };

  for (const [field, value] of Object.entries(data as Record<string, unknown>)) {
    const label = FIELD_LABELS[field] ?? field;
    collectMessages(label, field, value);
  }

  if (messages.length === 1) {
    // Evita "Código: Código inválido..." en alertas de un solo campo.
    const only = messages[0];
    const colon = only.indexOf(': ');
    if (colon > 0) return only.slice(colon + 2);
  }

  return messages.length > 0 ? messages.join('\n') : fallback;
}
