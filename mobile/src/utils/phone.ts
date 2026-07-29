/** Validación de teléfono MX (10 dígitos). */

export function normalizeMxPhone(value: string): string {
  let digits = (value || '').replace(/\D/g, '');
  if (digits.startsWith('521') && digits.length >= 13) {
    digits = digits.slice(3);
  } else if (digits.startsWith('52') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  return digits;
}

/** null = válido; string = mensaje de error. */
export function mxPhoneError(value: string, required = true): string | null {
  const trimmed = (value || '').trim();
  if (!trimmed) {
    return required ? 'El teléfono es obligatorio.' : null;
  }
  const digits = normalizeMxPhone(trimmed);
  if (digits.length !== 10) {
    return 'Usa un teléfono de 10 dígitos (ej. 4431234567).';
  }
  if (digits === '0000000000') {
    return 'Indica un teléfono válido.';
  }
  return null;
}
