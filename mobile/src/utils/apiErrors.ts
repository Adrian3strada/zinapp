import { API_URL, IS_PRODUCTION_APP } from '../config/api';

const FIELD_LABELS: Record<string, string> = {
  username: 'Usuario',
  email: 'Email',
  password: 'Contraseña',
  password_confirm: 'Confirmar contraseña',
  role: 'Tipo de cuenta',
  delivery_address: 'Dirección de entrega',
  delivery_latitude: 'Ubicación (latitud)',
  delivery_longitude: 'Ubicación (longitud)',
  coupon_code: 'Cupón',
  items: 'Productos',
  restaurant_id: 'Restaurante',
  payment_method: 'Método de pago',
  code: 'Cupón',
  token: 'Token',
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
    response?: { data?: Record<string, unknown> | { detail?: string } };
    message?: string;
    code?: string;
  };

  const data = err.response?.data;
  if (!data) {
    const msg = err.message ?? '';
    if (
      msg.includes('Network Error') ||
      msg.includes('network') ||
      err.code === 'ERR_NETWORK' ||
      err.code === 'ECONNABORTED'
    ) {
      if (IS_PRODUCTION_APP) {
        return (
          'Sin conexión al servidor. Comprueba que tienes internet e intenta de nuevo en unos segundos.\n\n' +
          `API: ${API_URL}`
        );
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

  if (typeof data === 'object' && 'detail' in data && typeof data.detail === 'string') {
    const detail = data.detail;
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
  for (const [field, value] of Object.entries(data)) {
    const label = FIELD_LABELS[field] ?? field;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (typeof v === 'string') {
          messages.push(`${label}: ${friendlyMessage(field, v)}`);
        }
      });
    } else if (typeof value === 'string') {
      messages.push(`${label}: ${friendlyMessage(field, value)}`);
    }
  }

  return messages.length > 0 ? messages.join('\n') : fallback;
}
